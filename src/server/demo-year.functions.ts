import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rotateDemoYearForUser } from "@/server/demo-year.server";

// Re-export the server-only seeder so callers in `.functions.ts` files can
// import it via this thin wrapper. The heavy implementation (which imports
// supabaseAdmin) lives in `demo-year.server.ts` so the import-protection
// plugin keeps it out of the client bundle.
export { seedDemoYearForPlan } from "@/server/demo-year.server";

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
