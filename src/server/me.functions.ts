import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/** Resolve the client row for the calling user — own (self mode) or a
 * client owned by the trainer (preview mode via `as`). Returns null if the
 * caller has no access. */
async function resolveClient(userId: string, asId: string | null) {
  if (asId) {
    const { data: owned } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, photo_url, trainer_id, intake_status, intake_token")
      .eq("id", asId)
      .eq("trainer_id", userId)
      .maybeSingle();
    if (owned) return { client: owned, previewing: true as const };
  }
  const { data: own } = await supabaseAdmin
    .from("clients")
    .select("id, full_name, photo_url, trainer_id, intake_status, intake_token")
    .eq("user_id", userId)
    .maybeSingle();
  return own ? { client: own, previewing: false as const } : null;
}

/**
 * Coached-client portal loader (R70 — Casa do cliente, golden standard).
 *
 * Returns everything `/me` and its sub-routes need in one round trip:
 *   - client identity + trainer white-label
 *   - current plan + current-week prescription
 *   - today's check-in + week's check-ins (if logged)
 *   - last trainer message + unread count (from plan_feedback)
 *   - upcoming bookings + active packs
 *   - last 3 sessions, last session date, weight series (90d), top lifts
 *
 * If `as` is provided AND the caller owns that client (trainer_id = auth.uid()),
 * preview that client's portal — used by the "Ver como cliente" link.
 */
export const loadMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ as: z.string().uuid().nullable().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const asId = data.as ?? null;

    let client: any = null;
    let previewing = false;

    if (asId) {
      const { data: owned } = await supabaseAdmin
        .from("clients")
        .select("id, full_name, photo_url, trainer_id, intake_status, intake_token, date_of_birth")
        .eq("id", asId)
        .eq("trainer_id", userId)
        .maybeSingle();
      if (owned) {
        client = owned;
        previewing = true;
      }
    }

    if (!client) {
      const { data: own } = await supabaseAdmin
        .from("clients")
        .select("id, full_name, photo_url, trainer_id, intake_status, intake_token, date_of_birth")
        .eq("user_id", userId)
        .maybeSingle();
      client = own ?? null;
    }

    if (!client) return { linked: false as const };

    const [{ data: plan }, { data: trainer }] = await Promise.all([
      supabaseAdmin
        .from("workout_plans")
        .select("id, title, summary, duration_weeks, block_number, status, created_at, block_transition_summary, prior_plan_id, share_token")
        .eq("client_id", client.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("business_name, full_name, logo_url, primary_color, tagline")
        .eq("user_id", client.trainer_id)
        .maybeSingle(),
    ]);

    let weekDays: Array<{
      week_number: number;
      day_number: number;
      day_label: string | null;
      focus: string | null;
      exercise_count: number;
      preview: Array<{ name: string; sets: string; reps: string; rpe: string }>;
    }> = [];
    let recentSessions: Array<{
      id: string;
      session_date: string;
      day_label: string;
      week_number: number;
      exercise_count: number;
    }> = [];
    let currentWeek = 1;
    let lastSessionDate: string | null = null;

    if ((plan as any)?.id) {
      const { data: allDays } = await supabaseAdmin
        .from("workout_plan_days")
        .select("week_number, day_number, day_label, focus, content")
        .eq("plan_id", (plan as any).id)
        .order("week_number", { ascending: false })
        .order("day_number", { ascending: true });

      const days = (allDays ?? []) as any[];
      if (days.length > 0) {
        currentWeek = Math.max(...days.map((d) => d.week_number));
        weekDays = days
          .filter((d) => d.week_number === currentWeek)
          .map((d) => ({
            week_number: d.week_number,
            day_number: d.day_number,
            day_label: d.day_label,
            focus: d.focus,
            exercise_count: Array.isArray(d?.content?.exercises) ? d.content.exercises.length : 0,
            preview: (Array.isArray(d?.content?.exercises) ? d.content.exercises : [])
              .slice(0, 5)
              .map((ex: any) => ({
                name: String(ex?.name ?? ""),
                sets: String(ex?.sets ?? ""),
                reps: String(ex?.reps ?? ""),
                rpe: String(ex?.rpe ?? ""),
              })),
          }));
      }

      const { data: sessions } = await supabaseAdmin
        .from("workout_sessions")
        .select("id, session_date, day_label, week_number, entries")
        .eq("plan_id", (plan as any).id)
        .order("session_date", { ascending: false })
        .limit(3);

      recentSessions = (sessions ?? []).map((s: any) => ({
        id: s.id,
        session_date: s.session_date,
        day_label: s.day_label,
        week_number: s.week_number,
        exercise_count: Array.isArray(s.entries) ? s.entries.length : 0,
      }));
      lastSessionDate = recentSessions[0]?.session_date ?? null;
    }

    // Upcoming bookings (next 5 scheduled, future-only)
    const nowIso = new Date().toISOString();
    const { data: bookings } = await supabaseAdmin
      .from("client_bookings")
      .select("id, starts_at, duration_min, session_type, status, pack_id, notes")
      .eq("client_id", client.id)
      .eq("status", "scheduled")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(5);

    // Active packs (saldo)
    const { data: packs } = await supabaseAdmin
      .from("client_packs")
      .select("id, label, color, pack_size, sessions_used, session_type, weekly_frequency")
      .eq("client_id", client.id)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    // Today's checkin + last 7 days for the streak strip
    const todayIso = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const { data: checkins } = await supabaseAdmin
      .from("client_checkins")
      .select("checked_on, sleep_quality, soreness_level, energy_level, notes")
      .eq("client_id", client.id)
      .gte("checked_on", sevenDaysAgo)
      .order("checked_on", { ascending: false });
    const todayCheckin = (checkins ?? []).find((c: any) => c.checked_on === todayIso) ?? null;

    // Last message from the trainer + unread count.
    // We treat plan_feedback rows authored by 'trainer' with status='open' as unread.
    const { data: lastMsgRows } = await supabaseAdmin
      .from("plan_feedback")
      .select("id, body, created_at, status")
      .eq("client_id", client.id)
      .eq("author", "trainer")
      .order("created_at", { ascending: false })
      .limit(1);
    const lastTrainerMessage = lastMsgRows?.[0] ?? null;
    const { count: unreadCount } = await supabaseAdmin
      .from("plan_feedback")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("author", "trainer")
      .eq("status", "open");

    return {
      linked: true as const,
      previewing,
      client: {
        id: client.id,
        full_name: client.full_name,
        photo_url: client.photo_url,
        intake_status: client.intake_status,
        intake_token: client.intake_token,
      },
      plan: plan ?? null,
      trainer: trainer ?? null,
      currentWeek,
      weekDays,
      recentSessions,
      lastSessionDate,
      upcomingBookings: bookings ?? [],
      activePacks: packs ?? [],
      todayCheckin,
      weekCheckins: checkins ?? [],
      lastTrainerMessage,
      unreadCount: unreadCount ?? 0,
    };
  });

