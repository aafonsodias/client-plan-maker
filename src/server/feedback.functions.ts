import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Feedback inbox for plans. Bots and trainers / clients write here whenever
 * something is "off" so we can spot recurring complaints across the
 * simulated network. Bots write via the seeder using the admin client; this
 * file exposes the trainer-facing CRUD.
 */

const AUTHOR = z.enum(["client", "trainer", "bot", "system"]);
const CATEGORY = z.enum(["pain", "question", "complaint", "praise", "app_bug", "ux"]);
const STATUS = z.enum(["open", "acknowledged", "resolved"]);

export const listClientFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("plan_feedback")
      .select("*")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { ok: false as const, error: error.message, rows: [] as any[] };
    return { ok: true as const, rows: rows ?? [] };
  });

export const addClientFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        planId: z.string().uuid().nullable().optional(),
        author: AUTHOR.default("trainer"),
        category: CATEGORY,
        body: z.string().min(2).max(2000),
        metadata: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("plan_feedback")
      .insert({
        trainer_id: userId,
        client_id: data.clientId,
        plan_id: data.planId ?? null,
        author: data.author,
        category: data.category,
        body: data.body,
        metadata: (data.metadata ?? {}) as any,
      })
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, row };
  });

export const setFeedbackStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: STATUS }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = {
      status: data.status,
      resolved_at: data.status === "resolved" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("plan_feedback").update(patch).eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Trainer-wide top-N open complaints, used by the Forge dashboard. */
export const listOpenFeedbackTrainerWide = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("plan_feedback")
      .select("id, client_id, plan_id, author, category, body, status, created_at, metadata")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false as const, error: error.message, rows: [] as any[] };
    return { ok: true as const, rows: rows ?? [] };
  });