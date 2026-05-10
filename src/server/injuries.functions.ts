import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Round F1 — structured injuries CRUD.
 * Two access modes:
 *  - Trainer (auth-protected): manages injuries for their own clients.
 *  - Public intake (token): client adds/updates/removes injuries while the
 *    intake link is valid. Token validation happens server-side via the
 *    service-role client, mirroring `intake.functions.ts`.
 */

const InjuryRow = z.object({
  id: z.string().uuid(),
  assessment_id: z.string().uuid(),
  client_id: z.string().uuid(),
  trainer_id: z.string().uuid(),
  body_zone: z.string(),
  body_view: z.enum(["front", "back"]),
  severity: z.number().int().min(1).max(5),
  injury_label: z.string().nullable(),
  note: z.string().nullable(),
  source: z.enum(["self_reported", "medical_documented", "trainer_observed"]),
  medical_document_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type InjuryRow = z.infer<typeof InjuryRow>;

const insertSchema = z.object({
  bodyZone: z.string().min(1).max(64),
  bodyView: z.enum(["front", "back"]),
  severity: z.number().int().min(1).max(5),
  injuryLabel: z.string().max(64).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  source: z.enum(["self_reported", "medical_documented", "trainer_observed"]).optional(),
});

const patchSchema = z.object({
  severity: z.number().int().min(1).max(5).optional(),
  injuryLabel: z.string().max(64).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

async function resolveIntake(token: string) {
  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("id, trainer_id, intake_token_expires_at, intake_status")
    .eq("intake_token", token)
    .maybeSingle();
  if (error || !client) throw new Error("This link is no longer valid.");
  if (client.intake_status === "reviewed") throw new Error("Already reviewed.");
  if (!client.intake_token_expires_at || new Date(client.intake_token_expires_at) < new Date()) {
    throw new Error("This link has expired.");
  }
  const { data: assessment } = await supabaseAdmin
    .from("assessments")
    .select("id")
    .eq("client_id", client.id)
    .maybeSingle();
  if (!assessment) throw new Error("Assessment not found.");
  return { client, assessmentId: assessment.id as string };
}

/* ============================================================ Trainer API */

export const listInjuries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assessmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("assessment_injuries")
      .select("*")
      .eq("assessment_id", data.assessmentId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as InjuryRow[];
  });

export const addInjury = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        assessmentId: z.string().uuid(),
      })
      .merge(insertSchema)
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("assessment_injuries")
      .insert({
        client_id: data.clientId,
        assessment_id: data.assessmentId,
        trainer_id: userId,
        body_zone: data.bodyZone,
        body_view: data.bodyView,
        severity: data.severity,
        injury_label: data.injuryLabel ?? null,
        note: data.note ?? null,
        source: data.source ?? "trainer_observed",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as InjuryRow;
  });

export const updateInjury = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ injuryId: z.string().uuid() }).merge(patchSchema).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: { severity?: number; injury_label?: string | null; note?: string | null } = {};
    if (data.severity !== undefined) patch.severity = data.severity;
    if (data.injuryLabel !== undefined) patch.injury_label = data.injuryLabel;
    if (data.note !== undefined) patch.note = data.note;
    const { data: row, error } = await supabase
      .from("assessment_injuries")
      .update(patch)
      .eq("id", data.injuryId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as InjuryRow;
  });

export const removeInjury = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ injuryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("assessment_injuries").delete().eq("id", data.injuryId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ====================================================== Public intake API */

export const intakeListInjuries = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { client, assessmentId } = await resolveIntake(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("assessment_injuries")
      .select("*")
      .eq("assessment_id", assessmentId)
      .eq("client_id", client.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as InjuryRow[];
  });

export const intakeAddInjury = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().uuid() }).merge(insertSchema).parse(d),
  )
  .handler(async ({ data }) => {
    const { client, assessmentId } = await resolveIntake(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("assessment_injuries")
      .insert({
        client_id: client.id,
        assessment_id: assessmentId,
        trainer_id: client.trainer_id,
        body_zone: data.bodyZone,
        body_view: data.bodyView,
        severity: data.severity,
        injury_label: data.injuryLabel ?? null,
        note: data.note ?? null,
        source: data.source ?? "self_reported",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as InjuryRow;
  });

export const intakeUpdateInjury = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ token: z.string().uuid(), injuryId: z.string().uuid() })
      .merge(patchSchema)
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { client } = await resolveIntake(data.token);
    const patch: { severity?: number; injury_label?: string | null; note?: string | null } = {};
    if (data.severity !== undefined) patch.severity = data.severity;
    if (data.injuryLabel !== undefined) patch.injury_label = data.injuryLabel;
    if (data.note !== undefined) patch.note = data.note;
    const { data: row, error } = await supabaseAdmin
      .from("assessment_injuries")
      .update(patch)
      .eq("id", data.injuryId)
      .eq("client_id", client.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as InjuryRow;
  });

export const intakeRemoveInjury = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().uuid(), injuryId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { client } = await resolveIntake(data.token);
    const { error } = await supabaseAdmin
      .from("assessment_injuries")
      .delete()
      .eq("id", data.injuryId)
      .eq("client_id", client.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });