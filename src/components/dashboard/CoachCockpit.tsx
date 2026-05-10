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
    <section className="space-y-4">
      {/* Today + This week — golden-ratio split on desktop, stacked on mobile */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)]">
      {/* Today / Needs attention */}
      <div className="rounded-2xl bg-muted/40 p-3">
        <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span>{t("dashboard.today.title")}</span>
          <Sparkles className="h-3 w-3 text-amber-500" />
        </div>
        {todayRows.length === 0 ? (
          <p className="px-1 py-3 text-xs text-muted-foreground">
            {t("dashboard.today.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {todayRows.map((r) => {
              const dot =
                r.tone === "amber" ? "bg-amber-500"
                : r.tone === "emerald" ? "bg-emerald-500"
                : r.tone === "rose" ? "bg-rose-500"
                : "bg-muted-foreground/40";
              const statusText =
                r.tone === "amber" ? "text-amber-600 dark:text-amber-400"
                : r.tone === "emerald" ? "text-emerald-600 dark:text-emerald-400"
                : r.tone === "rose" ? "text-rose-600 dark:text-rose-400"
                : "text-muted-foreground";
              return (
                <li key={r.key}>
                  <Link
                    to={r.to as any}
                    params={r.params as any}
                    className="group flex items-center gap-3 py-2 transition hover:text-foreground"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {r.name && r.status ? (
                        <>
                          <span className="font-medium text-foreground">{r.name}</span>
                          <span className="text-muted-foreground/60"> · </span>
                          <span className={statusText}>{r.status}</span>
                        </>
                      ) : (
                        <span className={statusText}>{r.text}</span>
                      )}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Hero strip — tonal separation, single horizontal rhythm on desktop */}
      <div className="rounded-2xl bg-muted/40 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          {/* Left · week (φ smaller side) */}
          <div className="min-w-0 sm:flex-[1]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {lang === "pt" ? "Esta semana" : "This week"}
            </p>
            <p className="mt-0.5 font-display text-xl font-light tracking-tight text-foreground">
              {fmtWeekRange(monday, lang === "pt" ? "pt-PT" : "en-GB")}
              <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
                · {sessionsCount} {lang === "pt" ? "sessões" : "sessions"}
              </span>
            </p>
          </div>
          {/* Right · revenue + CTA (φ heavier side, asymmetric) */}
          <div
            className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:flex-[1.618] sm:justify-end"
            title={t("dashboard.revenue_caption")}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {lang === "pt" ? "Receita" : "Revenue"}
              </span>
              <button
                type="button"
                onClick={toggleRevenue}
                aria-label={revealRevenue ? (lang === "pt" ? "Ocultar valores" : "Hide amounts") : (lang === "pt" ? "Mostrar valores" : "Show amounts")}
                className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
              >
                {revealRevenue ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
              <span className="flex items-center gap-1 font-mono text-base tabular-nums">
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                {revealRevenue ? (
                  <PriceTag eur={expectedIncome} interactive={false} />
                ) : (
                  <span className="tracking-widest text-muted-foreground">•••€</span>
                )}
              </span>
            </div>
            <Link
              to="/schedule"
              className="group inline-flex items-center gap-1 text-xs font-medium text-foreground/80 transition hover:text-foreground"
            >
              {lang === "pt" ? "Agenda" : "Schedule"}
              <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Mini timetable */}
        <button
          type="button"
          onClick={() => navigate({ to: "/schedule" })}
          className="group relative rounded-2xl bg-muted/40 p-3 text-left transition hover:bg-muted/60"
          aria-label={lang === "pt" ? "Abrir agenda da semana" : "Open this week's schedule"}
        >
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>{lang === "pt" ? "Calendário da semana" : "Week timetable"}</span>
            <span className="opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">→</span>
          </div>
          <MiniWeek
            monday={monday}
            bookingsByDay={bookingsByDay}
            clientById={clientById}
            packColorById={packColorById}
            lang={lang}
          />
        </button>

        {/* Nudges */}
        <div className="rounded-2xl bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>{lang === "pt" ? "Lembretes para clientes" : "Client reminders"}</span>
            <span className="text-muted-foreground/60">·</span>
          </div>
          {nudges.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {lang === "pt" ? "Nada pendente. Boa semana." : "Nothing pending. Have a good week."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {nudges.map((n) => {
                const tone =
                  n.tone === "amber"
                    ? "text-amber-600 dark:text-amber-400"
                    : n.tone === "rose"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground";
                return (
                  <li key={n.key} className="flex items-center gap-3 py-2">
                    <n.icon className={`h-4 w-4 shrink-0 ${tone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      {n.sub && <p className="truncate text-[11px] text-muted-foreground">{n.sub}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setComposer({ kind: n.composeKind, ctx: n.composeCtx })}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-secondary"
                      title={lang === "pt" ? "Compor mensagem" : "Compose message"}
                    >
                      <MessageCircle className="h-3 w-3" />
                      {lang === "pt" ? "Mensagem" : "Message"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <MessageComposerSheet
        open={!!composer}
        onOpenChange={(o) => !o && setComposer(null)}
        kind={composer?.kind ?? null}
        ctx={composer?.ctx ?? null}
      />
    </section>
  );
}

function MiniWeek({
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
            className={`flex min-h-[96px] flex-col rounded-lg border bg-background/40 p-1.5 ${
              isToday ? "border-amber-500/50 ring-1 ring-amber-500/20" : "border-border"
            }`}
          >
            <div className="mb-1 flex flex-col items-start leading-tight">
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isToday ? "text-amber-500" : "text-muted-foreground"}`}>
                {dayLabels[dow]}
              </span>
              <span className={`font-mono text-[11px] ${isToday ? "text-foreground" : "text-muted-foreground"}`}>
                {String(date.getDate()).padStart(2, "0")}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
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
