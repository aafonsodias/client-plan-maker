import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSignedPhotoUrl } from "./intake-photos.server";

const TOKEN_TTL_DAYS = 14;

function newExpiry(): string {
  return new Date(Date.now() + TOKEN_TTL_DAYS * 86400_000).toISOString();
}

/* ─────────────── Trainer-side: generate / regenerate ─────────────── */

export const generateIntakeToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const expires = newExpiry();
    // Use admin to set the new token; verify ownership in the WHERE.
    const { data: row, error } = await supabaseAdmin
      .from("clients")
      .update({
        intake_token: crypto.randomUUID(),
        intake_token_expires_at: expires,
        intake_status: "sent",
        intake_submitted_at: null,
      })
      .eq("id", data.clientId)
      .eq("trainer_id", userId)
      .select("intake_token, intake_token_expires_at, intake_status")
      .single();
    if (error || !row) throw new Error("Could not generate intake link.");
    return row;
  });

/* ─────────────── Trainer-side: one-shot invite (creates placeholder client) ─────────────── */

export const createInviteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fullName?: string | null; email?: string | null; phone?: string | null }) =>
    z.object({
      fullName: z.string().trim().max(120).nullable().optional(),
      email: z.string().trim().email().max(254).nullable().optional().or(z.literal("")),
      phone: z.string().trim().max(40).nullable().optional().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const expires = newExpiry();
    const placeholder = (data.fullName ?? "").trim() || "Convite pendente";
    const { data: row, error } = await supabaseAdmin
      .from("clients")
      .insert({
        trainer_id: userId,
        full_name: placeholder,
        email: (data.email && data.email.length > 0) ? data.email : null,
        phone: (data.phone && data.phone.length > 0) ? data.phone : null,
        intake_token: crypto.randomUUID(),
        intake_token_expires_at: expires,
        intake_status: "sent",
      } as any)
      .select("id, full_name, email, phone, intake_token, intake_token_expires_at, intake_status")
      .single();
    if (error || !row) throw new Error("Could not create invite.");
    return row;
  });

export const markIntakeReviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("clients")
      .update({ intake_status: "reviewed" })
      .eq("id", data.clientId)
      .eq("trainer_id", userId);
    if (error) throw new Error("Could not mark reviewed.");
    return { ok: true };
  });

/**
 * Direct/manual client creation — name (required) + email (optional).
 * No intake link generated; trainer fills the assessment themselves later.
 * intake_status stays "not_sent" until the trainer chooses to send a link.
 */
export const createManualClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fullName: string; email?: string | null }) =>
    z.object({
      fullName: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(200).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: row, error } = await supabaseAdmin
      .from("clients")
      .insert({
        trainer_id: userId,
        full_name: data.fullName,
        email: data.email || null,
        intake_status: "not_sent",
      } as any)
      .select("id, full_name, email")
      .single();
    if (error || !row) throw new Error("Could not create client.");
    return row;
  });

/* ─────────────── Public: validate token + load form context ─────────────── */

// Very small in-memory rate limiter (per-process). Best-effort only.
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.resetAt < now) { hits.set(key, { count: 1, resetAt: now + windowMs }); return; }
  cur.count += 1;
  if (cur.count > max) throw new Error("Too many requests. Please try again in a minute.");
}

const tokenSchema = z.object({ token: z.string().uuid() });

export type IntakeContext = {
  status: "valid" | "expired" | "submitted";
  client?: { id: string; first_name: string; full_name: string | null; email: string | null; phone: string | null; date_of_birth: string | null; needs_identity: boolean };
  trainer?: { business_name: string | null; full_name: string | null; logo_url: string | null; primary_color: string | null; tagline?: string | null; user_id?: string | null };
  assessment?: any | null;
  submittedAt?: string | null;
};

