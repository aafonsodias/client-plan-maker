// Server-only helpers for capacity snapshots.
//
// These are NOT server functions — they're internal helpers callable from
// other server modules (Stage 2 / Stage 3 / pre-stage / screening). Lives
// in a *.server.ts file so the bundler refuses any client-side import.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface BodyCompSnapshot {
  test_used: string;
  raw_value: number | null;
  raw_unit: string | null;
  measured_at: string;
  provenance: string;
}

/**
 * Latest snapshot per `test_used` for the body_composition domain.
 * Returned as a record keyed by test_used (e.g. waist_circumference).
 */
export async function getLatestBodyCompositionSnapshots(
  clientId: string,
  supabase?: SupabaseClient,
): Promise<Record<string, BodyCompSnapshot>> {
  const sb = (supabase ?? supabaseAdmin) as SupabaseClient;
  const { data, error } = await sb
    .from("client_capacity_snapshots")
    .select("test_used, raw_value, raw_unit, measured_at, provenance")
    .eq("client_id", clientId)
    .eq("domain_slug", "body_composition")
    .order("measured_at", { ascending: false });
  if (error || !data) return {};
  const out: Record<string, BodyCompSnapshot> = {};
  for (const row of data as any[]) {
    const key = row.test_used as string | null;
    if (!key) continue;
    if (out[key]) continue; // first wins (newest)
    out[key] = {
      test_used: key,
      raw_value: row.raw_value,
      raw_unit: row.raw_unit,
      measured_at: row.measured_at,
      provenance: row.provenance,
    };
  }
  return out;
}

/**
 * Latest waist circumference for a client, in cm.
 * Snapshot first; falls back to assessments.waist_cm when no snapshot exists.
 */
export async function getLatestWaistCm(
  clientId: string,
  supabase?: SupabaseClient,
): Promise<number | null> {
  const sb = (supabase ?? supabaseAdmin) as SupabaseClient;
  const { data: snap } = await sb
    .from("client_capacity_snapshots")
    .select("raw_value")
    .eq("client_id", clientId)
    .eq("domain_slug", "body_composition")
    .eq("test_used", "waist_circumference")
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snap && typeof (snap as any).raw_value === "number") {
    return (snap as any).raw_value as number;
  }
  const { data: a } = await sb
    .from("assessments")
    .select("waist_cm")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const v = (a as any)?.waist_cm;
  return typeof v === "number" ? v : null;
}