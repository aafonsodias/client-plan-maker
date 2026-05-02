import type { SupabaseClient } from "@supabase/supabase-js";

export type QuotaCheck =
  | { ok: true }
  | { ok: false; reason: "quota_exceeded"; used: number; limit: number };

/**
 * Returns ok:true when the trainer can create another plan, either because
 * they have an active subscription/trial OR because they're under their
 * free-plan quota. RPC `can_create_more_plans` lives in the DB so the check
 * stays consistent across server functions.
 */
export async function checkPlanQuota(
  supabase: SupabaseClient,
  userId: string,
): Promise<QuotaCheck> {
  const { data: allowed } = await supabase.rpc("can_create_more_plans", { _user_id: userId });
  if (allowed === true) return { ok: true };

  const { data: prof } = await supabase
    .from("profiles")
    .select("plan_quota_used, plan_quota_limit")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    ok: false,
    reason: "quota_exceeded",
    used: (prof as any)?.plan_quota_used ?? 0,
    limit: (prof as any)?.plan_quota_limit ?? 1,
  };
}