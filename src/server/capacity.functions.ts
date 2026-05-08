import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * Capacity Map loader.
 *
 * Returns the 11 capacity domain templates (in display order) joined with the
 * single most-recent snapshot per domain for the given client.
 *
 * Auth: caller must be the trainer that owns the client, OR the coached
 * client themselves (clients.user_id = auth.uid()).
 *
 * Norm bands are static [25, 50, 75] for now — real per-domain norms land in a
 * later round. The visualization uses these as concentric reference rings.
 */
export const getClientCapacityMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ clientId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { clientId } = data;

    // 1. Auth check: trainer-owner OR coached-client (self).
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id, user_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) throw new Error("Client not found");
    const isTrainer = client.trainer_id === userId;
    const isSelf = client.user_id === userId;
    if (!isTrainer && !isSelf) throw new Error("Unauthorized");

    // 2. Templates.
    const { data: domains, error: dErr } = await supabaseAdmin
      .from("capacity_domains")
      .select(
        "slug, name_key, tier, display_order, evidence_summary_key, norm_reference_source, reference_assessments",
      )
      .order("display_order", { ascending: true });
    if (dErr) throw dErr;

    // 3. All snapshots for this client; we'll keep most-recent per domain.
    const { data: snaps, error: sErr } = await supabaseAdmin
      .from("client_capacity_snapshots")
      .select(
        "domain_slug, measured_at, raw_value, raw_unit, normalized_score, test_used, provenance, notes, evidence_url",
      )
      .eq("client_id", clientId)
      .order("measured_at", { ascending: false });
    if (sErr) throw sErr;

    const latestBySlug = new Map<string, (typeof snaps)[number]>();
    for (const s of snaps ?? []) {
      if (!latestBySlug.has(s.domain_slug)) latestBySlug.set(s.domain_slug, s);
    }

    const result = (domains ?? []).map((d) => ({
      ...d,
      currentSnapshot: latestBySlug.get(d.slug) ?? null,
    }));

    return {
      domains: result,
      normBands: { p25: 25, p50: 50, p75: 75 },
    };
  });