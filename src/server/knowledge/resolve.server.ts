import { mergeWithDefaults, SYSTEM_DEFAULT_RULES, type KnowledgeRules } from "./schema";

/**
 * Server-only helper. Resolves the effective KnowledgeRules for a trainer:
 * - If the trainer has a default profile, merge its rules over the system baseline.
 * - Otherwise, return system defaults.
 * Also returns the profile id + version so the caller can stamp the plan.
 */
export async function resolveRules(
  supabase: any,
  trainerId: string,
): Promise<{ rules: KnowledgeRules; profileId: string | null; version: number | null }> {
  const { data } = await supabase
    .from("knowledge_profiles")
    .select("id, version, rules")
    .eq("trainer_id", trainerId)
    .eq("is_default", true)
    .maybeSingle();
  if (!data) return { rules: SYSTEM_DEFAULT_RULES, profileId: null, version: null };
  return {
    rules: mergeWithDefaults((data as any).rules),
    profileId: (data as any).id,
    version: (data as any).version,
  };
}