export const loadIntake = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<IntakeContext> => {
    rateLimit(`load:${data.token}`);
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, email, phone, date_of_birth, trainer_id, intake_token_expires_at, intake_status, intake_submitted_at")
      .eq("intake_token", data.token)
      .maybeSingle();
    if (!client) return { status: "expired" };
    const expired = !client.intake_token_expires_at || new Date(client.intake_token_expires_at) < new Date();
    if (expired && client.intake_status !== "submitted" && client.intake_status !== "reviewed") {
      return { status: "expired" };
    }
    if (client.intake_status === "submitted" || client.intake_status === "reviewed") {
      return { status: "submitted", submittedAt: client.intake_submitted_at };
    }

    // Mark as opened (one-time)
    if (client.intake_status === "sent" || client.intake_status === "not_sent") {
      await supabaseAdmin.from("clients").update({ intake_status: "opened" }).eq("id", client.id);
    }

    const [{ data: profile }, { data: assessment }] = await Promise.all([
      // Use the locked-down RPC instead of reading the profiles table directly.
      // The RPC only returns branding-safe fields (no contact_email/phone).
      supabaseAdmin.rpc("get_intake_branding", { _token: data.token }).maybeSingle(),
      supabaseAdmin
        .from("assessments")
        .select("*")
        .eq("client_id", client.id)
        .maybeSingle(),
    ]);

    const firstName = (client.full_name ?? "").split(" ")[0] || "there";
    const placeholder = !client.full_name || /convite\s*pendente|invite\s*pending/i.test(client.full_name);
    return {
      status: "valid",
      client: {
        id: client.id,
        first_name: firstName,
        full_name: placeholder ? "" : (client.full_name ?? ""),
        email: (client as any).email ?? null,
        phone: (client as any).phone ?? null,
        date_of_birth: (client as any).date_of_birth ?? null,
        needs_identity: placeholder,
      },
      trainer: { ...((profile as any) ?? { business_name: null, full_name: null, logo_url: null, primary_color: null, tagline: null }), user_id: client.trainer_id },
      assessment: assessment ?? null,
    };
  });

/* ─────────────── Public: save draft + submit ─────────────── */

// Whitelist of assessment columns the public client may write to.
const ALLOWED_FIELDS = [
  "smart_specific", "smart_measurable", "smart_deadline",
  "readiness_stage",
  "experience_level", "training_days_per_week", "session_duration_minutes",
  "training_location", "available_equipment", "injuries", "medical_conditions", "preferences",
  "sleep_quality", "stress_level", "nutrition_habits",
  "energy_levels", "recovery_capacity",
  // Clinical safety
  "parq_passed", "acsm_risk_category", "medications", "med_flags",
  // Round R-intake-rich: extra PT-aligned columns the client may self-report.
  "years_training", "waist_cm", "hip_cm", "body_fat_pct", "current_capacity_vs_pb",
  "extended",
] as const;

const PROVENANCE_SECTIONS = ["smart_goal", "readiness", "training", "lifestyle", "nutrition", "safety"] as const;

// Per-field schemas. Validates VALUES, not just keys (defends against
// oversized payloads / wrong types reaching the DB via service-role).
const shortText = z.string().trim().max(500);
const longText = z.string().trim().max(4000);
const intRange = (min: number, max: number) =>
  z.number().int().min(min).max(max);
const stringArray = z.array(z.string().trim().max(120)).max(50);
// Permissive 2-level schema. Top-level keys are free-form (whitelist enforced
// implicitly by what the client sends), values can be primitives, flat arrays
// of primitives, or shallow objects whose values are primitives. This covers
// every shape the intake form actually emits (parq, skipped, photos,
// ai_goal_interpretation, ext_*, sched_days, etc.) without the fragile nested
// record-of-record refinement that was rejecting valid payloads.
const extPrimitive = z.union([z.string().max(4000), z.number(), z.boolean(), z.null()]);
const extendedSchema = z
  .record(
    z.string().max(80),
    z.union([
      extPrimitive,
      z.array(z.union([z.string().max(2000), z.number(), z.boolean()])).max(100),
      // Shallow object — values can themselves be primitives or short arrays.
      z
        .record(
          z.string().max(80),
          z.union([
            extPrimitive,
            z.array(z.union([z.string().max(2000), z.number(), z.boolean()])).max(100),
          ]),
        )
        .refine((o) => Object.keys(o).length <= 60, "nested object too large"),
    ]),
  )
  .refine((o) => Object.keys(o).length <= 100, "extended too large");

