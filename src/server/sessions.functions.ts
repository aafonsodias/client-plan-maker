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

/**
 * Entry schema is forward + backward compatible.
 *
 * Legacy (v1) shape: { exercise_name, planned, actual: {sets,reps,weight,notes} }.
 * New (v2) shape adds set-by-set logging via `sets[]` and a `felt` cue.
 *
 * Both shapes coexist because old sessions are stored as v1 and new
 * UI prefers v2. We accept both and let consumers branch on `sets` presence.
 */
const SetLogSchema = z.object({
  reps: z.string().max(20).optional().default(""),
  weight: z.string().max(40).optional().default(""),
  rpe: z.string().max(10).optional().default(""),
  done: z.boolean().optional().default(false),
  ts: z.string().max(40).optional().nullable(),
});

const EntrySchema = z.object({
  exercise_name: z.string().max(200),
  planned: z
    .object({
      sets: z.string().max(20).optional().default(""),
      reps: z.string().max(20).optional().default(""),
      rpe: z.string().max(10).optional().default(""),
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
    .partial()
    .optional(),
  sets: z.array(SetLogSchema).max(20).optional(),
  felt: z.enum(["easy", "right", "hard"]).optional(),
  notes: z.string().max(500).optional().default(""),
});

const SessionInput = z.object({
  plan_id: z.string().uuid(),
  week_number: z.number().int().min(1).max(104),
  day_label: z.string().min(1).max(60),
  session_date: z.string().min(8).max(20),
  session_notes: z.string().max(2000).optional().default(""),
  entries: z.array(EntrySchema).max(80),
  status: z.enum(["done", "partial", "missed", "in_progress"]).optional().default("done"),
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

    const baseRow = {
      plan_id: plan.id,
      trainer_id: plan.trainer_id,
      week_number: data.week_number,
      day_label: data.day_label,
      session_date: data.session_date,
      session_notes: data.session_notes,
      entries: data.entries,
      logged_by: "client" as const,
      status: data.status,
    };

    // For drafts (in_progress) we upsert on the partial unique index so we
    // don't pile up draft rows as the client types. For finalized
    // (done/partial/missed) we ALSO try to graduate any existing draft for
    // this slot — preventing the "ghost draft" left behind problem.
    if (data.status === "in_progress") {
      const { data: row, error } = await supabaseAdmin
        .from("workout_sessions")
        .upsert(baseRow, {
          onConflict: "plan_id,week_number,day_label,session_date,logged_by",
          ignoreDuplicates: false,
        })
        .select("id, status")
        .single();
      if (error) fail(error, "Could not save draft.");
      return { ok: true as const, id: row.id, status: row.status };
    }

    // Finalizing: delete any existing draft for this slot first, then insert.
    await supabaseAdmin
      .from("workout_sessions")
      .delete()
      .eq("plan_id", plan.id)
      .eq("week_number", data.week_number)
      .eq("day_label", data.day_label)
      .eq("session_date", data.session_date)
      .eq("logged_by", "client")
      .eq("status", "in_progress");

    const { data: row, error } = await supabaseAdmin
      .from("workout_sessions")
      .insert(baseRow)
      .select("id, status")
      .single();
    if (error) fail(error, "Could not save session.");
    return { ok: true as const, id: row.id, status: row.status };
  });

/* ─────────── New helpers for the rich logbook UI ─────────── */

/**
 * PUBLIC (token-gated): fetch the in-progress draft for a given slot, if any.
 * Returns null when nothing is in flight. Used to restore a half-typed
 * session when the client reopens the link.
 */
export const getOpenSession = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().uuid(),
        plan_id: z.string().uuid(),
        week_number: z.number().int().min(1).max(104),
        day_label: z.string().min(1).max(60),
        session_date: z.string().min(8).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    rateLimit(`getOpen:${data.token}`, 60, 60_000);
    const { data: plan } = await supabaseAdmin
      .from("workout_plans")
      .select("id, share_token_expires_at")
      .eq("share_token", data.token)
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan) return null;
    if (plan.share_token_expires_at && new Date(plan.share_token_expires_at).getTime() < Date.now()) {
      return null;
    }
    const { data: row } = await supabaseAdmin
      .from("workout_sessions")
      .select("entries, session_notes, updated_at")
      .eq("plan_id", data.plan_id)
      .eq("week_number", data.week_number)
      .eq("day_label", data.day_label)
      .eq("session_date", data.session_date)
      .eq("logged_by", "client")
      .eq("status", "in_progress")
      .maybeSingle();
    return row ?? null;
  });

