import type { SupabaseClient } from "@supabase/supabase-js";

export type QuotaCheck =
  | { ok: true }
  | { ok: false; reason: "quota_exceeded"; used: number; limit: number };

/**
 * Returns ok:true when the trainer can create another plan.
 *
 * Explicit two-step check (the previous RPC-based version returned null in
 * the authenticated client and would falsely block paying/founder accounts):
 *
 *   1. Active subscription or live trial → always allowed.
 *   2. Otherwise, allow if profiles.plan_quota_used < plan_quota_limit.
 */
export async function checkPlanQuota(
  supabase: SupabaseClient,
  userId: string,
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

  if (used < limit) return { ok: true };

  return { ok: false, reason: "quota_exceeded", used, limit };
}