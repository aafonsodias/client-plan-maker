import { useEffect, useState } from "react";
import { Loader2, Trophy, TrendingUp, TrendingDown, Minus, ArrowRight, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Confetti } from "@/components/log/Confetti";
import { getSessionSummary } from "@/server/sessions.functions";
import { toneChip, toneDot, type Tone } from "@/lib/status-tone";
import type { SessionSummary, ExerciseDelta, DeltaTone } from "@/lib/session-summary";

type Props = {
  token: string;
  sessionId: string;
  withConfetti?: boolean;
  /** Called when user taps "Registar outra sessão". */
  onLogAnother: () => void;
  /** Optional secondary CTA (e.g. back to /me or /clients). */
  secondaryCta?: { label: string; onClick: () => void };
};

function toneFor(t: DeltaTone): Tone {
  // DeltaTone is a strict subset of Tone — pass-through with widening.
  return t;
}

function VerdictIcon({ tone }: { tone: DeltaTone }) {
  if (tone === "success") return <TrendingUp className="h-3.5 w-3.5" />;
  if (tone === "danger") return <TrendingDown className="h-3.5 w-3.5" />;
  if (tone === "warn") return <TrendingDown className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
}

function ExerciseRow({ row }: { row: ExerciseDelta }) {
  const t = toneFor(row.tone);
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {row.is_pr && <Trophy className="mr-1 inline h-3.5 w-3.5 text-amber-500" />}
          {row.exercise_name}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.top_load && row.top_reps
            ? `${row.top_load} kg × ${row.top_reps}${row.avg_rpe ? ` @ RPE ${row.avg_rpe.toFixed(1)}` : ""}`
            : "—"}
        </p>
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${toneChip(t)}`}>
        <VerdictIcon tone={row.tone} />
        {row.label}
      </span>
    </li>
  );
}

export function SessionSummaryCard({ token, sessionId, withConfetti, onLogAnother, secondaryCta }: Props) {
  const fn = useServerFn(getSessionSummary);
  const [data, setData] = useState<Awaited<ReturnType<typeof fn>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(!!withConfetti);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fn({ data: { token, session_id: sessionId } });
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Não foi possível carregar o resumo.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fn, token, sessionId]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-4 text-center md:p-8">
        <Logo className="mx-auto h-12 w-12" />
        <h1 className="text-2xl font-bold">Sessão registada 💪</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={onLogAnother}>Registar outra sessão</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s: SessionSummary = data.summary;

  return (
    <>
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
        {/* Hero */}
        <header className="space-y-2 text-center">
          <Logo className="mx-auto h-10 w-10" />
          <h1 className="text-2xl font-bold tracking-tight">
            Sessão concluída <span aria-hidden>💪</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Sessão {data.session_ordinal} · Semana {data.week_number}
            {data.focus ? ` · ${data.focus}` : ""}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneChip("neutral")}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${toneDot("success")}`} />
              {s.done_sets}/{s.total_sets} séries · {s.adherence_pct}%
            </span>
            {!s.is_baseline && s.delta_pct != null && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneChip(
                  s.delta_pct >= 3 ? "success" : s.delta_pct <= -3 ? "danger" : "neutral",
                )}`}
              >
                {s.delta_pct >= 0 ? "+" : ""}
                {s.delta_pct.toFixed(1)}% e1RM total
              </span>
            )}
          </div>
        </header>

        {/* Highlights */}
        {s.highlights.length > 0 && (
          <section className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Destaques
            </div>
            <ul className="space-y-1.5">
              {s.highlights.map((h) => (
                <li key={`hl-${h.exercise_name}`} className="text-sm">
                  <span className="font-medium">{h.exercise_name}</span>
                  <span className="text-muted-foreground"> — {h.label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Baseline copy when no prior */}
        {s.is_baseline && (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Primeira sessão deste foco — registamos como ponto de partida. Na próxima vez
            verás aqui a comparação directa.
          </p>
        )}

        {/* Per-exercise rows */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Por exercício
          </h2>
          <ul className="space-y-1.5">
            {s.exercises.map((row) => (
              <ExerciseRow key={row.exercise_name} row={row} />
            ))}
          </ul>
        </section>

        {/* Next session */}
        {data.next_session && (
          <section className="rounded-xl border border-border bg-card/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Próxima sessão
            </p>
            <p className="mt-1 text-sm">
              Semana {data.next_session.week_number} ·{" "}
              <span className="font-medium">{data.next_session.day_label}</span>
              {data.next_session.focus ? (
                <span className="text-muted-foreground"> · {data.next_session.focus}</span>
              ) : null}
            </p>
          </section>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
          <Button onClick={onLogAnother} variant="default">
            Registar outra sessão
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          {secondaryCta && (
            <Button onClick={secondaryCta.onClick} variant="outline">
              {secondaryCta.label}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export default SessionSummaryCard;