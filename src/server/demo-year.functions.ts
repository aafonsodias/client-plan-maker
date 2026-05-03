import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rotateDemoYearForUser } from "@/server/demo-year.server";

/**
 * rotateDemoYear — fast-forwards every demo session by 365 days, capped at
 * today, so a trainer can demo "this week" sessions even months later
 * without regenerating anything.
 */
export const rotateDemoYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { rotated } = await rotateDemoYearForUser(context.userId);
    return { ok: true as const, rotated };
  });
