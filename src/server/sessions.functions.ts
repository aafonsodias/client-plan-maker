import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildSessionSummary, type SessionSummary } from "@/lib/session-summary";
import { inferPattern } from "@/server/adaptation/propose-next-block.server";

/** Parse first numeric token from a planned/actual text field ("8-10" → 8). */
function firstNum(s: unknown): number | null {
  const m = String(s ?? "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Slugify exercise name for stable cross-block joins. "Barbell Back Squat (close)"
 * → "barbell-back-squat". Strips parenthesised variant suffixes so the same
 * lift across blocks aggregates cleanly in the adaptation engine.
 */
function slugifyExercise(n: string): string {
  return String(n ?? "")
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

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
  // Mode-specific fields — all optional so legacy strength sets still parse.
  // cardio
  duration_s: z.number().int().min(0).max(36_000).optional(),
  distance_m: z.number().min(0).max(1_000_000).optional(),
  avg_hr: z.number().int().min(20).max(250).optional(),
  // intervals
  rounds: z.number().int().min(0).max(200).optional(),
  work_s: z.number().int().min(0).max(36_000).optional(),
  rest_s: z.number().int().min(0).max(36_000).optional(),
  // mobility / skill
  hold_s: z.number().int().min(0).max(36_000).optional(),
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
  pre_readiness: z
    .object({
      sleep: z.number().int().min(1).max(5).optional(),
      energy: z.number().int().min(1).max(5).optional(),
      soreness: z.number().int().min(0).max(10).optional(),
      notes: z.string().max(500).optional(),
    })
    .partial()
    .optional()
    .nullable(),
  post_feedback: z
    .object({
      session_rpe: z.number().min(1).max(10).optional(),
      mood: z.enum(["strong", "ok", "flat", "crushed"]).optional(),
      notes: z.string().max(500).optional(),
    })
    .partial()
    .optional()
    .nullable(),
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
      .select("id, trainer_id, client_id, plan_data, share_token_expires_at")
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
      pre_readiness: data.pre_readiness ?? null,
      post_feedback: data.post_feedback ?? null,
    };

    // For drafts (in_progress) we upsert on the partial unique index so we
    // don't pile up draft rows as the client types. For finalized
    // (done/partial/missed) we ALSO try to graduate any existing draft for
    // this slot — preventing the "ghost draft" left behind problem.
    if (data.status === "in_progress") {
      // Partial unique index (WHERE status='in_progress') can't be used by
      // PostgREST's onConflict inference, so emulate upsert manually.
      const { data: existing, error: findErr } = await supabaseAdmin
        .from("workout_sessions")
        .select("id")
        .eq("plan_id", plan.id)
        .eq("week_number", data.week_number)
        .eq("day_label", data.day_label)
        .eq("session_date", data.session_date)
        .eq("logged_by", "client")
        .eq("status", "in_progress")
        .maybeSingle();
      if (findErr) fail(findErr, "Could not save draft.");

      if (existing?.id) {
        const { data: row, error } = await supabaseAdmin
          .from("workout_sessions")
          .update(baseRow)
          .eq("id", existing.id)
          .select("id, status")
          .single();
        if (error) fail(error, "Could not save draft.");
        return { ok: true as const, id: row.id, status: row.status };
      }

      const { data: row, error } = await supabaseAdmin
        .from("workout_sessions")
        .insert(baseRow)
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

    // Per-set log mirror — only on finalize, only for v2 entries with sets[].
    // Powers the deterministic adaptation engine (e1RM, RPE drift, pain flags)
    // without touching the legacy entries jsonb.
    if (plan.client_id) {
      try {
        const setRows: Array<Record<string, unknown>> = [];
        for (const entry of data.entries) {
          if (!Array.isArray(entry.sets) || entry.sets.length === 0) continue;
          const exerciseName = entry.exercise_name;
          const slug = slugifyExercise(exerciseName);
          const pattern = inferPattern(exerciseName);
          const prescribedReps = firstNum(entry.planned?.reps);
          const prescribedRpe = firstNum(entry.planned?.rpe);
          entry.sets.forEach((s, idx) => {
            const actualLoad = firstNum(s.weight);
            const actualReps = firstNum(s.reps);
            const actualRpe = firstNum(s.rpe);
            // Only persist sets the user actually engaged with — keeps the
            // adaptation engine's denominators honest.
            if (!s.done && actualLoad === null && actualReps === null) return;
            setRows.push({
              trainer_id: plan.trainer_id,
              client_id: plan.client_id,
              plan_id: plan.id,
              session_id: row.id,
              week_number: data.week_number,
              exercise_slug: slug,
              exercise_name: exerciseName,
              movement_pattern: pattern,
              set_index: idx + 1,
              prescribed_load_kg: null,
              prescribed_reps: prescribedReps,
              prescribed_rpe: prescribedRpe,
              actual_load_kg: actualLoad,
              actual_reps: actualReps,
              actual_rpe: actualRpe,
              pain_flag: entry.felt === "hard" && (actualRpe ?? 0) >= 9.5,
              notes: typeof entry.notes === "string" && entry.notes.length > 0 ? entry.notes : null,
            });
          });
        }
        if (setRows.length > 0) {
          // Wipe any prior rows for this session (idempotent re-finalize) and
          // re-insert. Cheaper than diffing and keeps the table consistent.
          await supabaseAdmin.from("session_set_logs").delete().eq("session_id", row.id);
          const { error: setErr } = await supabaseAdmin
            .from("session_set_logs")
            .insert(setRows as never);
          if (setErr) {
            console.warn("[sessions] session_set_logs insert failed (non-fatal)", setErr.message);
          }
        }
      } catch (e) {
        console.warn("[sessions] session_set_logs mirror threw (non-fatal)", e);
      }
    }

    // Best-effort mirror of pre-readiness into client_checkins so autoreg
    // (programNextWeek) can read sleep/soreness without another UI.
    if (data.pre_readiness && plan.client_id) {
      const checkedOn = data.session_date;
      try {
        await supabaseAdmin
          .from("client_checkins")
          .upsert(
            {
              client_id: plan.client_id,
              trainer_id: plan.trainer_id,
              checked_on: checkedOn,
              sleep_quality: data.pre_readiness.sleep ?? null,
              soreness_level: data.pre_readiness.soreness ?? null,
              energy_level: data.pre_readiness.energy ?? null,
            },
            { onConflict: "client_id,checked_on", ignoreDuplicates: false },
          );
      } catch (e) {
        console.warn("[sessions] client_checkins mirror failed (non-fatal)", e);
      }
    }

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
      .select("entries, session_notes, pre_readiness, post_feedback, updated_at")
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
 * PUBLIC (token-gated): post-session summary card data.
 *
 * Loads the just-finalized session by id, finds the homologous session
 * from the previous week (same plan_id + day_label, week_number - 1),
 * builds the deterministic delta summary, and returns plus
 * "next session" pointer derived from plan_data.
 *
 * Returns null when the session does not match the share token's plan.
 */
export const getSessionSummary = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().uuid(),
        session_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    rateLimit(`sumSession:${data.token}`, 60, 60_000);
    const { data: plan } = await supabaseAdmin
      .from("workout_plans")
      .select("id, plan_data, share_token_expires_at")
      .eq("share_token", data.token)
      .maybeSingle();
    if (!plan) return null;
    if (
      plan.share_token_expires_at &&
      new Date(plan.share_token_expires_at).getTime() < Date.now()
    ) {
      return null;
    }

    const { data: session } = await supabaseAdmin
      .from("workout_sessions")
      .select(
        "id, plan_id, week_number, day_label, session_date, entries, post_feedback, pre_readiness, pr_celebrated_at",
      )
      .eq("id", data.session_id)
      .eq("plan_id", plan.id)
      .neq("status", "in_progress")
      .maybeSingle();
    if (!session) return null;

    // Prior session = same slot, week_number - 1, finalized.
    let prior: { entries: unknown } | null = null;
    if (session.week_number > 1) {
      const { data: pr } = await supabaseAdmin
        .from("workout_sessions")
        .select("entries")
        .eq("plan_id", plan.id)
        .eq("week_number", session.week_number - 1)
        .eq("day_label", session.day_label)
        .neq("status", "in_progress")
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      prior = pr ?? null;
    }

    const summary: SessionSummary = buildSessionSummary(
      Array.isArray(session.entries) ? (session.entries as any[]) : [],
      Array.isArray((prior as any)?.entries) ? ((prior as any).entries as any[]) : [],
    );

    // "Next session" pointer = next undone day this week, else first day of next week.
    const weeks: any[] = (plan.plan_data as any)?.weeks ?? [];
    const thisWeek = weeks.find((w) => w?.week_number === session.week_number);
    const allDays: Array<{ week_number: number; day_label: string; focus: string | null }> = [];
    for (const w of weeks) {
      for (const d of (w?.days ?? []) as any[]) {
        allDays.push({
          week_number: w.week_number,
          day_label: d?.day_label ?? "",
          focus: d?.focus ?? null,
        });
      }
    }
    const currentIdx = allDays.findIndex(
      (d) => d.week_number === session.week_number && d.day_label === session.day_label,
    );
    const next = currentIdx >= 0 ? allDays[currentIdx + 1] ?? null : null;
    const thisWeekFocus =
      thisWeek?.days?.find((d: any) => d?.day_label === session.day_label)?.focus ?? null;

    // Session number across the plan (ordinal of finalized days up to this session).
    const { data: orderRows } = await supabaseAdmin
      .from("workout_sessions")
      .select("week_number, day_label, session_date")
      .eq("plan_id", plan.id)
      .neq("status", "in_progress")
      .order("week_number", { ascending: true })
      .order("session_date", { ascending: true });
    const seen = new Set<string>();
    let ordinal = 0;
    for (const r of (orderRows ?? []) as any[]) {
      const key = `${r.week_number}|${r.day_label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ordinal += 1;
      if (r.week_number === session.week_number && r.day_label === session.day_label) break;
    }

    return {
      session_id: session.id,
      week_number: session.week_number,
      day_label: session.day_label,
      session_date: session.session_date,
      session_ordinal: ordinal,
      focus: thisWeekFocus as string | null,
      summary,
      next_session: next,
    };
  });

/**
 * Mark a set of sessions as PR-celebrated so the confetti / toast does not
 * fire again on subsequent loads. Trainer-scoped via RLS.
 */
export const markSessionsCelebrated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ session_ids: z.array(z.string().uuid()).min(1).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("workout_sessions")
      .update({ pr_celebrated_at: new Date().toISOString() })
      .in("id", data.session_ids)
      .eq("trainer_id", userId)
      .is("pr_celebrated_at", null);
    if (error) fail(error, "Could not mark PR celebration.");
    return { ok: true };
  });
/**
 * PUBLIC (token-gated): resolve "today's" session for the mobile logbook.
 * Heuristic:
 *   1. If there's an in_progress draft for any (week,day) → resume that.
 *   2. Else: pick the next (week,day) in plan order that is NOT done yet.
 *   3. Else (everything done): last finalized (week,day) so the user can
 *      still review / log a make-up.
 */
export const getTodayForToken = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    rateLimit(`today:${data.token}`, 60, 60_000);
    const { data: plan, error } = await supabaseAdmin
      .from("workout_plans")
      .select("id, plan_data, share_token_expires_at")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error || !plan) throw new Error("Invalid or expired link.");
    if (plan.share_token_expires_at && new Date(plan.share_token_expires_at).getTime() < Date.now()) {
      throw new Error("This share link has expired.");
    }

    const weeks: any[] = (plan.plan_data as any)?.weeks ?? [];
    const slots: Array<{ week_number: number; day_label: string; weekday: number | null }> = [];
    for (const w of weeks) {
      for (const d of w?.days ?? []) {
        slots.push({
          week_number: w.week_number,
          day_label: d.day_label,
          weekday: typeof d.weekday === "number" ? d.weekday : null,
        });
      }
    }
    if (slots.length === 0) {
      return { plan_id: plan.id, state: "empty" as const, week_number: 1, day_label: "", session_date: new Date().toISOString().slice(0, 10), resumed_draft: false };
    }

    // Auto-distribute weekdays for the FIRST week if none are set yet.
    // This is read-only inference — does not mutate plan_data. It mirrors
    // what distributeWeekdays() in src/lib/weekday-distribution.ts does so
    // the logbook always has something to anchor "today" to.
    const firstWeekDays = (weeks[0]?.days ?? []) as Array<{ weekday?: number | null }>;
    const anyWeekday = firstWeekDays.some((d) => typeof d?.weekday === "number");
    if (!anyWeekday && firstWeekDays.length > 0) {
      const TABLE: Record<number, number[]> = {
        1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5],
        5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7],
      };
      const wd = TABLE[Math.min(7, firstWeekDays.length)] ?? [];
      let idx = 0;
      for (const s of slots) {
        if (s.week_number === weeks[0].week_number) {
          s.weekday = wd[idx] ?? null;
          idx++;
        }
      }
    }

    const { data: rows } = await supabaseAdmin
      .from("workout_sessions")
      .select("week_number, day_label, status, session_date")
      .eq("plan_id", plan.id)
      .eq("logged_by", "client")
      .order("session_date", { ascending: false });

    const all = (rows ?? []) as Array<{
      week_number: number;
      day_label: string;
      status: string;
      session_date: string;
    }>;

    const draft = all.find((r) => r.status === "in_progress");
    if (draft) {
      return {
        plan_id: plan.id,
        state: "ready" as const,
        week_number: draft.week_number,
        day_label: draft.day_label,
        session_date: draft.session_date,
        resumed_draft: true,
      };
    }

    const doneKey = (s: { week_number: number; day_label: string }) =>
      `${s.week_number}:${s.day_label}`;
    const doneSet = new Set(
      all.filter((r) => r.status !== "in_progress" && r.status !== "missed").map(doneKey),
    );
    const today = new Date().toISOString().slice(0, 10);
    const todayWeekday = (() => {
      const dow = new Date().getDay();
      return dow === 0 ? 7 : dow;
    })();

    // 1) Today matches a scheduled training day that's still pending → pick it.
    const todaySlot = slots.find(
      (s) => s.weekday === todayWeekday && !doneSet.has(doneKey(s)),
    );
    if (todaySlot) {
      return {
        plan_id: plan.id,
        state: "ready" as const,
        week_number: todaySlot.week_number,
        day_label: todaySlot.day_label,
        session_date: today,
        resumed_draft: false,
        weekday: todayWeekday,
      };
    }

    // 2) Today's scheduled session is already done → done_today (with next suggestion).
    const todayDone = slots.find(
      (s) => s.weekday === todayWeekday && doneSet.has(doneKey(s)),
    );
    const nextPending = slots.find((s) => !doneSet.has(doneKey(s)));
    if (todayDone) {
      return {
        plan_id: plan.id,
        state: "done_today" as const,
        week_number: todayDone.week_number,
        day_label: todayDone.day_label,
        session_date: today,
        resumed_draft: false,
        weekday: todayWeekday,
        suggested_next: nextPending
          ? { week_number: nextPending.week_number, day_label: nextPending.day_label, weekday: nextPending.weekday }
          : null,
      };
    }

    // 3) No scheduled training today → rest day, but suggest next pending.
    if (nextPending && slots.some((s) => s.weekday !== null)) {
      return {
        plan_id: plan.id,
        state: "rest" as const,
        week_number: nextPending.week_number,
        day_label: nextPending.day_label,
        session_date: today,
        resumed_draft: false,
        weekday: todayWeekday,
        suggested_next: { week_number: nextPending.week_number, day_label: nextPending.day_label, weekday: nextPending.weekday },
      };
    }

    // 4) No weekday info at all → legacy sequential behaviour.
    const next = nextPending;
    if (next) {
      return {
        plan_id: plan.id,
        state: "ready" as const,
        week_number: next.week_number,
        day_label: next.day_label,
        session_date: today,
        resumed_draft: false,
      };
    }

    // 5) Plan complete — fall back to the last slot.
    const last = slots[slots.length - 1];
    return {
      plan_id: plan.id,
      state: "done_today" as const,
      week_number: last.week_number,
      day_label: last.day_label,
      session_date: today,
      resumed_draft: false,
    };
  });