/**
 * PUBLIC (token-gated): last N completed sessions for one exercise, used
 * to render "last time" chips and detect PRs. Returns the v2 sets[] when
 * available, otherwise the v1 actual{} so the client can normalize.
 */
export const getExerciseHistory = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().uuid(),
        plan_id: z.string().uuid(),
        exercise_name: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(20).optional().default(5),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    rateLimit(`exHistory:${data.token}`, 120, 60_000);
    const { data: plan } = await supabaseAdmin
      .from("workout_plans")
      .select("id, share_token_expires_at")
      .eq("share_token", data.token)
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan) return [];
    if (plan.share_token_expires_at && new Date(plan.share_token_expires_at).getTime() < Date.now()) {
      return [];
    }
    const { data: rows } = await supabaseAdmin
      .from("workout_sessions")
      .select("session_date, week_number, entries")
      .eq("plan_id", data.plan_id)
      .neq("status", "in_progress")
      .order("session_date", { ascending: false })
      .limit(40);
    const target = data.exercise_name.trim().toLowerCase();
    const out: Array<{
      session_date: string;
      week_number: number;
      sets?: Array<{ reps: string; weight: string; rpe?: string }>;
      actual?: { sets: string; reps: string; weight: string };
    }> = [];
    for (const row of (rows ?? []) as any[]) {
      const entries = Array.isArray(row.entries) ? row.entries : [];
      const match = entries.find(
        (e: any) => String(e?.exercise_name ?? "").trim().toLowerCase() === target,
      );
      if (!match) continue;
      out.push({
        session_date: row.session_date,
        week_number: row.week_number,
        sets: Array.isArray(match.sets) ? match.sets : undefined,
        actual: match.actual ?? undefined,
      });
      if (out.length >= data.limit) break;
    }
    return out;
  });

/**
 * PUBLIC (token-gated): streak + current-week progress for the header.
 * "Streak" = consecutive weeks with ≥1 finalized session, counting back
 * from the most recent week that has any session (current or past).
 */
export const getSessionStreak = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().uuid(),
        plan_id: z.string().uuid(),
        current_week: z.number().int().min(1).max(104),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    rateLimit(`streak:${data.token}`, 60, 60_000);
    const { data: plan } = await supabaseAdmin
      .from("workout_plans")
      .select("id, plan_data, share_token_expires_at")
      .eq("share_token", data.token)
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan) return { currentStreak: 0, weekDone: 0, weekTotal: 0, totalSessions: 0 };
    if (plan.share_token_expires_at && new Date(plan.share_token_expires_at).getTime() < Date.now()) {
      return { currentStreak: 0, weekDone: 0, weekTotal: 0, totalSessions: 0 };
    }
    const weeks: any[] = (plan.plan_data as any)?.weeks ?? [];
    const currentWeekDef = weeks.find((w) => w?.week_number === data.current_week);
    const weekTotal = Array.isArray(currentWeekDef?.days) ? currentWeekDef.days.length : 0;

    const { data: rows } = await supabaseAdmin
      .from("workout_sessions")
      .select("week_number, day_label, status")
      .eq("plan_id", data.plan_id)
      .neq("status", "in_progress");

    const all = (rows ?? []) as Array<{ week_number: number; day_label: string; status: string }>;
    const totalSessions = all.length;

    // Distinct days done in the current week
    const weekDoneLabels = new Set(
      all.filter((r) => r.week_number === data.current_week).map((r) => r.day_label),
    );
    const weekDone = weekDoneLabels.size;

    // Streak: walk backwards from the most recent week with any session
    const weekNumbers = Array.from(new Set(all.map((r) => r.week_number))).sort((a, b) => b - a);
    let currentStreak = 0;
    if (weekNumbers.length > 0) {
      let cursor = weekNumbers[0];
      const set = new Set(weekNumbers);
      while (set.has(cursor)) {
        currentStreak++;
        cursor--;
        if (cursor < 1) break;
      }
    }

    return { currentStreak, weekDone, weekTotal, totalSessions };
  });

/**
 * Mark a set of sessions as PR-celebrated so the confetti / toast does not
 * fire again on subsequent loads. Trainer-scoped via RLS.
 */
export const markSessionsCelebrated = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ session_ids: z.array(z.string().uuid()).min(1).max(50) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requireSupabaseAuth();
    const { error } = await supabaseAdmin
      .from("workout_sessions")
      .update({ pr_celebrated_at: new Date().toISOString() })
      .in("id", data.session_ids)
      .eq("trainer_id", user.id)
      .is("pr_celebrated_at", null);
    if (error) fail(error, "Could not mark PR celebration.");
    return { ok: true };
  });