/**
 * Insert/update today's check-in. Cliente only — server fn refuses if the
 * caller is not the linked client (clients.user_id = auth.uid()).
 */
export const submitCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sleep_quality: z.number().int().min(1).max(5).nullable(),
        soreness_level: z.number().int().min(0).max(10).nullable(),
        energy_level: z.number().int().min(1).max(5).nullable(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: c } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!c) throw new Error("not_linked");
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabaseAdmin
      .from("client_checkins")
      .upsert(
        {
          client_id: c.id,
          trainer_id: c.trainer_id,
          checked_on: today,
          sleep_quality: data.sleep_quality,
          soreness_level: data.soreness_level,
          energy_level: data.energy_level,
          notes: data.notes ?? null,
        },
        { onConflict: "client_id,checked_on" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Cliente envia mensagem ao PT. Persistido em plan_feedback como
 * author='client', category='question', status='open'. PT vê na ficha.
 */
export const sendClientMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ body: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: c } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!c) throw new Error("not_linked");
    const { error } = await supabaseAdmin.from("plan_feedback").insert({
      client_id: c.id,
      trainer_id: c.trainer_id,
      author: "client",
      category: "question",
      body: data.body,
      status: "open",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Full message thread between client and trainer.
 * Supports `as` (trainer preview) so the trainer can see what the client sees.
 * Returns chronological-asc array (oldest → newest), capped at `limit`.
 */
export const loadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        as: z.string().uuid().nullable().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const resolved = await resolveClient(context.userId, data.as ?? null);
    if (!resolved) return { ok: false as const, messages: [] };
    const limit = data.limit ?? 50;
    const { data: rows } = await supabaseAdmin
      .from("plan_feedback")
      .select("id, author, body, status, created_at")
      .eq("client_id", resolved.client.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    return {
      ok: true as const,
      previewing: resolved.previewing,
      messages: (rows ?? []).reverse(),
    };
  });

/** Mark all open trainer→client messages as acknowledged once the client
 *  has actually viewed them. No-op for trainer preview. */
export const markMessagesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: c } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!c) return { ok: false as const };
    await supabaseAdmin
      .from("plan_feedback")
      .update({ status: "acknowledged" })
      .eq("client_id", c.id)
      .eq("author", "trainer")
      .eq("status", "open");
    return { ok: true as const };
  });

/**
 * Paginated workout-session history for the linked client (or previewed
 * client). Returns sessions newest-first plus a cursor (next session_date
 * to fetch under).
 */
