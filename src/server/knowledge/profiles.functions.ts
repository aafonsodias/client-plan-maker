import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { KnowledgeRulesV1, SYSTEM_DEFAULT_RULES } from "./schema";

export const listKnowledgeProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("knowledge_profiles")
      .select("id, name, description, is_system, is_default, version, rules, updated_at")
      .or(`trainer_id.eq.${userId},is_system.eq.true`)
      .order("is_system", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, profiles: data ?? [] };
  });

export const getActiveKnowledgeProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("knowledge_profiles")
      .select("id, name, version, rules, is_default")
      .eq("trainer_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    if (!data) {
      // Auto-create a default profile on first access.
      const { data: created, error: insErr } = await supabase
        .from("knowledge_profiles")
        .insert({
          trainer_id: userId,
          name: "Default",
          description: "Perfil padrão. Edite para refletir a sua filosofia.",
          is_default: true,
          rules: SYSTEM_DEFAULT_RULES as any,
        })
        .select("id, name, version, rules, is_default")
        .single();
      if (insErr) return { ok: false as const, error: insErr.message };
      return { ok: true as const, profile: created };
    }
    return { ok: true as const, profile: data };
  });

export const updateKnowledgeRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        rules: KnowledgeRulesV1,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("knowledge_profiles")
      .select("trainer_id, is_system")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing || (existing as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }
    if ((existing as any).is_system) {
      return { ok: false as const, error: "system_profile_readonly" };
    }
    const { data: updated, error } = await supabase
      .from("knowledge_profiles")
      .update({ rules: data.rules as any })
      .eq("id", data.id)
      .select("id, version, rules")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, profile: updated };
  });

export const duplicateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src } = await supabase
      .from("knowledge_profiles")
      .select("rules, description")
      .eq("id", data.id)
      .maybeSingle();
    if (!src) return { ok: false as const, error: "not_found" };
    const { data: created, error } = await supabase
      .from("knowledge_profiles")
      .insert({
        trainer_id: userId,
        name: data.name,
        description: (src as any).description ?? "",
        rules: (src as any).rules,
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, profileId: (created as any).id };
  });