import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, submitCheckin } from "@/server/me.functions";
import { MeShell } from "@/components/me/MeShell";
import { MessageThread } from "@/components/me/MessageThread";
import { BrandMark } from "@/components/BrandMark";
import {
  Loader2,
  CheckCircle2,
  Circle,
  ArrowRight,
  Calendar as CalendarIcon,
  Sparkles,
  MapPin,
  Video,
  Package,
  Moon,
  Zap,
  Activity,
} from "lucide-react";

/**
 * R70 — Casa do cliente (Hoje).
 * Sub-routes: /me/progresso, /me/historico (separate files).
 * Voice: PT "você"; EN neutral.
 */
export const Route = createFileRoute("/me")({
  validateSearch: (s: Record<string, unknown>): { as?: string } => ({
    as: typeof s.as === "string" ? s.as : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: MePage,
});

function MePage() {
  const search = Route.useSearch();
  const load = useServerFn(loadMe);
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    void (async () => setState(await load({ data: { as: search.as ?? null } })))();
  }, [load, search.as]);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.linked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <BrandMark size="md" />
          <h1 className="mt-4 text-2xl font-light">A sua conta ainda não está ligada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Peça ao seu treinador um novo link de questionário e termine o processo nesse separador para ligar a conta.
          </p>
          <Link to="/" className="mt-6 inline-block text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  return <MeToday state={state} reload={async () => setState(await load({ data: { as: search.as ?? null } }))} />;
}

function MeToday({ state, reload }: { state: any; reload: () => Promise<void> }) {
  const { t } = useTranslation("me");
  const search = Route.useSearch();
  const {
    client,
    plan,
    trainer,
    currentWeek,
    weekDays,
    recentSessions,
    upcomingBookings,
    activePacks,
    todayCheckin,
    lastSessionDate,
    unreadCount,
    previewing,
  } = state;

  const doneLabels = useMemo(
    () =>
      new Set<string>(
        (recentSessions ?? [])
          .filter((s: any) => s.week_number === currentWeek)
          .map((s: any) => String(s.day_label || "").toLowerCase()),
      ),
    [recentSessions, currentWeek],
  );
  const doneCount = (weekDays ?? []).filter((d: any) =>
    doneLabels.has(String(d.day_label || "").toLowerCase()),
  ).length;
  const totalDays = (weekDays ?? []).length;
  const todayDay =
    (weekDays ?? []).find(
      (d: any) => !doneLabels.has(String(d.day_label || "").toLowerCase()),
    ) ?? (weekDays ?? [])[0] ?? null;

  const daysSinceLast = lastSessionDate
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(lastSessionDate).getTime()) / 86400000,
        ),
      )
    : null;

  return (
    <MeShell
      client={client}
      trainer={trainer}
      previewing={previewing}
      unreadCount={unreadCount ?? 0}
    >
      {plan ? (
        <PlanCard plan={plan} currentWeek={currentWeek} doneCount={doneCount} totalDays={totalDays} />
      ) : (
        <EmptyPlanTimeline client={client} />
      )}

      {todayDay ? (
        <TodaySessionCard
          day={todayDay}
          plan={plan}
          previewing={previewing}
          daysSinceLast={daysSinceLast}
        />
      ) : null}

      <CheckinCard initial={todayCheckin} previewing={previewing} onSaved={reload} />

      {totalDays > 0 && (
        <WeekCard weekDays={weekDays} doneLabels={doneLabels} currentWeek={currentWeek} />
      )}

      <MessageThread
        clientId={client.id}
        previewing={!!previewing}
        asParam={search.as ?? null}
      />

      {upcomingBookings && upcomingBookings.length > 0 && (
        <BookingsCard bookings={upcomingBookings} />
      )}

      {activePacks && activePacks.length > 0 && <PacksCard packs={activePacks} />}

      {recentSessions && recentSessions.length > 0 && <SessionsCard sessions={recentSessions} />}

      <p className="pt-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground/50">
        {t("footer.soon")}
      </p>
    </MeShell>
  );
}

function PlanCard({ plan, currentWeek, doneCount, totalDays }: any) {
  const { t } = useTranslation("me");
  return (
    <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] via-card to-card p-5 shadow-[0_8px_32px_-12px_rgba(245,158,11,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("plan.title")}</p>
          <h2 className="mt-1 truncate text-lg font-medium">{plan.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("plan.block_week", { block: plan.block_number, current: currentWeek, total: plan.duration_weeks })}
          </p>
          {plan.block_number > 1 && plan.block_transition_summary ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-amber-700 dark:text-amber-300">
              <Sparkles className="h-3 w-3" />
              {t("plan.evolved_from", { block: plan.block_number, prior: plan.block_number - 1 })}
            </p>
          ) : null}
        </div>
        {totalDays > 0 && (
          <div className="shrink-0 rounded-full border border-border bg-background/60 px-3 py-1 text-xs tabular-nums">
            {t("plan.done_count", { done: doneCount, total: totalDays })}
          </div>
        )}
      </div>
      {plan.summary ? <p className="mt-3 text-sm text-muted-foreground">{plan.summary}</p> : null}
    </section>
  );
}

function TodaySessionCard({ day, plan, previewing, daysSinceLast }: any) {
  const { t } = useTranslation("me");
  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.07] via-card to-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            {t("today_session.title")}
          </p>
          <h3 className="mt-1 truncate text-lg font-medium">
            {t("today_session.session", { n: day.day_number })}
            {day.focus ? ` · ${day.focus}` : ""}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {daysSinceLast === null
              ? null
              : daysSinceLast === 0
                ? t("today_session.last_done_today")
                : t("today_session.last_done_days", { days: daysSinceLast })}
          </p>
        </div>
        {plan?.share_token ? (
          <a
            href={previewing ? "#" : `/log/${plan.share_token}`}
            onClick={(e) => {
              if (previewing) e.preventDefault();
            }}
            aria-disabled={previewing}
            title={previewing ? t("preview.disabled_hint") : undefined}
            className={[
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-sm",
              previewing
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-emerald-600 text-white hover:bg-emerald-700",
            ].join(" ")}
          >
            {t("today_session.start")} <ArrowRight className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      {Array.isArray(day.preview) && day.preview.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {day.preview.map((ex: any, i: number) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-2.5 py-1.5 text-[12px]"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{ex.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {ex.sets} × {ex.reps}
              </span>
              {ex.rpe ? (
                <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  RPE {ex.rpe}
                </span>
              ) : null}
            </li>
          ))}
          {day.exercise_count > day.preview.length ? (
            <li className="px-2.5 text-[11px] text-muted-foreground">
              {t("today_session.preview_more", { count: day.exercise_count - day.preview.length })}
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function CheckinCard({
  initial,
  previewing,
  onSaved,
}: {
  initial: any;
  previewing: boolean;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation("me");
  const submit = useServerFn(submitCheckin);
  const [editing, setEditing] = useState(!initial);
  const [sleep, setSleep] = useState<number | null>(initial?.sleep_quality ?? null);
  const [soreness, setSoreness] = useState<number | null>(initial?.soreness_level ?? null);
  const [energy, setEnergy] = useState<number | null>(initial?.energy_level ?? null);
  const [busy, setBusy] = useState(false);

  const sleepLevels = t("checkin.sleep_levels", { returnObjects: true }) as string[];
  const energyLevels = t("checkin.energy_levels", { returnObjects: true }) as string[];

  const save = async () => {
    if (previewing) return;
    setBusy(true);
    try {
      await submit({
        data: { sleep_quality: sleep, soreness_level: soreness, energy_level: energy, notes: null },
      });
      await onSaved();
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  };

  if (!editing && initial) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("checkin.saved")}</p>
            <p className="mt-1 text-sm text-foreground">
              {t("checkin.saved_summary", {
                sleep: initial.sleep_quality ?? "—",
                soreness: initial.soreness_level ?? "—",
                energy: initial.energy_level ?? "—",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={previewing}
            className="shrink-0 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("checkin.edit")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("checkin.title")}</p>
      <p className="mt-1 text-[11px] text-muted-foreground/80">{t("checkin.hint")}</p>

      <Scale icon={<Moon className="h-3.5 w-3.5" />} label={t("checkin.sleep")} value={sleep} onChange={setSleep} levels={sleepLevels} max={5} />
      <Scale icon={<Activity className="h-3.5 w-3.5" />} label={t("checkin.soreness")} value={soreness} onChange={setSoreness} max={10} startAt={0} />
      <Scale icon={<Zap className="h-3.5 w-3.5" />} label={t("checkin.energy")} value={energy} onChange={setEnergy} levels={energyLevels} max={5} />

      <button
        type="button"
        onClick={save}
        disabled={busy || previewing}
        title={previewing ? t("preview.disabled_hint") : undefined}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {t("checkin.submit")}
      </button>
    </section>
  );
}

function Scale({
  icon,
  label,
  value,
  onChange,
  max,
  startAt = 1,
  levels,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  max: number;
  startAt?: number;
  levels?: string[];
}) {
  const items = Array.from({ length: max - startAt + 1 }, (_, i) => startAt + i);
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        {levels && value != null ? (
          <span className="text-[11px] font-medium text-foreground">{levels[value - 1]}</span>
        ) : null}
      </div>
      <div className="grid grid-flow-col gap-1.5">
        {items.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={[
                "h-9 rounded-md border text-xs font-medium tabular-nums transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background/40 text-muted-foreground hover:border-foreground/50",
              ].join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekCard({ weekDays, doneLabels, currentWeek }: any) {
  const { t } = useTranslation("me");
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("week.title")}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
          {t("week.label", { n: currentWeek })}
        </p>
      </div>
      <ul className="space-y-2">
        {weekDays.map((d: any) => {
          const done = doneLabels.has(String(d.day_label || "").toLowerCase());
          return (
            <li
              key={`${d.week_number}-${d.day_number}`}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5"
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {t("week.day", { n: d.day_number })}
                  {d.focus ? <span className="text-muted-foreground"> · {d.focus}</span> : null}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("today_session.exercise_count", { count: d.exercise_count })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TrainerMessageCard({ message, unreadCount }: any) {
  const { t } = useTranslation("me");
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("message.title")}</p>
        {unreadCount > 0 ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
            {unreadCount}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-foreground/90">{message.body}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground/60">
        {new Date(message.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
      </p>
    </section>
  );
}

function BookingsCard({ bookings }: any) {
  const { t } = useTranslation("me");
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "short" }) +
      " · " +
      d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    );
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">{t("bookings.title")}</p>
      <ul className="space-y-2">
        {bookings.map((b: any) => (
          <li key={b.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
            {b.session_type === "online" ? (
              <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{fmt(b.starts_at)}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("bookings.minutes", { n: b.duration_min })} · {b.session_type === "online" ? t("bookings.online") : t("bookings.in_person")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PacksCard({ packs }: any) {
  const { t } = useTranslation("me");
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">{t("packs.title")}</p>
      <ul className="space-y-2">
        {packs.map((p: any) => {
          const remaining = Math.max(0, (p.pack_size ?? 0) - (p.sessions_used ?? 0));
          const pct = p.pack_size > 0 ? Math.round((p.sessions_used / p.pack_size) * 100) : 0;
          return (
            <li key={p.id} className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("packs.remaining", { remaining, total: p.pack_size })}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {p.sessions_used}/{p.pack_size}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-emerald-500/70" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SessionsCard({ sessions }: any) {
  const { t } = useTranslation("me");
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">{t("sessions.title")}</p>
      <ul className="space-y-2">
        {sessions.map((s: any) => (
          <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {t("week.label", { n: s.week_number })} · {s.day_label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(s.session_date).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
              </p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyPlanTimeline({ client }: any) {
  const { t } = useTranslation("me");
  // Heuristic step: 0 intake, 1 assessment, 2 building, 3 ready
  const step =
    client.intake_status === "not_sent" || client.intake_status === "sent"
      ? 0
      : client.intake_status === "submitted"
        ? 1
        : 2;
  const steps = [
    t("empty_plan.step_intake"),
    t("empty_plan.step_assessment"),
    t("empty_plan.step_building"),
    t("empty_plan.step_ready"),
  ];
  return (
    <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] via-card to-card p-5">
      <p className="text-xs uppercase tracking-widest text-amber-700 dark:text-amber-400">
        {t("empty_plan.title")}
      </p>
      <ol className="mt-4 space-y-2">
        {steps.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={[
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums",
                  done
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                    : active
                      ? "border-amber-500 bg-amber-500/15 text-amber-700 ring-2 ring-amber-500/30"
                      : "border-border bg-background/60 text-muted-foreground",
                ].join(" ")}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={active ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{label}</span>
            </li>
          );
        })}
      </ol>
      {client.intake_token && step === 0 ? (
        <a
          href={`/intake/${client.intake_token}`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
        >
          {t("empty_plan.complete_intake")} <ArrowRight className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </section>
  );
}