export const loadHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        as: z.string().uuid().nullable().optional(),
        cursor: z.string().nullable().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const resolved = await resolveClient(context.userId, data.as ?? null);
    if (!resolved) return { ok: false as const, sessions: [], nextCursor: null };
    const limit = data.limit ?? 20;
    // Find all plans for this client (active + archived) for full history.
    const { data: plans } = await supabaseAdmin
      .from("workout_plans")
      .select("id, title, block_number")
      .eq("client_id", resolved.client.id);
    const planIds = (plans ?? []).map((p: any) => p.id);
    if (planIds.length === 0) return { ok: true as const, sessions: [], nextCursor: null };
    const planMap = new Map<string, any>((plans ?? []).map((p: any) => [p.id, p]));

    let q = supabaseAdmin
      .from("workout_sessions")
      .select("id, plan_id, session_date, day_label, week_number, entries, session_notes, status")
      .in("plan_id", planIds)
      .eq("status", "done")
      .order("session_date", { ascending: false })
      .limit(limit + 1);
    if (data.cursor) q = q.lt("session_date", data.cursor);
    const { data: rows } = await q;
    const list = (rows ?? []) as any[];
    const hasMore = list.length > limit;
    const sessions = list.slice(0, limit).map((s) => {
      const entries = Array.isArray(s.entries) ? s.entries : [];
      const rpes = entries
        .flatMap((e: any) => (Array.isArray(e?.sets) ? e.sets : []))
        .map((set: any) => Number(set?.rpe))
        .filter((n: number) => Number.isFinite(n) && n > 0);
      const avgRpe = rpes.length ? rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length : null;
      const plan = planMap.get(s.plan_id);
      return {
        id: s.id,
        session_date: s.session_date,
        day_label: s.day_label,
        week_number: s.week_number,
        block_number: plan?.block_number ?? 1,
        plan_title: plan?.title ?? "",
        exercise_count: entries.length,
        avg_rpe: avgRpe ? Math.round(avgRpe * 10) / 10 : null,
        notes: s.session_notes ?? null,
        entries: entries.map((e: any) => ({
          name: String(e?.name ?? e?.exercise ?? ""),
          sets: Array.isArray(e?.sets)
            ? e.sets.map((set: any) => ({
                load: set?.load ?? set?.weight ?? null,
                reps: set?.reps ?? null,
                rpe: set?.rpe ?? null,
              }))
            : [],
          prescribed: e?.prescribed ?? null,
        })),
      };
    });
    const nextCursor = hasMore ? sessions[sessions.length - 1].session_date : null;
    return { ok: true as const, sessions, nextCursor };
  });

/**
 * Aggregated progress data for /me/progresso:
 *  - 14-day adherence strip (sessions done + check-ins logged per day)
 *  - Top 5 lifts by Epley e1RM across the active plan
 *  - Weight series for the last 90 days
 *  - Capacity gain (Δ load + Δ e1RM per pattern) when a prior block exists
 */
