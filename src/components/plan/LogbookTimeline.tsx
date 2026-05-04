import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Sparkles, Check, MinusCircle, XCircle, NotebookPen } from "lucide-react";
import { toneChip, toneDot, type Tone } from "@/lib/status-tone";
import { epley } from "@/lib/capacity-gain";
import { Confetti } from "@/components/log/Confetti";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { markSessionsCelebrated } from "@/server/sessions.functions";

/**
 * LogbookTimeline — agrupa as sessões registadas por semana e narra a
 * progressão. Cada semana é colapsável; cada sessão mostra adesão visual,
 * RPE médio e PR badge quando algum exercício atingiu o seu maior e1RM
 * histórico dentro deste plano.
 */

type Session = {
  id: string;
  week_number: number;
  day_label: string;
  session_date: string;
  status?: string | null;
  session_notes?: string | null;
  entries?: any[] | null;
  pr_celebrated_at?: string | null;
  plan_data_version?: number | null;
};

type Props = { sessions: Session[]; currentPlanVersion?: number };

const STATUS_TONE: Record<string, Tone> = {
  done: "success",
  partial: "warn",
  missed: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  done: "Feita",
  partial: "Parcial",
  missed: "Falhada",
};

function bestE1rm(entry: any): { name: string; e1rm: number } | null {
  const name = String(entry?.exercise_name ?? entry?.name ?? "").trim();
  if (!name) return null;
  const sets: any[] = Array.isArray(entry?.sets) ? entry.sets : [];
  let best = 0;
  for (const s of sets) {
    const w = Number(s?.weight ?? 0);
    const r = Number(s?.reps ?? 0);
    const v = epley(w, r);
    if (v && v > best) best = v;
  }
  // also try actual.weight × actual.reps
  if (!best) {
    const w = Number(String(entry?.actual?.weight ?? "").match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);
    const r = Number(String(entry?.actual?.reps ?? "").match(/(\d+)/)?.[0] ?? 0);
    const v = epley(w, r);
    if (v) best = v;
  }
  return best > 0 ? { name, e1rm: best } : null;
}

function avgSessionRpe(s: Session): number | null {
  const all: number[] = [];
  for (const e of s.entries ?? []) {
    for (const set of (e?.sets ?? [])) {
      const r = Number(set?.rpe);
      if (Number.isFinite(r)) all.push(r);
    }
    const a = Number(String(e?.actual?.rpe ?? "").match(/(\d+(?:\.\d+)?)/)?.[1] ?? NaN);
    if (Number.isFinite(a)) all.push(a);
  }
  return all.length ? Number((all.reduce((x, y) => x + y, 0) / all.length).toFixed(1)) : null;
}

