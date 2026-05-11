import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listWeekBookings, listPacks } from "@/server/schedule.functions";
import { startOfIsoWeek, addDays, fmtWeekRange, packBlockClasses, type Pack, type Booking } from "@/lib/schedule";
import { ClientAvatar } from "@/components/ClientAvatar";
import { PriceTag } from "@/components/PriceTag";
import { daysUntilBirthday, turningAge } from "@/lib/birthdays";
import { Cake, Coins, AlertCircle, Clock, MessageCircle, Sparkles, ArrowRight, Eye, EyeOff } from "lucide-react";
import { MessageComposerSheet, type ComposerKind, type ComposerCtx } from "./MessageComposerSheet";

/**
 * CoachCockpit — the room a coach walks into.
 *
 * Composes 4 panels above the existing clients list:
 *   1. Hero strip: week range · sessions · expected income
 *   2. Mini week timetable (read-only, click → /schedule)
 *   3. Relationship nudges (birthdays, pack ending, stale clients) with
 *      one-click "Compor mensagem" → MessageComposerSheet
 *   4. Clients pulse — avatar grid (top 12 by recent activity)
 *
 * Reuses every existing query + lib. Zero migration, zero AI.
 */

type ClientLite = {
  id: string;
  full_name: string;
  photo_url: string | null;
  phone: string | null;
  date_of_birth: string | null;
  intake_status: string;
};

const HOURS_START = 7;
const HOURS_END = 22; // exclusive

