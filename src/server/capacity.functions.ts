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

/**
 * Insert a new capacity snapshot for a client.
 * Caller must be the trainer that owns the client.
 */
export const addCapacitySnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        clientId: z.string().uuid(),
        domainSlug: z.string().min(1),
        testUsed: z.string().max(200).optional(),
        rawValue: z.number().finite().min(0).optional(),
        rawUnit: z.string().max(40).optional(),
        normalizedScore: z.number().min(0).max(100).optional(),
        measuredAt: z.string().datetime().optional(),
        notes: z.string().max(1000).optional(),
      })
      .refine((d) => d.rawValue != null || d.normalizedScore != null, {
        message: "Either rawValue or normalizedScore is required",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!client) throw new Error("Client not found");
    if (client.trainer_id !== userId) throw new Error("Unauthorized");

    const { data: domain } = await supabaseAdmin
      .from("capacity_domains")
      .select("slug")
      .eq("slug", data.domainSlug)
      .maybeSingle();
    if (!domain) throw new Error("Unknown domain");

    const { data: snapshot, error } = await supabaseAdmin
      .from("client_capacity_snapshots")
      .insert({
        client_id: data.clientId,
        domain_slug: data.domainSlug,
        test_used: data.testUsed ?? null,
        raw_value: data.rawValue ?? null,
        raw_unit: data.rawUnit ?? null,
        normalized_score: data.normalizedScore ?? null,
        measured_at: data.measuredAt ?? new Date().toISOString(),
        notes: data.notes ?? null,
        provenance: "pt_assessed",
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return snapshot;
  });

/**
 * List capacity snapshots for a client over the last N days (default 90).
 * Used by <CapacityDeltasCard /> to compute latest-vs-previous deltas per
 * domain. Auth: trainer-owner OR coached-client (self).
 */
export const listClientCapacitySnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        clientId: z.string().uuid(),
        days: z.number().int().min(1).max(3650).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { clientId } = data;
    const days = data.days ?? 90;

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id, user_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) throw new Error("Client not found");
    const isTrainer = client.trainer_id === userId;
    const isSelf = client.user_id === userId;
    if (!isTrainer && !isSelf) throw new Error("Unauthorized");

    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: snaps, error } = await supabaseAdmin
      .from("client_capacity_snapshots")
      .select(
        "domain_slug, measured_at, raw_value, raw_unit, normalized_score, test_used",
      )
      .eq("client_id", clientId)
      .gte("measured_at", since)
      .order("measured_at", { ascending: false });
    if (error) throw error;

    return { snapshots: snaps ?? [] };
  });

/**
 * Reassessment reminders for a client.
 *
 * For each capacity domain, computes the effective cadence (per-client
 * override OR domain default), looks up the most recent snapshot, and
 * returns the domains that are overdue or have never been measured.
 *
 * Sorted most-overdue first. Capped at the caller (UI shows top 3).
 * Auth: trainer-owner OR coached-client (self).
 */
export const getClientReassessmentReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ clientId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { clientId } = data;

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id, user_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) throw new Error("Client not found");
    const isTrainer = client.trainer_id === userId;
    const isSelf = client.user_id === userId;
    if (!isTrainer && !isSelf) throw new Error("Unauthorized");

    const [{ data: domains }, { data: overrides }, { data: snaps }] =
      await Promise.all([
        supabaseAdmin
          .from("capacity_domains")
          .select("slug, name_key, tier, display_order, default_cadence_days")
          .order("display_order", { ascending: true }),
        supabaseAdmin
          .from("client_measurement_cadence")
          .select("domain_slug, interval_days")
          .eq("client_id", clientId),
        supabaseAdmin
          .from("client_capacity_snapshots")
          .select("domain_slug, measured_at")
          .eq("client_id", clientId)
          .order("measured_at", { ascending: false }),
      ]);

    const overrideBySlug = new Map<string, number>();
    for (const o of overrides ?? []) overrideBySlug.set(o.domain_slug, o.interval_days);

    const latestBySlug = new Map<string, string>();
    for (const s of snaps ?? []) {
      if (!latestBySlug.has(s.domain_slug)) latestBySlug.set(s.domain_slug, s.measured_at);
    }

    const now = Date.now();
    const reminders = (domains ?? [])
      .map((d) => {
        const effective_cadence = overrideBySlug.get(d.slug) ?? d.default_cadence_days;
        const last = latestBySlug.get(d.slug);
        if (!last) {
          return {
            domain_slug: d.slug,
            name_key: d.name_key,
            tier: d.tier,
            effective_cadence,
            never_measured: true,
            days_overdue: null as number | null,
          };
        }
        const ageDays = Math.floor((now - new Date(last).getTime()) / 86_400_000);
        const overdue = ageDays - effective_cadence;
        if (overdue < 0) return null;
        return {
          domain_slug: d.slug,
          name_key: d.name_key,
          tier: d.tier,
          effective_cadence,
          never_measured: false,
          days_overdue: overdue,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        // never-measured first, then most-overdue first
        if (a.never_measured && !b.never_measured) return -1;
        if (!a.never_measured && b.never_measured) return 1;
        return (b.days_overdue ?? 0) - (a.days_overdue ?? 0);
      });

    return { reminders };
  });

/**
 * List effective re-measurement cadences (per-domain override + default)
 * for a client. Used by the cadence override sheet.
 */
export const listClientCadences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ clientId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { clientId } = data;

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) throw new Error("Client not found");
    if (client.trainer_id !== userId) throw new Error("Unauthorized");

    const [{ data: domains }, { data: overrides }] = await Promise.all([
      supabaseAdmin
        .from("capacity_domains")
        .select("slug, name_key, tier, display_order, default_cadence_days")
        .order("display_order", { ascending: true }),
      supabaseAdmin
        .from("client_measurement_cadence")
        .select("domain_slug, interval_days")
        .eq("client_id", clientId),
    ]);

    const overrideBySlug = new Map<string, number>();
    for (const o of overrides ?? []) overrideBySlug.set(o.domain_slug, o.interval_days);

    const rows = (domains ?? []).map((d) => ({
      domain_slug: d.slug,
      name_key: d.name_key,
      tier: d.tier,
      default_days: d.default_cadence_days,
      override_days: overrideBySlug.get(d.slug) ?? null,
      effective_days: overrideBySlug.get(d.slug) ?? d.default_cadence_days,
    }));

    return { rows };
  });

/**
 * Upsert a per-client per-domain cadence override, or clear it (when
 * `intervalDays` is null) so the domain default applies again.
 */
export const upsertClientCadence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        clientId: z.string().uuid(),
        domainSlug: z.string().min(1),
        intervalDays: z.number().int().min(7).max(90).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!client) throw new Error("Client not found");
    if (client.trainer_id !== userId) throw new Error("Unauthorized");

    if (data.intervalDays === null) {
      const { error } = await supabaseAdmin
        .from("client_measurement_cadence")
        .delete()
        .eq("client_id", data.clientId)
        .eq("domain_slug", data.domainSlug);
      if (error) throw error;
      return { ok: true, cleared: true };
    }

    const { error } = await supabaseAdmin
      .from("client_measurement_cadence")
      .upsert({
        client_id: data.clientId,
        domain_slug: data.domainSlug,
        interval_days: data.intervalDays,
        set_by: userId,
      }, { onConflict: "client_id,domain_slug" });
    if (error) throw error;
    return { ok: true, cleared: false };
  });