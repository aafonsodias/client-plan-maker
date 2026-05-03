import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * ensureDemoClient — runs once per trainer, on first login.
 *
 * Creates a single demo client + plan + full logbook so the trainer can
 * explore the app immediately, without having to run an intake first.
 * Idempotent: gated by profiles.demo_seeded_at so subsequent calls are
 * no-ops, even across devices. Uses the same pipeline as the founder Demo
 * Lab (createDemoClient → runDemoPlay → seedDemoSessions) but in the
 * background. UI polls demo_runs to know when it's ready.
 *
 * Demo content is marked is_demo=true on both clients and workout_plans
 * so it does NOT count against the trainer's plan quota and can be wiped
 * with a single delete from the dashboard "Remove demo" action.
 */
export const ensureDemoClient = createServerFn({ method: "POST" }).
  middleware([requireSupabaseAuth]).
  handler(async ({ context }) => {
    const { userId } = context;

    // Already seeded? No-op.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("demo_seeded_at")
      .eq("user_id", userId)
      .maybeSingle();
    if ((profile as any)?.demo_seeded_at) {
      return { ok: true as const, alreadySeeded: true, runId: null };
    }

    // Stamp BEFORE kicking the run so concurrent dashboard mounts don't
    // double-seed. If the run later fails the trainer can manually retry
    // from the founder Demo Lab — we never want a botched run to spam.
    await supabaseAdmin
      .from("profiles")
      .update({ demo_seeded_at: new Date().toISOString() })
      .eq("user_id", userId);

    // Insert the run row and fire-and-forget the pipeline.
    const { data: runRow } = await supabaseAdmin
      .from("demo_runs")
      .insert({ trainer_id: userId, stage: "client", status: "running" })
      .select("id")
      .single();
    const runId = (runRow as any)?.id as string | undefined;
    if (!runId) {
      return { ok: false as const, alreadySeeded: false, runId: null };
    }

    // Lazy import keeps the heavy pipeline out of any cold path that just
    // needed to check the seeded flag.
    const { runInstantPipelineForUser } = await import("./demo-oneshot.server");
    void runInstantPipelineForUser(userId, runId, { durationWeeks: 4 }).catch((e: unknown) => {
      console.error("[demo-seed] pipeline error", e);
    });

    return { ok: true as const, alreadySeeded: false, runId };
  });

/**
 * Wipes ALL demo clients/plans for the current trainer in one call.
 * Used by the "Remove demo" dashboard action.
 */
export const wipeDemoContent = createServerFn({ method: "POST" }).
  middleware([requireSupabaseAuth]).
  handler(async ({ context }) => {
    const { userId } = context;
    // Cascade-delete via plans first (workout_sessions/days reference plans),
    // then demo clients. RLS on these tables is owner-scoped so admin client
    // mirrors what the trainer could already do — we just bundle it.
    await supabaseAdmin.from("workout_plans").delete().eq("trainer_id", userId).eq("is_demo", true);
    await supabaseAdmin.from("clients").delete().eq("trainer_id", userId).eq("is_demo", true);
    return { ok: true as const };
  });