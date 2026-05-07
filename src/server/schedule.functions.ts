import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * My Schedule — weekly bookings + per-client packs (revenue tracker).
 *
 * Trainer-only for now. Individual-user mode is deferred to a later round
 * and will be modeled as "trainer-of-self" so we can reuse this schema.
 */

const SessionType = z.enum(["in_person", "online"]);
const BookingStatus = z.enum(["scheduled", "done", "cancelled", "no_show"]);
const PackColor = z.enum([
  "emerald",
  "amber",
  "blue",
  "violet",
  "rose",
  "cyan",
  "orange",
  "lime",
]);

function isoDate(d: Date) {
  return d.toISOString();
}

function weekRange(weekStartIso: string) {
  const start = new Date(weekStartIso);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { startIso: isoDate(start), endIso: isoDate(end) };
}

function monthRange(monthStartIso: string) {
  const start = new Date(monthStartIso);
  start.setHours(0, 0, 0, 0);
  start.setDate(1);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function monthRangeFromYM(year: number, month: number) {
  // month is 0-indexed. Pad ±1 day so timezone-shifted starts_at still match.
  const start = new Date(Date.UTC(year, month, 1));
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(Date.UTC(year, month + 1, 1));
  end.setUTCDate(end.getUTCDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

const PALETTE = ["emerald","amber","blue","violet","rose","cyan","orange","lime"] as const;

export const setClientColor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid(), color: PackColor }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    const { error } = await sb
      .from("clients")
      .update({ color: data.color })
      .eq("id", data.clientId)
      .eq("trainer_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---------- Bookings ----------

export const listWeekBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ weekStart: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context; const sb = supabase as any;
    const { startIso, endIso } = weekRange(data.weekStart);
    const { data: rows, error } = await sb
      .from("client_bookings")
      .select(
        "id, client_id, pack_id, starts_at, duration_min, session_type, status, notes",
      )
      .gte("starts_at", startIso)
      .lt("starts_at", endIso)
      .order("starts_at", { ascending: true });
    if (error) return { ok: false as const, error: error.message, rows: [] };
    return { ok: true as const, rows: rows ?? [] };
  });

export const listMonthBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      monthStart: z.string().optional(),
      year: z.number().int().optional(),
      month: z.number().int().min(0).max(11).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context; const sb = supabase as any;
    const { startIso, endIso } =
      typeof data.year === "number" && typeof data.month === "number"
        ? monthRangeFromYM(data.year, data.month)
        : monthRange(data.monthStart ?? new Date().toISOString());
    const { data: rows, error } = await sb
      .from("client_bookings")
      .select("id, client_id, pack_id, starts_at, duration_min, session_type, status, notes")
      .gte("starts_at", startIso)
      .lt("starts_at", endIso)
      .order("starts_at", { ascending: true });
    if (error) return { ok: false as const, error: error.message, rows: [] };
    return { ok: true as const, rows: rows ?? [] };
  });

export const seedPackBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    packId: z.string().uuid(),
    slots: z.array(z.object({ dow: z.number().int().min(0).max(6), hhmm: z.string() })).min(1).max(14),
    durationMin: z.number().int().min(5).max(480).default(60),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    const { data: pack, error: perr } = await sb
      .from("client_packs")
      .select("id, client_id, session_type, pack_size, start_date")
      .eq("id", data.packId)
      .eq("trainer_id", userId)
      .maybeSingle();
    if (perr || !pack) return { ok: false as const, error: perr?.message ?? "not_found", created: 0, conflicts: 0 };
    const startDate = new Date((pack as any).start_date + "T00:00:00");
    // First Monday-anchored slot date for each slot dow:
    const baseDates = data.slots.map((s) => {
      const d = new Date(startDate);
      const offset = (s.dow - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + offset);
      const [hh, mm] = s.hhmm.split(":").map((n) => parseInt(n, 10));
      d.setHours(hh || 9, mm || 0, 0, 0);
      return d;
    });
    const total = (pack as any).pack_size as number;
    const sessionsPerWeek = data.slots.length;
    const weeks = Math.ceil(total / sessionsPerWeek);
    let created = 0;
    let conflicts = 0;
    for (let w = 0; w < weeks; w++) {
      for (let i = 0; i < data.slots.length; i++) {
        if (created >= total) break;
        const dt = new Date(baseDates[i]);
        dt.setDate(dt.getDate() + 7 * w);
        const iso = dt.toISOString();
        // conflict check
        const { data: existing } = await sb
          .from("client_bookings")
          .select("id")
          .eq("trainer_id", userId)
          .eq("client_id", (pack as any).client_id)
          .eq("starts_at", iso)
          .maybeSingle();
        if (existing) { conflicts++; continue; }
        const { error } = await sb.from("client_bookings").insert({
          trainer_id: userId,
          client_id: (pack as any).client_id,
          pack_id: data.packId,
          starts_at: iso,
          duration_min: data.durationMin,
          session_type: (pack as any).session_type,
          status: "scheduled",
        });
        if (error) { conflicts++; continue; }
        created++;
      }
    }
    return { ok: true as const, created, conflicts };
  });

