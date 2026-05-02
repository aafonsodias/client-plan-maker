import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createDemoClient } from "@/server/demo-client.functions";
import { runDemoPlay } from "@/server/demo-play.functions";
import { seedDemoSessions } from "@/server/demo-sessions.functions";

/**
 * createDemoClientFull — INSTANT mode.
 *
 * One-click: AI client + assessment + full plan + 2 weeks of logged sessions.
 * No theatrics, no scroll-to-trigger. Returns { clientId, planId, sessions }.
 * The dev panel uses this; the existing per-stage demo-play stays for the
 * theatrical orchestrator on the client detail page.
 */
export const createDemoClientFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ archetype: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    // 1) Create the client + assessment.
    const created: any = await createDemoClient({ data: { archetype: data.archetype } });
    if (!created?.clientId) {
      return { ok: false as const, stage: "create_client", error: "Failed to create demo client.", clientId: null, planId: null, sessions: 0 };
    }
    const clientId = created.clientId as string;

    // 2) Run the full phased plan pipeline.
    const ran: any = await runDemoPlay({ data: { clientId } });
    if (!ran?.ok || !ran?.planId) {
      return { ok: false as const, stage: ran?.failedStep ?? "plan", error: ran?.error ?? "Plan generation failed.", clientId, planId: null, sessions: 0 };
    }
    const planId = ran.planId as string;

    // 3) Seed 2 weeks of sessions (best-effort — don't fail the whole op if seeding fails).
    let sessions = 0;
    try {
      const seeded: any = await seedDemoSessions({ data: { planId, weeksToSeed: 2 } });
      sessions = seeded?.inserted ?? 0;
    } catch (e) {
      console.error("[demo-oneshot] seed sessions failed", e);
    }

    return { ok: true as const, stage: "done" as const, error: null, clientId, planId, sessions };
  });