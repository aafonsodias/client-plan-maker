import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/* ─── Generic error helper — never leak DB internals to clients ─── */
function fail(internal: unknown, userMessage: string): never {
  console.error("[sessions]", userMessage, internal);
  throw new Error(userMessage);
}

/* ─── Best-effort in-process rate limiter (per worker) ─── */
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  cur.count += 1;
  if (cur.count > max) throw new Error("Too many requests. Try again in a minute.");
}

const EntrySchema = z.object({
  exercise_name: z.string().max(200),
  planned: z
    .object({
      sets: z.string().max(20).optional().default(""),
      reps: z.string().max(20).optional().default(""),
      rest: z.string().max(20).optional().default(""),
      notes: z.string().max(500).optional().default(""),
    })
    .partial(),
  actual: z
    .object({
      sets: z.string().max(20).optional().default(""),
      reps: z.string().max(20).optional().default(""),
      weight: z.string().max(40).optional().default(""),
      notes: z.string().max(500).optional().default(""),
    })
    .partial(),
});

const SessionInput = z.object({
  plan_id: z.string().uuid(),
  week_number: z.number().int().min(1).max(104),
  day_label: z.string().min(1).max(60),
  session_date: z.string().min(8).max(20),
  session_notes: z.string().max(2000).optional().default(""),
  entries: z.array(EntrySchema).max(80),
});

/** Trainer: list sessions for a plan */
export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("plan_id", data.plan_id)
      .eq("trainer_id", userId)
      .order("session_date", { ascending: false });
    if (error) fail(error, "Could not load sessions.");
    return rows ?? [];
  });

/** Trainer: save (insert) a session */
export const saveTrainerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SessionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("workout_sessions")
      .insert({
        plan_id: data.plan_id,
        trainer_id: userId,
        week_number: data.week_number,
        day_label: data.day_label,
        session_date: data.session_date,
        session_notes: data.session_notes,
        entries: data.entries,
        logged_by: "trainer",
      })
      .select("*")
      .single();
    if (error) fail(error, "Could not save session.");
    return row;
  });

/** Trainer: enable / rotate share token for client log access */
export const ensureShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plan_id: z.string().uuid(),
        rotate: z.boolean().optional(),
        ttl_days: z.number().int().min(1).max(365).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan, error: planErr } = await supabase
      .from("workout_plans")
      .select("id, share_token, share_token_expires_at, trainer_id")
      .eq("id", data.plan_id)
      .single();
    if (planErr || !plan) fail(planErr, "Plan not found.");
    if (plan.trainer_id !== userId) throw new Error("Not allowed.");
    const stillValid =
      plan.share_token &&
      plan.share_token_expires_at &&
      new Date(plan.share_token_expires_at).getTime() > Date.now();
    if (stillValid && !data.rotate) {
      return { share_token: plan.share_token!, expires_at: plan.share_token_expires_at! };
    }
    const newToken = crypto.randomUUID();
    const ttlDays = data.ttl_days ?? 90;
    const expiresAt = new Date(Date.now() + ttlDays * 86400_000).toISOString();
    const { error: upErr } = await supabase
      .from("workout_plans")
      .update({ share_token: newToken, share_token_expires_at: expiresAt })
      .eq("id", data.plan_id)
      .eq("trainer_id", userId);
    if (upErr) fail(upErr, "Could not enable share link.");
    return { share_token: newToken, expires_at: expiresAt };
  });

/** Trainer: revoke share token */
export const revokeShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("workout_plans")
      .update({ share_token: null, share_token_expires_at: null })
      .eq("id", data.plan_id)
      .eq("trainer_id", userId);
    if (error) fail(error, "Could not revoke share link.");
    return { ok: true };
  });

/** PUBLIC (token-gated): fetch plan summary for client log page */
export const getSharedPlan = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    rateLimit(`getShared:${data.token}`, 60, 60_000);
    const { data: plan, error } = await supabaseAdmin
      .from("workout_plans")
      .select("id, title, summary, plan_data, client_id, trainer_id, share_token_expires_at")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) fail(error, "Invalid or expired link.");
    if (!plan) throw new Error("Invalid or expired link");
    if (plan.share_token_expires_at && new Date(plan.share_token_expires_at).getTime() < Date.now()) {
      throw new Error("This share link has expired.");
    }
    const [{ data: client }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("clients").select("full_name").eq("id", plan.client_id).maybeSingle(),
      supabaseAdmin.from("profiles").select("business_name, full_name").eq("user_id", plan.trainer_id).maybeSingle(),
    ]);
    return {
      id: plan.id,
      title: plan.title,
      summary: plan.summary,
      plan_data: plan.plan_data,
      client_name: client?.full_name ?? null,
      trainer_name: profile?.business_name || profile?.full_name || null,
    };
  });

/** PUBLIC (token-gated): client logs a session */
export const saveClientSession = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    SessionInput.extend({ token: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    rateLimit(`saveClient:${data.token}`, 30, 60_000);
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id, plan_data, share_token_expires_at")
      .eq("share_token", data.token)
      .eq("id", data.plan_id)
      .maybeSingle();
    if (planErr || !plan) fail(planErr, "Invalid link.");
    if (plan.share_token_expires_at && new Date(plan.share_token_expires_at).getTime() < Date.now()) {
      throw new Error("This share link has expired.");
    }

    // Validate week_number/day_label exist in the plan structure.
    const weeks: any[] = (plan.plan_data as any)?.weeks ?? [];
    const targetWeek = weeks.find((w) => w?.week_number === data.week_number);
    if (!targetWeek) throw new Error("Invalid week for this plan.");
    const targetDay = (targetWeek.days ?? []).find((d: any) => d?.day_label === data.day_label);
    if (!targetDay) throw new Error("Invalid day for this plan.");

    const { data: row, error } = await supabaseAdmin
      .from("workout_sessions")
      .insert({
        plan_id: plan.id,
        trainer_id: plan.trainer_id,
        week_number: data.week_number,
        day_label: data.day_label,
        session_date: data.session_date,
        session_notes: data.session_notes,
        entries: data.entries,
        logged_by: "client",
      })
      .select("id")
      .single();
    if (error) fail(error, "Could not save session.");
    return { ok: true, id: row.id };
  });