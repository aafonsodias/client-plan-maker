import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * Coached-client portal loader.
 *
 * Returns the client row + most recent active plan for the authenticated user.
 * Read-only; no costs, no AI surface, no trainer data beyond branding.
 *
 * If `as` is provided AND the caller owns that client (trainer_id = auth.uid()),
 * preview that client's portal instead — used by the "Ver como cliente" link.
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

    return {
      linked: true as const,
      previewing,
      client: { id: client.id, full_name: client.full_name, photo_url: client.photo_url },
      plan: plan ?? null,
      trainer: trainer ?? null,
    };
  });
