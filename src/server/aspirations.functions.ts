import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Round C — log unmatched skill aspirations so the founder can review and
 * curate new templates over time. The DB table allows trainers to insert
 * for their own clients (RLS via auth.uid() = trainer_id).
 */
export const logUnmatchedAspiration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        text: z.string().min(2).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("assessment_unmatched_aspirations")
      .insert({
        client_id: data.clientId,
        trainer_id: userId,
        aspiration_text: data.text.trim(),
      });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });