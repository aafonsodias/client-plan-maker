import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EntrySchema = z.object({
  exercise_name: z.string().max(200),
  planned: z
    .object({
      sets: z.string().max(20).optional().default(""),
      reps: z.string().max(20).optional().default(""),
      rest: z.string().max(20).optional().default(""),
      notes: z.string().max(500).optional().default(""),
    })
    .partial(),
  actual: z
    .object({
      sets: z.string().max(20).optional().default(""),
      reps: z.string().max(20).optional().default(""),
      weight: z.string().max(40).optional().default(""),
      notes: z.string().max(500).optional().default(""),
    })
    .partial(),
});

const SessionInput = z.object({
  plan_id: z.string().uuid(),
  week_number: z.number().int().min(1).max(104),
  day_label: z.string().min(1).max(60),
  session_date: z.string().min(8).max(20),
  session_notes: z.string().max(2000).optional().default(""),
  entries: z.array(EntrySchema).max(80),
});

/** Trainer: list sessions for a plan */
export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("plan_id", data.plan_id)
      .order("session_date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Trainer: save (insert) a session */
export const saveTrainerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SessionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("workout_sessions")
      .insert({
        plan_id: data.plan_id,
        trainer_id: userId,
        week_number: data.week_number,
        day_label: data.day_label,
        session_date: data.session_date,
        session_notes: data.session_notes,
        entries: data.entries,
        logged_by: "trainer",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Trainer: enable / rotate share token for client log access */
export const ensureShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan_id: z.string().uuid(), rotate: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan, error: planErr } = await supabase
      .from("workout_plans")
      .select("id, share_token, trainer_id")
      .eq("id", data.plan_id)
      .single();
    if (planErr || !plan) throw new Error("Plan not found");
    if (plan.trainer_id !== userId) throw new Error("Not allowed");
    if (plan.share_token && !data.rotate) return { share_token: plan.share_token };
    const newToken = crypto.randomUUID();
    const { error: upErr } = await supabase
      .from("workout_plans")
      .update({ share_token: newToken })
      .eq("id", data.plan_id);
    if (upErr) throw new Error(upErr.message);
    return { share_token: newToken };
  });

/** Trainer: revoke share token */
export const revokeShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("workout_plans")
      .update({ share_token: null })
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** PUBLIC (token-gated): fetch plan summary for client log page */
export const getSharedPlan = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: plan, error } = await supabaseAdmin
      .from("workout_plans")
      .select("id, title, summary, plan_data, client_id, trainer_id")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Error("Invalid or expired link");
    const [{ data: client }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("clients").select("full_name").eq("id", plan.client_id).maybeSingle(),
      supabaseAdmin.from("profiles").select("business_name, full_name").eq("user_id", plan.trainer_id).maybeSingle(),
    ]);
    return {
      id: plan.id,
      title: plan.title,
      summary: plan.summary,
      plan_data: plan.plan_data,
      client_name: client?.full_name ?? null,
      trainer_name: profile?.business_name || profile?.full_name || null,
    };
  });

/** PUBLIC (token-gated): client logs a session */
export const saveClientSession = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    SessionInput.extend({ token: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id")
      .eq("share_token", data.token)
      .eq("id", data.plan_id)
      .maybeSingle();
    if (planErr || !plan) throw new Error("Invalid link");
    const { data: row, error } = await supabaseAdmin
      .from("workout_sessions")
      .insert({
        plan_id: plan.id,
        trainer_id: plan.trainer_id,
        week_number: data.week_number,
        day_label: data.day_label,
        session_date: data.session_date,
        session_notes: data.session_notes,
        entries: data.entries,
        logged_by: "client",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });