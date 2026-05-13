// ============================================================================
// Server fn wrapper for the adaptation engine. Trainer-only entry point.
// Component code calls this via useServerFn — never imports the .server file.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adaptationEngine } from "./propose-next-block.server";

export const proposeNextBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        priorPlanId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const proposal = await adaptationEngine.proposeNextBlock({
      trainerId: userId,
      clientId: data.clientId,
      priorPlanId: data.priorPlanId,
    });
    return { ok: true as const, proposal };
  });