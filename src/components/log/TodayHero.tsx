import { Button } from "@/components/ui/button";
import { Calendar, Coffee, CheckCircle2, ArrowRight } from "lucide-react";

export type TodayState = "ready" | "rest" | "done_today" | "empty";

const WEEKDAY_LABELS_PT = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const WEEKDAY_SHORT_PT = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function TodayHero({
  state,
  weekNumber,
  dayLabel,
  focus,
  weekday,
  todayWeekday,
  doneSets,
  totalSets,
  sessionPct,
  suggestedNextLabel,
  onChangeDay,
  onSwitchToSuggested,
}: {
  state: TodayState;
  weekNumber: number;
  dayLabel: string;
  focus?: string;
  weekday?: number | null;
  todayWeekday: number;
  doneSets: number;
  totalSets: number;
  sessionPct: number;
  suggestedNextLabel?: string | null;
  onChangeDay: () => void;
  onSwitchToSuggested?: () => void;
}) {
  const todayName = WEEKDAY_LABELS_PT[todayWeekday] ?? "Hoje";

  // Tone tokens — use design system colours.
  const tone =
    state === "rest"
      ? { ring: "border-border/60", bg: "bg-card", chipBg: "bg-muted", chipFg: "text-muted-foreground", icon: <Coffee className="h-4 w-4" /> }
      : state === "done_today"
      ? { ring: "border-emerald-500/30", bg: "bg-emerald-500/5", chipBg: "bg-emerald-500/15", chipFg: "text-emerald-700 dark:text-emerald-300", icon: <CheckCircle2 className="h-4 w-4" /> }
      : { ring: "border-emerald-500/40", bg: "bg-card", chipBg: "bg-emerald-500/15", chipFg: "text-emerald-700 dark:text-emerald-300", icon: <Calendar className="h-4 w-4" /> };

  if (state === "empty") {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">Este plano ainda não tem sessões agendadas.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${tone.ring} ${tone.bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-1.5 rounded-full ${tone.chipBg} px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${tone.chipFg}`}>
            {tone.icon}
            {state === "ready" && <>Hoje · {todayName} · Semana {weekNumber}</>}
            {state === "done_today" && <>{todayName} · Já registado</>}
            {state === "rest" && <>{todayName} · Descanso</>}
          </div>
          <h1 className="mt-1.5 text-lg font-semibold leading-tight">
            {state === "rest" ? (
              <>Hoje é dia de recuperação 🌿</>
            ) : (
              <>
                {dayLabel}
                {focus ? <span className="text-muted-foreground"> · {focus}</span> : null}
              </>
            )}
          </h1>
          {state === "rest" && suggestedNextLabel && (
            <p className="mt-1 text-xs text-muted-foreground">
              Próximo treino: <span className="font-medium text-foreground">{suggestedNextLabel}</span>
            </p>
          )}
          {state === "done_today" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Bom trabalho. Podes rever abaixo ou abrir a próxima sessão.
            </p>
          )}
        </div>
        {state !== "rest" && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
            {doneSets}/{totalSets} · {sessionPct}%
          </span>
        )}
      </div>

      {/* Action row — only shown when there's a useful affordance besides "Mudar de dia". */}
      {state === "rest" && onSwitchToSuggested && (
        <Button
          variant="outline"
          size="sm"
          onClick={onSwitchToSuggested}
          className="mt-3 w-full sm:w-auto"
        >
          Treinar à mesma <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      )}
      {state === "done_today" && onSwitchToSuggested && suggestedNextLabel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onSwitchToSuggested}
          className="mt-3 w-full sm:w-auto"
        >
          Abrir próxima sessão · {suggestedNextLabel} <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      )}

      <details className="mt-3">
        <summary
          onClick={(e) => { e.preventDefault(); onChangeDay(); }}
          className="cursor-pointer text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Mudar de dia
        </summary>
      </details>
    </div>
  );
}

export function weekdayShortPT(n: number | null | undefined): string {
  if (typeof n !== "number") return "";
  return WEEKDAY_SHORT_PT[n] ?? "";
}
