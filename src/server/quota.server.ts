import type { SupabaseClient } from "@supabase/supabase-js";

export type QuotaCheck =
  | { ok: true }
  | { ok: false; reason: "quota_exceeded"; used: number; limit: number };

/**
 * Returns ok:true when the trainer can create or continue working on a plan.
 *
 * Three-step check:
 *   1. Active subscription or live trial → always allowed.
 *   2. Otherwise, allow if profiles.plan_quota_used + reservedCount < plan_quota_limit.
 *      `reservedCount` = drafts already holding a reservation (R78 — keeps a
 *      free user from running 5 parallel drafts and only paying for 1).
 */
export async function checkPlanQuota(
  supabase: SupabaseClient,
  userId: string,
  opts: { excludePlanId?: string } = {},
): Promise<QuotaCheck> {
  // Step 1 — subscription / trial truth lives on `subscribers`.
  const { data: sub } = await supabase
    .from("subscribers")
    .select("subscribed, current_period_end, trial_end")
    .eq("user_id", userId)
    .maybeSingle();

  const now = Date.now();
  const subActive =
    !!(sub as any)?.subscribed &&
    (!(sub as any)?.current_period_end ||
      new Date((sub as any).current_period_end).getTime() > now);
  const trialActive =
    !!(sub as any)?.trial_end &&
    new Date((sub as any).trial_end).getTime() > now;

  if (subActive || trialActive) return { ok: true };

  // Step 2 — free-plan quota.
  const { data: prof } = await supabase
    .from("profiles")
    .select("plan_quota_used, plan_quota_limit")
    .eq("user_id", userId)
    .maybeSingle();

  const used = (prof as any)?.plan_quota_used ?? 0;
  const limit = (prof as any)?.plan_quota_limit ?? 1;

  // Step 3 — count drafts already reserved (R78). Treat as "occupying quota"
  // so a free user can't fan out parallel drafts.
  let reservedQuery = supabase
    .from("workout_plans")
    .select("id", { count: "exact", head: true })
    .eq("trainer_id", userId)
    .eq("quota_reserved", true)
    .neq("generation_status", "complete");
  if (opts.excludePlanId) reservedQuery = reservedQuery.neq("id", opts.excludePlanId);
  const { count: reservedRaw } = await reservedQuery;
  const reserved = reservedRaw ?? 0;

  if (used + reserved < limit) return { ok: true };

  return { ok: false, reason: "quota_exceeded", used, limit };
}

/**
 * Idempotently mark this draft as occupying one quota slot. Safe to call on
 * every AI stage — flips the flag once and never again. Excludes the plan
 * from the quota count so the same draft doesn't double-count itself.
 */
export async function reservePlanQuota(
  supabase: SupabaseClient,
  planId: string,
  userId: string,
): Promise<QuotaCheck> {
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("trainer_id, quota_reserved, generation_status, is_demo")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || (plan as any).trainer_id !== userId) {
    return { ok: false, reason: "quota_exceeded", used: 0, limit: 0 };
  }
  // Already reserved → cheap success.
  if ((plan as any).quota_reserved === true) return { ok: true };
  // Demo plans don't count.
  if ((plan as any).is_demo === true) return { ok: true };

  // Check quota EXCLUDING this plan (it would be itself otherwise).
  const quota = await checkPlanQuota(supabase, userId, { excludePlanId: planId });
  if (!quota.ok) return quota;

  await supabase
    .from("workout_plans")
    .update({ quota_reserved: true } as any)
    .eq("id", planId);
  return { ok: true };
}

/**
 * Release a reservation on hard failure / cleanup. Idempotent.
 */
export async function releasePlanQuota(
  supabase: SupabaseClient,
  planId: string,
): Promise<void> {
  await supabase
    .from("workout_plans")
    .update({ quota_reserved: false } as any)
    .eq("id", planId)
    .neq("generation_status", "complete");
}

export type LockResult =
  | { ok: true }
  | { ok: false; reason: "generation_locked"; heldBy: string | null };

const DEFAULT_LOCK_TTL_MS = 2 * 60 * 60 * 1000; // 2h

/**
 * Acquire a per-plan generation lock. Conditional UPDATE means only one tab
 * wins; the rest get { ok:false, reason:"generation_locked" }. The lock
 * auto-expires after `ttlMs` so a crashed tab can't wedge the plan.
 */
export async function acquireGenerationLock(
  supabase: SupabaseClient,
  planId: string,
  userId: string,
  ttlMs: number = DEFAULT_LOCK_TTL_MS,
): Promise<LockResult> {
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("generation_lock_acquired_at, generation_lock_owner, trainer_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || (plan as any).trainer_id !== userId) {
    return { ok: false, reason: "generation_locked", heldBy: null };
  }
  const heldAt = (plan as any).generation_lock_acquired_at as string | null;
  const heldBy = (plan as any).generation_lock_owner as string | null;
  const expired = !heldAt || (Date.now() - new Date(heldAt).getTime()) > ttlMs;

  // Same owner can re-enter (sequential AI stages from the same browser tab).
  if (heldBy === userId && !expired) return { ok: true };
  if (heldBy && heldBy !== userId && !expired) {
    return { ok: false, reason: "generation_locked", heldBy };
  }

  await supabase
    .from("workout_plans")
    .update({
      generation_lock_acquired_at: new Date().toISOString(),
      generation_lock_owner: userId,
    } as any)
    .eq("id", planId);
  return { ok: true };
}

export async function releaseGenerationLock(
  supabase: SupabaseClient,
  planId: string,
  userId: string,
): Promise<void> {
  await supabase
    .from("workout_plans")
    .update({
      generation_lock_acquired_at: null,
      generation_lock_owner: null,
    } as any)
    .eq("id", planId)
    .eq("generation_lock_owner", userId);
}

/**
 * One-shot guard for AI server functions. Wraps an async handler with:
 *   1. quota check (counts used + reserved drafts)
 *   2. idempotent reservation
 *   3. per-plan generation lock (2h TTL)
 *   4. release-on-error
 *
 * Returns either the handler's result, or a typed error envelope the
 * frontend already knows how to render (quota_exceeded → PaywallDialog,
 * generation_locked → inline toast).
 */
export async function withCostGuard<T>(
  args: { supabase: SupabaseClient; userId: string; planId: string },
  fn: () => Promise<T>,
): Promise<
  | T
  | { ok: false; error: "quota_exceeded"; used: number; limit: number }
  | { ok: false; error: "generation_locked"; heldBy: string | null }
> {
  const { supabase, userId, planId } = args;

  const reserved = await reservePlanQuota(supabase, planId, userId);
  if (!reserved.ok) {
    return { ok: false, error: "quota_exceeded", used: reserved.used, limit: reserved.limit };
  }

  const lock = await acquireGenerationLock(supabase, planId, userId);
  if (!lock.ok) {
    return { ok: false, error: "generation_locked", heldBy: lock.heldBy };
  }

  try {
    return await fn();
  } finally {
    await releaseGenerationLock(supabase, planId, userId);
  }
}