const FIELD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  smart_specific: longText,
  smart_measurable: shortText,
  smart_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  readiness_stage: z.enum(["precontemplation", "contemplation", "preparation", "action", "maintenance"]),
  experience_level: shortText,
  training_days_per_week: intRange(0, 14),
  session_duration_minutes: intRange(5, 240),
  training_location: z.array(z.string().trim().max(60)).max(8),
  available_equipment: stringArray,
  injuries: longText,
  medical_conditions: longText,
  preferences: longText,
  sleep_quality: intRange(1, 10),
  stress_level: intRange(1, 10),
  nutrition_habits: longText,
  energy_levels: shortText,
  recovery_capacity: shortText,
  parq_passed: z.boolean(),
  acsm_risk_category: z.enum(["low", "moderate", "high"]),
  medications: longText,
  med_flags: stringArray,
  // Numeric self-report columns. All optional; client may send null to clear.
  years_training: z.number().int().min(0).max(80),
  waist_cm: z.number().min(30).max(250),
  hip_cm: z.number().min(30).max(250),
  body_fat_pct: z.number().min(2).max(70),
  current_capacity_vs_pb: intRange(1, 10),
  extended: extendedSchema,
};

const saveSchema = z.object({
  token: z.string().uuid(),
  fields: z.record(z.string(), z.any()),
  // sections the client filled this save — used to mark provenance
  sections: z.array(z.enum(PROVENANCE_SECTIONS)).default([]),
  submit: z.boolean().default(false),
  identity: z
    .object({
      full_name: z.string().trim().min(1).max(120).optional(),
      email: z.string().trim().email().max(254).optional().or(z.literal("")),
      phone: z.string().trim().max(40).optional().or(z.literal("")),
      date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    })
    .optional(),
});