export const listPackMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ packIds: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    if (data.packIds.length === 0) return { ok: true as const, rows: [] as any[] };
    const { data: rows, error } = await sb
      .from("pack_members")
      .select("pack_id, client_id, primary_payer, position")
      .in("pack_id", data.packIds)
      .eq("trainer_id", userId);
    if (error) return { ok: false as const, error: error.message, rows: [] };
    return { ok: true as const, rows: rows ?? [] };
  });

export const setPackMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    packId: z.string().uuid(),
    memberIds: z.array(z.string().uuid()).min(1),
    payerId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    // Verify ownership
    const { data: pack } = await sb.from("client_packs").select("id").eq("id", data.packId).eq("trainer_id", userId).maybeSingle();
    if (!pack) return { ok: false as const, error: "not_found" };
    await sb.from("pack_members").delete().eq("pack_id", data.packId).eq("trainer_id", userId);
    const rows = data.memberIds.map((cid, idx) => ({
      pack_id: data.packId,
      client_id: cid,
      trainer_id: userId,
      primary_payer: cid === data.payerId,
      position: idx,
    }));
    const { error } = await sb.from("pack_members").insert(rows);
    if (error) return { ok: false as const, error: error.message };
    // Sync client_packs.client_id to payer for compat
    await sb.from("client_packs").update({ client_id: data.payerId }).eq("id", data.packId).eq("trainer_id", userId);
    return { ok: true as const };
  });

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        packId: z.string().uuid().optional().nullable(),
        startsAt: z.string(),
        durationMin: z.number().int().min(5).max(480).default(60),
        sessionType: SessionType.default("in_person"),
        notes: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    const { data: row, error } = await sb
      .from("client_bookings")
      .insert({
        trainer_id: userId,
        client_id: data.clientId,
        pack_id: data.packId ?? null,
        starts_at: data.startsAt,
        duration_min: data.durationMin,
        session_type: data.sessionType,
        status: "scheduled",
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: (row as any).id as string };
  });

export const updateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        startsAt: z.string().optional(),
        durationMin: z.number().int().min(5).max(480).optional(),
        sessionType: SessionType.optional(),
        status: BookingStatus.optional(),
        notes: z.string().max(500).nullable().optional(),
        packId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    const patch: Record<string, any> = {};
    if (data.startsAt !== undefined) patch.starts_at = data.startsAt;
    if (data.durationMin !== undefined) patch.duration_min = data.durationMin;
    if (data.sessionType !== undefined) patch.session_type = data.sessionType;
    if (data.status !== undefined) patch.status = data.status;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.packId !== undefined) patch.pack_id = data.packId;
    const { error } = await sb
      .from("client_bookings")
      .update(patch)
      .eq("id", data.id)
      .eq("trainer_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    const { error } = await sb
      .from("client_bookings")
      .delete()
      .eq("id", data.id)
      .eq("trainer_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const duplicateBookingNextWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    const { data: src, error } = await sb
      .from("client_bookings")
      .select("client_id, pack_id, starts_at, duration_min, session_type, notes")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !src) return { ok: false as const, error: error?.message ?? "not found" };
    const next = new Date((src as any).starts_at);
    next.setDate(next.getDate() + 7);
    const { data: row, error: insErr } = await sb
      .from("client_bookings")
      .insert({
        trainer_id: userId,
        client_id: (src as any).client_id,
        pack_id: (src as any).pack_id,
        starts_at: next.toISOString(),
        duration_min: (src as any).duration_min,
        session_type: (src as any).session_type,
        status: "scheduled",
        notes: (src as any).notes,
      })
      .select("id")
      .single();
    if (insErr) return { ok: false as const, error: insErr.message };
    return { ok: true as const, id: (row as any).id as string };
  });

