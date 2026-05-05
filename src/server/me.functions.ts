import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * Coached-client portal loader.
 *
 * Returns the client row + most recent active plan + current-week prescription
 * + the last 3 logged sessions. Read-only; no costs, no AI.
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
        .select("id, full_name, photo_url, trainer_id")
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
        .select("id, full_name, photo_url, trainer_id")
        .eq("user_id", userId)
        .maybeSingle();
      client = own ?? null;
    }

    if (!client) return { linked: false as const };

    const [{ data: plan }, { data: trainer }] = await Promise.all([
      supabaseAdmin
        .from("workout_plans")
        .select("id, title, summary, duration_weeks, block_number, status, created_at")
        .eq("client_id", client.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("business_name, full_name, logo_url, primary_color")
        .eq("user_id", client.trainer_id)
        .maybeSingle(),
    ]);

    let weekDays: Array<{
      week_number: number;
      day_number: number;
      day_label: string | null;
      focus: string | null;
      exercise_count: number;
    }> = [];
    let recentSessions: Array<{
      id: string;
      session_date: string;
      day_label: string;
      week_number: number;
      exercise_count: number;
    }> = [];
    let currentWeek = 1;

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
    }

    return {
      linked: true as const,
      previewing,
      client: { id: client.id, full_name: client.full_name, photo_url: client.photo_url },
      plan: plan ?? null,
      trainer: trainer ?? null,
      currentWeek,
      weekDays,
      recentSessions,
    };
  });
