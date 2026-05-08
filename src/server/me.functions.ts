import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

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