export const loadProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ as: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const resolved = await resolveClient(context.userId, data.as ?? null);
    if (!resolved) return { ok: false as const };
    const clientId = resolved.client.id;

    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 13);
    const fromIso = fromDate.toISOString().slice(0, 10);
    const ninetyAgo = new Date(today);
    ninetyAgo.setDate(today.getDate() - 90);
    const ninetyIso = ninetyAgo.toISOString().slice(0, 10);

    // Plans + sessions
    const { data: plans } = await supabaseAdmin
      .from("workout_plans")
      .select("id, status, block_number, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    const planList = (plans ?? []) as any[];
    const activePlan = planList.find((p) => p.status !== "archived") ?? planList[0] ?? null;
    const priorPlan = activePlan
      ? planList.find(
          (p) => p.id !== activePlan.id && (p.block_number ?? 1) === (activePlan.block_number ?? 1) - 1,
        )
      : null;

    const planIds = planList.map((p) => p.id);
    const { data: sessions } = planIds.length
      ? await supabaseAdmin
          .from("workout_sessions")
          .select("id, plan_id, session_date, entries")
          .in("plan_id", planIds)
          .eq("status", "done")
          .order("session_date", { ascending: false })
          .limit(500)
      : { data: [] as any[] };
    const sessionRows = (sessions ?? []) as any[];

    // 14-day strip
    const checkinsRes = await supabaseAdmin
      .from("client_checkins")
      .select("checked_on")
      .eq("client_id", clientId)
      .gte("checked_on", fromIso);
    const checkinDays = new Set((checkinsRes.data ?? []).map((r: any) => r.checked_on));
    const sessionDays = new Set(sessionRows.map((s) => String(s.session_date)));
    const strip: Array<{ date: string; session: boolean; checkin: boolean }> = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(fromDate);
      d.setDate(fromDate.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      strip.push({ date: iso, session: sessionDays.has(iso), checkin: checkinDays.has(iso) });
    }

    // Top lifts (active plan)
    const epley = (load: number, reps: number) => load * (1 + reps / 30);
    const bestByExercise = new Map<string, { name: string; e1rm: number; load: number; reps: number; date: string }>();
    const activeSessions = activePlan
      ? sessionRows.filter((s) => s.plan_id === activePlan.id)
      : [];
    for (const s of activeSessions) {
      const entries = Array.isArray(s.entries) ? s.entries : [];
      for (const e of entries) {
        const name = String(e?.name ?? e?.exercise ?? "").trim();
        if (!name) continue;
        const sets = Array.isArray(e?.sets) ? e.sets : [];
        for (const set of sets) {
          const load = Number(set?.load ?? set?.weight);
          const reps = Number(set?.reps);
          if (!Number.isFinite(load) || !Number.isFinite(reps) || load <= 0 || reps <= 0) continue;
          const e1 = epley(load, reps);
          const prev = bestByExercise.get(name.toLowerCase());
          if (!prev || e1 > prev.e1rm) {
            bestByExercise.set(name.toLowerCase(), {
              name,
              e1rm: Math.round(e1 * 10) / 10,
              load,
              reps,
              date: String(s.session_date),
            });
          }
        }
      }
    }
    const topLifts = Array.from(bestByExercise.values())
      .sort((a, b) => b.e1rm - a.e1rm)
      .slice(0, 5);

    // Weight series (90d) — read from client_measurements.values.weight_kg
    const { data: measurements } = await supabaseAdmin
      .from("client_measurements")
      .select("measured_on, values")
      .eq("client_id", clientId)
      .gte("measured_on", ninetyIso)
      .order("measured_on", { ascending: true });
    const weightSeries = (measurements ?? [])
      .map((m: any) => {
        const w = Number(m?.values?.weight_kg ?? m?.values?.weight ?? NaN);
        return Number.isFinite(w) ? { date: m.measured_on, weight_kg: Math.round(w * 10) / 10 } : null;
      })
      .filter(Boolean) as Array<{ date: string; weight_kg: number }>;

    // Capacity gain — simplified per-exercise comparison vs prior block
    let capacity: Array<{ name: string; deltaLoadPct: number; deltaE1rmPct: number }> = [];
    if (activePlan && priorPlan) {
      const priorBest = new Map<string, number>();
      const priorSessions = sessionRows.filter((s) => s.plan_id === priorPlan.id);
      for (const s of priorSessions) {
        const entries = Array.isArray(s.entries) ? s.entries : [];
        for (const e of entries) {
          const name = String(e?.name ?? e?.exercise ?? "").trim().toLowerCase();
          if (!name) continue;
          for (const set of (Array.isArray(e?.sets) ? e.sets : [])) {
            const load = Number(set?.load ?? set?.weight);
            const reps = Number(set?.reps);
            if (!Number.isFinite(load) || !Number.isFinite(reps) || load <= 0 || reps <= 0) continue;
            const e1 = epley(load, reps);
            if (!priorBest.has(name) || e1 > (priorBest.get(name) ?? 0)) priorBest.set(name, e1);
          }
        }
      }
      capacity = topLifts
        .map((lift) => {
          const prior = priorBest.get(lift.name.toLowerCase());
          if (!prior || prior <= 0) return null;
          const cur = lift.e1rm;
          return {
            name: lift.name,
            deltaLoadPct: Math.round(((lift.load - 0) / Math.max(0.001, prior)) * 1000) / 10 - 100,
            deltaE1rmPct: Math.round(((cur - prior) / prior) * 1000) / 10,
          };
        })
        .filter(Boolean) as any;
    }

    // Progress photos — list under client-photos/progress/{clientId}/
    const { data: photoFiles } = await supabaseAdmin.storage
      .from("client-photos")
      .list(`progress/${clientId}`, { limit: 24, sortBy: { column: "created_at", order: "desc" } });
    const photos: Array<{ name: string; url: string; created_at: string | null }> = [];
    for (const f of photoFiles ?? []) {
      if (!f.name) continue;
      const { data: signed } = await supabaseAdmin.storage
        .from("client-photos")
        .createSignedUrl(`progress/${clientId}/${f.name}`, 60 * 60);
      if (signed?.signedUrl) {
        photos.push({ name: f.name, url: signed.signedUrl, created_at: f.created_at ?? null });
      }
    }

    return {
      ok: true as const,
      previewing: resolved.previewing,
      strip,
      topLifts,
      weightSeries,
      capacity,
      photos,
      hasPlan: !!activePlan,
      blockNumber: activePlan?.block_number ?? 1,
    };
  });