export function LogbookTimeline({ sessions, currentPlanVersion = 1 }: Props) {
  const { t, i18n } = useTranslation("common");
  const markCelebratedFn = useServerFn(markSessionsCelebrated);
  // Segregate sessions logged against an older version of the plan
  // (regen-with-feedback bumps plan_data_version on workout_plans).
  const liveSessions = useMemo(
    () => sessions.filter((s) => (s.plan_data_version ?? 1) >= currentPlanVersion),
    [sessions, currentPlanVersion],
  );
  const archivedSessions = useMemo(
    () => sessions.filter((s) => (s.plan_data_version ?? 1) < currentPlanVersion),
    [sessions, currentPlanVersion],
  );
  // PRs: best e1RM per exercise across the whole plan; mark the session that hit it.
  const prSessionByExercise = useMemo(() => {
    const best = new Map<string, { e1rm: number; sessionId: string }>();
    for (const s of liveSessions) {
      for (const e of s.entries ?? []) {
        const r = bestE1rm(e);
        if (!r) continue;
        const cur = best.get(r.name);
        if (!cur || r.e1rm > cur.e1rm) best.set(r.name, { e1rm: r.e1rm, sessionId: s.id });
      }
    }
    const sessionToPRs = new Map<string, string[]>();
    for (const [name, v] of best.entries()) {
      const arr = sessionToPRs.get(v.sessionId) ?? [];
      arr.push(name);
      sessionToPRs.set(v.sessionId, arr);
    }
    return sessionToPRs;
  }, [liveSessions]);

  // Surface PRs with a one-shot confetti + toast per session id (per mount).
  const seenRef = useRef<Set<string>>(new Set());
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    let fired = false;
    const toMark: string[] = [];
    for (const [sessionId, names] of prSessionByExercise.entries()) {
      if (seenRef.current.has(sessionId)) continue;
      seenRef.current.add(sessionId);
      // Skip if this session was already celebrated (DB) or in this browser (LS fallback).
      const session = liveSessions.find((s) => s.id === sessionId);
      if (session?.pr_celebrated_at) continue;
      const lsKey = `pr_celebrated:${sessionId}`;
      if (typeof window !== "undefined" && window.localStorage.getItem(lsKey)) continue;
      if (typeof window !== "undefined") window.localStorage.setItem(lsKey, "1");
      toMark.push(sessionId);
      if (!fired) {
        setBurst((n) => n + 1);
        fired = true;
      }
      const head = names.slice(0, 2).join(", ");
      const msg = names.length > 2
        ? t("logbook.pr_toast_more", { names: head, rest: names.length - 2 })
        : t("logbook.pr_toast", { names: head });
      toast.success(msg, { description: t("logbook.pr_desc") });
    }
    if (toMark.length > 0) {
      void markCelebratedFn({ data: { session_ids: toMark } }).catch(() => {
        // Soft-fail: localStorage already prevents replay this browser.
      });
    }
  }, [prSessionByExercise, liveSessions, markCelebratedFn, t]);

  const weeks = useMemo(() => {
    const map = new Map<number, Session[]>();
    for (const s of liveSessions) {
      const arr = map.get(s.week_number) ?? [];
      arr.push(s);
      map.set(s.week_number, arr);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([wk, list]) => ({
        wk,
        list: list.sort((a, b) => a.session_date.localeCompare(b.session_date)),
      }));
  }, [liveSessions]);

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        {t("logbook.empty")}
      </div>
    );
  }

  const archivedBlock = archivedSessions.length > 0 ? (
    <details className="rounded-xl border border-amber-500/30 bg-amber-500/5">
      <summary className="flex cursor-pointer items-center gap-2 p-3 text-xs text-amber-200">
        <ChevronDown className="h-4 w-4 -rotate-90 group-open:rotate-0 transition-transform" />
        <span className="font-semibold">
          {archivedSessions.length} session{archivedSessions.length === 1 ? "" : "s"} from a previous version of this plan
        </span>
      </summary>
      <div className="border-t border-amber-500/20 p-2 space-y-1 text-[11px] text-muted-foreground">
        {archivedSessions
          .sort((a, b) => b.session_date.localeCompare(a.session_date))
          .map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-1">
              <span className="truncate">W{s.week_number} · {s.day_label}</span>
              <span className="tabular-nums">
                {new Date(s.session_date).toLocaleDateString(i18n.language === "pt" ? "pt-PT" : "en-US", { day: "2-digit", month: "short" })}
              </span>
            </div>
          ))}
        <p className="px-2 pt-1 italic">
          These were logged before the plan was redesigned. The exercises no longer match — kept here for history.
        </p>
      </div>
    </details>
  ) : null;

  return (
    <section className="space-y-3">
      {burst > 0 && <Confetti key={burst} />}
      <header className="flex items-center gap-2">
        <NotebookPen className="h-4 w-4 text-accent" />
        <h2 className="text-base font-bold tracking-tight">{t("logbook.title")}</h2>
        <span className="text-[11px] text-muted-foreground">
          {t("logbook.sessions_count", { n: sessions.length })}
        </span>
      </header>
      <div className="space-y-2">
        {archivedBlock}
        {weeks.map(({ wk, list }) => {
          const done = list.filter((s) => s.status === "done").length;
          const partial = list.filter((s) => s.status === "partial").length;
          const adherence = list.length > 0 ? Math.round(((done + partial * 0.5) / list.length) * 100) : 0;
          const rpes = list.map(avgSessionRpe).filter((x): x is number => x != null);
          const avgRpe = rpes.length ? Number((rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1)) : null;
          const adhTone: Tone = adherence >= 80 ? "success" : adherence >= 50 ? "warn" : "danger";
          const hasPR = list.some((s) => prSessionByExercise.has(s.id));
          return (
            <details key={wk} open={wk === weeks[weeks.length - 1].wk} className="group rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3 text-sm">
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-0 -rotate-90" />
                <span className="font-semibold">{t("logbook.week", { n: wk })}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("logbook.done_of", { done, total: list.length })}
                </span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${toneChip(adhTone)}`}>
                  {adherence}%
                </span>
                {avgRpe != null && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">RPE {avgRpe}</span>
                )}
                {hasPR && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                    <Sparkles className="h-3 w-3" /> {t("logbook.pr_short")}
                  </span>
                )}
              </summary>
              <div className="border-t border-border/50 p-2">
                {list.map((s) => (
                  <SessionRow key={s.id} session={s} prs={prSessionByExercise.get(s.id) ?? []} t={t} lang={i18n.language} />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function SessionRow({ session, prs, t, lang }: { session: Session; prs: string[]; t: (k: string, o?: any) => string; lang: string }) {
  const [open, setOpen] = useState(false);
  const status = (session.status ?? "done") as keyof typeof STATUS_TONE;
  const tone = STATUS_TONE[status] ?? "neutral";
  const rpe = avgSessionRpe(session);
  const Icon = status === "done" ? Check : status === "partial" ? MinusCircle : XCircle;
  return (
    <div className="rounded-lg px-2 py-1.5 hover:bg-secondary/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left text-sm"
      >
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${toneChip(tone)}`}>
          <Icon className="h-3 w-3" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{session.day_label}</span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(session.session_date).toLocaleDateString(lang === "pt" ? "pt-PT" : "en-US", { day: "2-digit", month: "short" })}
            </span>
            {prs.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                <Sparkles className="h-3 w-3" /> {t("logbook.pr_count", { n: prs.length })}
              </span>
            )}
          </div>
          {session.session_notes && !open && (
            <p className="truncate text-[11px] italic text-muted-foreground">{session.session_notes}</p>
          )}
        </div>
        {rpe != null && (
          <span className="text-[11px] tabular-nums text-muted-foreground">RPE {rpe}</span>
        )}
        <span className={`text-[10px] font-semibold ${toneDot(tone)} h-1.5 w-1.5 rounded-full`} />
      </button>
      {open && (
        <div className="mt-2 space-y-1 rounded-md border border-border/60 bg-background/40 p-2 text-xs">
          {(session.entries ?? []).length === 0 ? (
            <p className="text-muted-foreground">{t("logbook.no_detail")}</p>
          ) : (
            (session.entries ?? []).map((e: any, i: number) => {
              const isPR = prs.includes(String(e?.exercise_name ?? e?.name ?? "").trim());
              const sets = Array.isArray(e?.sets) ? e.sets : [];
              return (
                <div key={i} className="flex items-start justify-between gap-2 border-b border-border/40 py-1 last:border-0">
                  <div className="min-w-0">
                    <span className="font-medium">{e?.exercise_name ?? e?.name ?? t("logbook.exercise_fallback")}</span>
                    {isPR && (
                      <Sparkles className="ml-1 inline h-3 w-3 text-amber-300" />
                    )}
                  </div>
                  <div className="text-right text-[11px] tabular-nums text-muted-foreground">
                    {sets.length > 0
                      ? sets
                          .map((s: any) => `${s.weight ?? "—"}×${s.reps ?? "—"}`)
                          .join(" · ")
                      : `${e?.actual?.sets ?? "—"}×${e?.actual?.reps ?? "—"} @ ${e?.actual?.weight ?? "—"}`}
                  </div>
                </div>
              );
            })
          )}
          {session.session_notes && (
            <p className="pt-1 text-[11px] italic text-muted-foreground">"{session.session_notes}"</p>
          )}
        </div>
      )}
    </div>
  );
}

export default LogbookTimeline;