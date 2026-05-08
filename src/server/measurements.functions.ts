/**
 * DEPRECATED — Phase A of measurement consolidation (Round 3.x).
 *
 * All write paths in this file are scheduled for removal in Phase B.
 * New measurement writes MUST go through:
 *   src/server/capacity.functions.ts -> addCapacitySnapshot
 *
 * Do NOT add new functions to this file.
 * Do NOT call recordMeasurement / listMeasurements / getMeasurementPrefs /
 * updateMeasurementPrefs from new code.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Per-client measurement logs split by cadence:
 *   - "daily"   → things like wake-up RHR, weight, sleep score
 *   - "periodic" → circumferences, body fat, BP (every 2–4 weeks)
 *
 * Field names live inside `values` JSONB so each trainer/client can pick
 * what to track without schema churn. The `client_measurement_prefs` row
 * stores which fields are active and the cadence interval.
 */

const ValuesSchema = z.record(z.string(), z.union([z.number(), z.string(), z.null()]));

export const recordMeasurement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        cadence: z.enum(["daily", "periodic"]),
        measuredOn: z.string().optional(), // YYYY-MM-DD
        values: ValuesSchema,
        notes: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error, data: row } = await supabase
      .from("client_measurements")
      .insert({
        trainer_id: userId,
        client_id: data.clientId,
        cadence: data.cadence,
        measured_on: data.measuredOn ?? new Date().toISOString().slice(0, 10),
        values: data.values as any,
        notes: data.notes ?? null,
      })
      .select("id, measured_on, cadence, values, notes")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, row };
  });

export const listMeasurements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        cadence: z.enum(["daily", "periodic"]).optional(),
        limit: z.number().int().min(1).max(180).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("client_measurements")
      .select("id, measured_on, cadence, values, notes, created_at")
      .eq("client_id", data.clientId)
      .order("measured_on", { ascending: false })
      .limit(data.limit ?? 60);
    if (data.cadence) q = q.eq("cadence", data.cadence);
    const { data: rows, error } = await q;
    if (error) return { ok: false as const, error: error.message, rows: [] };
    return { ok: true as const, rows: rows ?? [] };
  });

const PrefsSchema = z.object({
  dailyFields: z.array(z.string()).default([]),
  periodicFields: z.array(z.string()).default([]),
  periodicIntervalDays: z.number().int().min(1).max(365).default(14),
  reassessmentIntervalDays: z.number().int().min(7).max(365).default(56),
});

export const getMeasurementPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("client_measurement_prefs")
      .select("*")
      .eq("client_id", data.clientId)
      .maybeSingle();
    return row ?? null;
  });

export const updateMeasurementPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ clientId: z.string().uuid() })
      .merge(PrefsSchema.partial())
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Upsert keyed by client_id (PK).
    const payload: any = {
      client_id: data.clientId,
      trainer_id: userId,
    };
    if (data.dailyFields !== undefined) payload.daily_fields = data.dailyFields;
    if (data.periodicFields !== undefined) payload.periodic_fields = data.periodicFields;
    if (data.periodicIntervalDays !== undefined)
      payload.periodic_interval_days = data.periodicIntervalDays;
    if (data.reassessmentIntervalDays !== undefined)
      payload.reassessment_interval_days = data.reassessmentIntervalDays;
    const { error, data: row } = await supabase
      .from("client_measurement_prefs")
      .upsert(payload, { onConflict: "client_id" })
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, row };
  });