export function CoachCockpit({ clients }: { clients: ClientLite[] }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const lang = i18n.language.startsWith("pt") ? "pt" : "en";

  const monday = useMemo(() => startOfIsoWeek(new Date()), []);
  const mondayIso = monday.toISOString();

  const listWeek = useServerFn(listWeekBookings);
  const listPacksFn = useServerFn(listPacks);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [latestPlanByClient, setLatestPlanByClient] = useState<Record<string, { id: string; status: string }>>({});
  const [revealRevenue, setRevealRevenue] = useState<boolean>(false);
  useEffect(() => {
    try { setRevealRevenue(localStorage.getItem("schedule:revealRevenue") === "1"); } catch {}
  }, []);
  const toggleRevenue = () => {
    setRevealRevenue((v) => {
      const n = !v;
      try { localStorage.setItem("schedule:revealRevenue", n ? "1" : "0"); } catch {}
      return n;
    });
  };

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [bw, pk] = await Promise.all([
        listWeek({ data: { weekStart: mondayIso } }),
        listPacksFn({ data: { activeOnly: true } }),
      ]);
      setBookings(((bw as any)?.rows ?? []) as Booking[]);
      setPacks(((pk as any)?.rows ?? []) as Pack[]);
    })();
  }, [user, mondayIso, listWeek, listPacksFn]);

  // Pull latest plan per client (status only) — used for "Today" signals
  useEffect(() => {
    if (!user || clients.length === 0) return;
    void (async () => {
      const ids = clients.map((c) => c.id);
      const { data } = await supabase
        .from("workout_plans")
        .select("id, client_id, status, updated_at")
        .in("client_id", ids)
        .order("updated_at", { ascending: false });
      const out: Record<string, { id: string; status: string }> = {};
      for (const r of (data ?? []) as Array<{ id: string; client_id: string; status: string }>) {
        if (!out[r.client_id]) out[r.client_id] = { id: r.id, status: r.status };
      }
      setLatestPlanByClient(out);
    })();
  }, [user, clients]);

  // Aggregate revenue: sum priced bookings (use pack price when linked)
  const expectedIncome = useMemo(() => {
    const priceByPack = new Map(packs.map((p) => [p.id, Number(p.price_per_session_eur || 0)]));
    let sum = 0;
    for (const b of bookings) {
      if (b.status === "cancelled" || b.status === "no_show") continue;
      sum += priceByPack.get(b.pack_id ?? "") ?? 0;
    }
    return sum;
  }, [bookings, packs]);

  const sessionsCount = bookings.filter((b) => b.status !== "cancelled").length;

  // Pack-color lookup keyed by pack id
  const packColorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of packs) m.set(p.id, p.color);
    return m;
  }, [packs]);

  const clientById = useMemo(() => {
    const m = new Map<string, ClientLite>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  // Group bookings by day-of-week (0..6, Mon=0)
  const bookingsByDay = useMemo(() => {
    const out: Booking[][] = [[], [], [], [], [], [], []];
    for (const b of bookings) {
      const d = new Date(b.starts_at);
      const dow = (d.getDay() || 7) - 1; // Mon=0
      out[dow].push(b);
    }
    return out;
  }, [bookings]);

  // Build nudges
  const [composer, setComposer] = useState<{ kind: ComposerKind; ctx: ComposerCtx } | null>(null);

  type Nudge = {
    key: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: "amber" | "muted" | "rose";
    title: string;
    sub?: string;
    clientId: string;
    composeKind: ComposerKind;
    composeCtx: ComposerCtx;
  };

  const nudges = useMemo<Nudge[]>(() => {
    const items: Nudge[] = [];
    for (const c of clients) {
      const d = daysUntilBirthday(c.date_of_birth);
      if (d !== null && d <= 14) {
        const age = turningAge(c.date_of_birth);
        items.push({
          key: `bd-${c.id}`,
          icon: Cake,
          tone: "amber",
          title:
            d === 0
              ? lang === "pt" ? `${c.full_name} faz anos hoje` : `${c.full_name}'s birthday is today`
              : d === 1
                ? lang === "pt" ? `${c.full_name} faz anos amanhã` : `${c.full_name}'s birthday is tomorrow`
                : lang === "pt" ? `${c.full_name} faz anos em ${d} dias` : `${c.full_name}'s birthday in ${d} days`,
          sub: age ? (lang === "pt" ? `Faz ${age}` : `Turning ${age}`) : undefined,
          clientId: c.id,
          composeKind: "birthday",
          composeCtx: { name: c.full_name, phone: c.phone, age },
        });
      }
    }
    // Pack ending
    for (const p of packs) {
      const left = Math.max(0, p.pack_size - p.sessions_used);
      if (left > 0 && left <= 2) {
        const c = clientById.get(p.client_id);
        if (!c) continue;
        items.push({
          key: `pack-${p.id}`,
          icon: AlertCircle,
          tone: "rose",
          title: lang === "pt" ? `Pack de ${c.full_name} a terminar` : `${c.full_name}'s pack ending`,
          sub: lang === "pt" ? `${left} sessão${left === 1 ? "" : "es"} restante${left === 1 ? "" : "s"}` : `${left} session${left === 1 ? "" : "s"} left`,
          clientId: c.id,
          composeKind: "pack_ending",
          composeCtx: { name: c.full_name, phone: c.phone },
        });
      }
    }
    return items.slice(0, 6);
  }, [clients, packs, clientById, lang]);

  // ---- Today / Needs attention (ranked operational signals) ----
  type TodayRow = {
    key: string;
    text: string;
    name?: string;
    status?: string;
    to: string;
    params?: Record<string, string>;
    tone: "amber" | "emerald" | "rose" | "muted";
  };
  const todayRows = useMemo<TodayRow[]>(() => {
    const rows: TodayRow[] = [];
    for (const c of clients) {
      const plan = latestPlanByClient[c.id];
      // 1. Plan awaiting approval (highest priority — coach action ready)
      if (plan?.status === "ready") {
        rows.push({
          key: `plan-${c.id}`,
          text: t("dashboard.today.plan_awaiting", { name: c.full_name }),
          name: c.full_name,
          status: t("dashboard.today.status.plan_awaiting"),
          to: "/plans/$planId",
          params: { planId: plan.id },
          tone: "amber",
        });
        continue;
      }
      // 2. Ready for protocol (intake submitted, no plan yet)
      if (c.intake_status === "submitted" && !plan) {
        rows.push({
          key: `ready-${c.id}`,
          text: t("dashboard.today.ready_for_protocol", { name: c.full_name }),
          name: c.full_name,
          status: t("dashboard.today.status.ready_for_protocol"),
          to: "/clients/$clientId",
          params: { clientId: c.id },
          tone: "emerald",
        });
        continue;
      }
      // 3. Assessment in progress
      if (c.intake_status === "in_progress" || c.intake_status === "sent") {
        rows.push({
          key: `assess-${c.id}`,
          text: t("dashboard.today.assessment_incomplete", { name: c.full_name }),
          name: c.full_name,
          status: t("dashboard.today.status.assessment_incomplete"),
          to: "/clients/$clientId",
          params: { clientId: c.id },
          tone: "muted",
        });
      }
    }
    // 4. No sessions scheduled this week
    if (clients.length > 0 && bookings.length === 0) {
      rows.push({
        key: "no-sessions",
        text: t("dashboard.today.no_sessions_week"),
        to: "/schedule",
        tone: "amber",
      });
    }
    // 5. One pack ending (top by fewest left)
    const ending = packs
      .map((p) => ({ p, left: Math.max(0, p.pack_size - p.sessions_used) }))
      .filter((x) => x.left > 0 && x.left <= 2)
      .sort((a, b) => a.left - b.left)[0];
    if (ending) {
      const c = clientById.get(ending.p.client_id);
      if (c) {
        rows.push({
          key: `pack-${ending.p.id}`,
          text: t("dashboard.today.pack_ending", { name: c.full_name }),
          name: c.full_name,
          status: t("dashboard.today.status.pack_ending"),
          to: "/clients/$clientId",
          params: { clientId: c.id },
          tone: "rose",
        });
      }
    }
    return rows.slice(0, 5);
  }, [clients, latestPlanByClient, bookings, packs, clientById, t]);

  return (
    <section className="space-y-2">
      {/* Compact cockpit strip + slim week — one bordered surface */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/40">
        {/* Stat strip — 2-col grid on mobile, single horizontal row on sm+ */}
        <div className="grid grid-cols-2 divide-x divide-y divide-border/50 text-xs sm:flex sm:flex-nowrap sm:items-stretch sm:divide-y-0 sm:overflow-x-auto">
          <Stat
            label={t("dashboard.today.title")}
            value={todayRows.length || 0}
            tone={todayRows.some((r) => r.tone === "amber" || r.tone === "rose") ? "amber" : "muted"}
          />
          <Stat
            label={t("dashboard.this_week")}
            value={fmtWeekRange(monday, lang === "pt" ? "pt-PT" : "en-GB")}
            mono={false}
          />
          <Stat
            label={t("dashboard.sessions")}
            value={sessionsCount}
          />
          <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span>{t("dashboard.revenue")}</span>
              <button
                type="button"
                onClick={toggleRevenue}
                aria-label={revealRevenue ? t("dashboard.hide") : t("dashboard.show")}
                className="rounded p-0.5 text-muted-foreground/70 transition hover:text-foreground"
              >
                {revealRevenue ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            </div>
            <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-sm tabular-nums">
              <Coins className="h-3 w-3 text-brand/80" />
              {revealRevenue ? (
                <PriceTag eur={expectedIncome} interactive={false} />
              ) : (
                <span className="tracking-widest text-muted-foreground">•••€</span>
              )}
            </span>
          </div>
          <Stat
            label={t("dashboard.reminders")}
            value={nudges.length}
            tone={nudges.length > 0 ? "amber" : "muted"}
          />
        </div>

        {/* Slim week strip — single row, click → /schedule */}
        <button
          type="button"
          onClick={() => navigate({ to: "/schedule" })}
          className="group flex w-full items-stretch gap-1 border-t border-border/50 bg-background/20 px-2 py-2 text-left transition hover:bg-muted/30"
          aria-label={t("dashboard.open_week_schedule_aria")}
        >
          <SlimWeek
            monday={monday}
            bookingsByDay={bookingsByDay}
            packColorById={packColorById}
            lang={lang}
          />
          <ArrowRight className="ml-1 h-3.5 w-3.5 self-center text-muted-foreground/60 opacity-0 transition group-hover:opacity-100" />
        </button>
      </div>

      {/* Priorities — compact single-line action feed. Today + reminders merged
          into one horizontal list, max 4 items. No second large card. */}
      {(todayRows.length > 0 || nudges.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-[12px]">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("dashboard.priorities")}
          </span>
          <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {todayRows.slice(0, 3).map((r) => {
              const dot =
                r.tone === "amber" ? "bg-brand"
                : r.tone === "emerald" ? "bg-success"
                : r.tone === "rose" ? "bg-warn"
                : "bg-muted-foreground/40";
              const statusText =
                r.tone === "amber" ? "text-brand"
                : r.tone === "emerald" ? "text-success-foreground"
                : r.tone === "rose" ? "text-warn-foreground"
                : "text-muted-foreground";
              return (
                <li key={r.key} className="inline-flex">
                  <Link
                    to={r.to as any}
                    params={r.params as any}
                    className="group/pri inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-chip px-2.5 py-1 transition hover:border-border-strong hover:bg-chip-active"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                    {r.name && r.status ? (
                      <>
                        <span className="font-medium text-foreground">{r.name}</span>
                        <span className="text-muted-foreground/60">·</span>
                        <span className={statusText}>{r.status}</span>
                      </>
                    ) : (
                      <span className={statusText}>{r.text}</span>
                    )}
                    <ArrowRight className="h-3 w-3 text-muted-foreground/60 opacity-0 transition group-hover/pri:opacity-100" />
                  </Link>
                </li>
              );
            })}
            {nudges.slice(0, 2).map((n) => {
              const tone =
                n.tone === "amber"
                  ? "text-brand"
                  : n.tone === "rose"
                    ? "text-warn-foreground"
                    : "text-muted-foreground";
              return (
                <li key={n.key} className="inline-flex">
                  <button
                    type="button"
                    onClick={() => setComposer({ kind: n.composeKind, ctx: n.composeCtx })}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-chip px-2.5 py-1 transition hover:border-border-strong hover:bg-chip-active"
                    title={t("dashboard.compose_message")}
                  >
                    <n.icon className={`h-3 w-3 shrink-0 ${tone}`} />
                    <span className="font-medium text-foreground">{n.title}</span>
                    <MessageCircle className="h-3 w-3 text-muted-foreground/60" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <MessageComposerSheet
        open={!!composer}
        onOpenChange={(o) => !o && setComposer(null)}
        kind={composer?.kind ?? null}
        ctx={composer?.ctx ?? null}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
  mono = true,
}: {
  label: string;
  value: string | number;
  tone?: "muted" | "amber";
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5 sm:px-4">
      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`mt-0.5 truncate text-sm tabular-nums ${mono ? "font-mono" : "font-display font-light"} ${
          tone === "amber" ? "text-brand" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SlimWeek({
  monday,
  bookingsByDay,
  packColorById,
  lang,
}: {
  monday: Date;
  bookingsByDay: Booking[][];
  packColorById: Map<string, string>;
  lang: "pt" | "en";
}) {
  const dayLabels = lang === "pt"
    ? ["S", "T", "Q", "Q", "S", "S", "D"]
    : ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="grid flex-1 grid-cols-7 gap-1">
      {Array.from({ length: 7 }).map((_, dow) => {
        const date = addDays(monday, dow);
        const isToday = date.getTime() === today.getTime();
        const dayBookings = bookingsByDay[dow] ?? [];
        return (
          <div
            key={dow}
            className={`flex items-center justify-between gap-1.5 rounded-md px-2 py-1 text-[11px] ${
              isToday
                ? "bg-selected text-brand"
                : "text-muted-foreground/80"
            }`}
          >
            <span className="flex items-baseline gap-1">
              <span className="font-semibold uppercase tracking-widest">{dayLabels[dow]}</span>
              <span className="font-mono">{String(date.getDate()).padStart(2, "0")}</span>
            </span>
            <span className="flex items-center gap-0.5">
              {dayBookings.slice(0, 3).map((b) => {
                const color = packColorById.get(b.pack_id ?? "") ?? "emerald";
                const cls = packBlockClasses(color);
                return <span key={b.id} className={`inline-block h-1.5 w-1.5 rounded-full ${cls.dot}`} />;
              })}
              {dayBookings.length > 3 && (
                <span className="text-[9px] text-muted-foreground">+{dayBookings.length - 3}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Legacy MiniWeek kept for parity (no longer used in cockpit, but exported
// implicitly via the file). Inline here as dead-code-eliminated stub.
function _MiniWeek_unused({
  monday,
  bookingsByDay,
  clientById,
  packColorById,
  lang,
}: {
  monday: Date;
  bookingsByDay: Booking[][];
  clientById: Map<string, ClientLite>;
  packColorById: Map<string, string>;
  lang: "pt" | "en";
}) {
  const dayLabels = lang === "pt"
    ? ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 7 }).map((_, dow) => {
        const date = addDays(monday, dow);
        const isToday = date.getTime() === today.getTime();
        const dayBookings = bookingsByDay[dow] ?? [];
        return (
          <div
            key={dow}
            className={`flex min-h-[56px] flex-col rounded-md border p-1.5 ${
              isToday
                ? "border-amber-500/40 bg-amber-500/[0.04]"
                : "border-border/50 bg-background/30"
            }`}
          >
            <div className="flex items-baseline justify-between leading-none">
              <span className={`text-[9px] font-semibold uppercase tracking-widest ${isToday ? "text-amber-500" : "text-muted-foreground/70"}`}>
                {dayLabels[dow]}
              </span>
              <span className={`font-mono text-[10px] ${isToday ? "text-foreground" : "text-muted-foreground/70"}`}>
                {String(date.getDate()).padStart(2, "0")}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {dayBookings.slice(0, 4).map((b) => {
                const color = packColorById.get(b.pack_id ?? "") ?? "emerald";
                const cls = packBlockClasses(color);
                const time = new Date(b.starts_at).toLocaleTimeString(lang === "pt" ? "pt-PT" : "en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });
                const c = clientById.get(b.client_id);
                return (
                  <span
                    key={b.id}
                    className={`inline-block h-2 w-2 rounded-full ${cls.dot}`}
                    title={`${time} · ${c?.full_name ?? ""}`}
                  />
                );
              })}
              {dayBookings.length > 4 && (
                <span className="text-[10px] text-muted-foreground">+{dayBookings.length - 4}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