// ---------- Packs ----------

export const listPacks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ activeOnly: z.boolean().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context; const sb = supabase as any;
    let q = sb
      .from("client_packs")
      .select(
        "id, client_id, label, session_type, price_per_session_eur, pack_size, sessions_used, weekly_frequency, start_date, color, archived, created_at",
      )
      .order("created_at", { ascending: false });
    if (data.activeOnly) q = q.eq("archived", false);
    const { data: rows, error } = await q;
    if (error) return { ok: false as const, error: error.message, rows: [] };
    return { ok: true as const, rows: rows ?? [] };
  });

export const upsertPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        clientId: z.string().uuid(),
        label: z.string().min(1).max(120),
        sessionType: SessionType,
        pricePerSessionEur: z.number().min(0).max(10000),
        packSize: z.number().int().min(1).max(500),
        weeklyFrequency: z.number().int().min(0).max(14),
        startDate: z.string(),
        color: PackColor,
        sessionsUsed: z.number().int().min(0).max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    const payload: Record<string, any> = {
      trainer_id: userId,
      client_id: data.clientId,
      label: data.label,
      session_type: data.sessionType,
      price_per_session_eur: data.pricePerSessionEur,
      pack_size: data.packSize,
      weekly_frequency: data.weeklyFrequency,
      start_date: data.startDate,
      color: data.color,
    };
    if (data.sessionsUsed !== undefined) {
      // Clamp to [0, packSize] so we never end up with negative remaining.
      payload.sessions_used = Math.max(0, Math.min(data.sessionsUsed, data.packSize));
    }
    if (data.id) {
      const { error } = await sb
        .from("client_packs")
        .update(payload)
        .eq("id", data.id)
        .eq("trainer_id", userId);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, id: data.id };
    }
    const { data: row, error } = await sb
      .from("client_packs")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: (row as any).id as string };
  });

export const archivePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    const { error } = await sb
      .from("client_packs")
      .update({ archived: data.archived })
      .eq("id", data.id)
      .eq("trainer_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---------- Demo seed (Phase 1) ----------

export const seedScheduleDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context; const sb = supabase as any;
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("trainer_id", userId)
      .limit(2);
    if (!clients || clients.length === 0) {
      return { ok: false as const, error: "no_clients" };
    }
    const palette = ["emerald", "amber", "blue", "violet"] as const;
    const monday = new Date();
    const day = monday.getDay() || 7; // 1..7
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - (day - 1));
    const created: string[] = [];
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i] as any;
      const { data: pack } = await sb
        .from("client_packs")
        .insert({
          trainer_id: userId,
          client_id: c.id,
          label: `Pack 10 · ${c.full_name?.split(" ")[0] ?? "Cliente"}`,
          session_type: i % 2 === 0 ? "in_person" : "online",
          price_per_session_eur: i % 2 === 0 ? 30 : 25,
          pack_size: 10,
          weekly_frequency: 2,
          start_date: monday.toISOString().slice(0, 10),
          color: palette[i % palette.length],
        })
        .select("id")
        .single();
      if (!pack) continue;
      // 2 bookings this week per client
      const slots = i === 0 ? [[1, 7], [3, 7]] : [[1, 18], [4, 18]];
      for (const [dow, hour] of slots) {
        const t = new Date(monday);
        t.setDate(monday.getDate() + dow);
        t.setHours(hour, 0, 0, 0);
        const { data: b } = await sb
          .from("client_bookings")
          .insert({
            trainer_id: userId,
            client_id: c.id,
            pack_id: (pack as any).id,
            starts_at: t.toISOString(),
            duration_min: 60,
            session_type: i % 2 === 0 ? "in_person" : "online",
            status: "scheduled",
          })
          .select("id")
          .single();
        if (b) created.push((b as any).id);
      }
    }
    return { ok: true as const, count: created.length };
  });