export const saveIntake = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data }) => {
    rateLimit(`save:${data.token}`, 60, 60_000);

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id, intake_token_expires_at, intake_status")
      .eq("intake_token", data.token)
      .maybeSingle();
    if (!client) throw new Error("This link is no longer valid.");
    if (client.intake_status === "reviewed" || client.intake_status === "submitted") {
      throw new Error("Already submitted.");
    }
    const expired = !client.intake_token_expires_at || new Date(client.intake_token_expires_at) < new Date();
    if (expired) throw new Error("This link has expired.");

    // Filter incoming fields by whitelist + validate value types per field.
    const cleaned: Record<string, any> = {};
    for (const k of Object.keys(data.fields)) {
      if (!(ALLOWED_FIELDS as readonly string[]).includes(k)) continue;
      const raw = data.fields[k];
      // Allow explicit null (clears value).
      if (raw === null || raw === undefined || raw === "") {
        cleaned[k] = null;
        continue;
      }
      const schema = FIELD_SCHEMAS[k];
      if (!schema) continue; // shouldn't happen — whitelist & schemas align.
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        console.error("[saveIntake] zod issues", k, JSON.stringify(parsed.error.issues));
        const first = parsed.error.issues[0];
        const path = first?.path?.length ? first.path.join(".") : k;
        throw new Error(`Invalid value for "${path}": ${first?.message ?? "unknown"}`);
      }
      cleaned[k] = parsed.data;
    }

    // Load existing assessment to merge extended.provenance
    const { data: existing } = await supabaseAdmin
      .from("assessments")
      .select("id, extended, " + (ALLOWED_FIELDS as readonly string[]).filter((k) => k !== "extended").join(", "))
      .eq("client_id", client.id)
      .maybeSingle();

    const prevExtended = (existing?.extended as Record<string, any>) ?? {};
    const prevProv = (prevExtended.provenance as Record<string, "client" | "trainer-edited">) ?? {};
    const prevFieldProv = (prevExtended.field_provenance as Record<string, "client" | "trainer-edited">) ?? {};
    const nextProv = { ...prevProv };
    for (const section of data.sections) {
      // Only mark sections as 'client' if not already trainer-edited
      if (nextProv[section] !== "trainer-edited") nextProv[section] = "client";
    }

    // Per-field provenance guard: any top-level column that the trainer
    // touched after the client's last save is preserved (client write
    // is dropped for that single field). Other fields still go through.
    const nextFieldProv = { ...prevFieldProv };
    const droppedFields: string[] = [];
    for (const k of Object.keys(cleaned)) {
      if (k === "extended") continue;
      if (prevFieldProv[k] === "trainer-edited") {
        droppedFields.push(k);
        delete cleaned[k];
        continue;
      }
      // Mark this field as client-owned for next time.
      nextFieldProv[k] = "client";
    }
    if (droppedFields.length > 0) {
      console.warn("[intake] preserved trainer-edited fields:", droppedFields);
    }

    // Merge any incoming extended (e.g. ext_hours_seated, ext_water_l_per_day, ext_meals_per_day)
    const incomingExtended = (cleaned.extended as Record<string, any>) ?? {};
    const mergedExtended = {
      ...prevExtended,
      ...incomingExtended,
      provenance: nextProv,
      field_provenance: nextFieldProv,
    };
    cleaned.extended = mergedExtended;

    if (existing) {
      const { error } = await supabaseAdmin
        .from("assessments")
        .update(cleaned as any)
        .eq("id", existing.id);
      if (error) {
        console.error("[intake] update assessment failed", error);
        throw new Error("Could not save your answers. Please try again.");
      }
    } else {
      const { error } = await supabaseAdmin
        .from("assessments")
        .insert({
          client_id: client.id,
          trainer_id: client.trainer_id,
          ...cleaned,
        } as any);
      if (error) {
        console.error("[intake] insert assessment failed", error);
        throw new Error("Could not save your answers. Please try again.");
      }
    }

    if (data.submit) {
      await supabaseAdmin
        .from("clients")
        .update({ intake_status: "submitted", intake_submitted_at: new Date().toISOString() })
        .eq("id", client.id);

      // If the intake includes a face photo, mirror it onto clients.photo_url
      // (signed URL, ~30 days) so the trainer's roster shows the real face
      // instead of initials right after submission.
      try {
        const facePath = (mergedExtended as any)?.photos?.face;
        if (typeof facePath === "string" && facePath.length > 0) {
          const signed = await getSignedPhotoUrl(facePath, 60 * 60 * 24 * 30);
          if (signed) {
            await supabaseAdmin.from("clients").update({ photo_url: signed }).eq("id", client.id);
          }
        }
      } catch (e) {
        console.error("[intake] face -> photo_url mirror failed", e);
      }
    }

    // Apply identity patch (name / email / phone / dob) — only fields the
    // client actually provided on this save. Empty strings clear optional
    // fields; full_name is only overwritten if a non-empty value comes in
    // (so we never blank a name the trainer pre-filled).
    if (data.identity) {
      const patch: Record<string, any> = {};
      if (data.identity.full_name && data.identity.full_name.trim().length > 0) {
        patch.full_name = data.identity.full_name.trim();
      }
      if (data.identity.email !== undefined) patch.email = data.identity.email || null;
      if (data.identity.phone !== undefined) patch.phone = data.identity.phone || null;
      if (data.identity.date_of_birth !== undefined) {
        patch.date_of_birth = data.identity.date_of_birth || null;
      }
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("clients").update(patch as any).eq("id", client.id);
      }
    }

    return { ok: true, submitted: data.submit };
  });

/* ─────────────── Public: link an authenticated user to their client row ─────────────── */

/**
 * After a client signs up at the end of intake, link the new auth user to the
 * client row referenced by the intake token. Requires the user to be
 * authenticated (auth-middleware) AND for the token to still resolve to the
 * correct trainer's client. One auth user can link to one client (uniqueness
 * enforced by partial index `clients_user_id_uniq`).
 */
export const linkClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, user_id, email")
      .eq("intake_token", data.token)
      .maybeSingle();
    if (!client) throw new Error("This link is no longer valid.");
    if (client.user_id && client.user_id !== userId) {
      throw new Error("This client is already linked to another account.");
    }
    if (!client.user_id) {
      const { error } = await supabaseAdmin
        .from("clients")
        .update({ user_id: userId })
        .eq("id", client.id);
      if (error) throw new Error(error.message);
    }
    // Also tag profile as a coached client (best-effort).
    await supabaseAdmin
      .from("profiles")
      .update({ account_type: "coached_client" } as any)
      .eq("user_id", userId);
    return { ok: true, clientId: client.id };
  });