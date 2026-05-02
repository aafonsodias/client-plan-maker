import { Flame, CheckCircle2, Loader2, WifiOff, Cloud } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "offline";

export function LogHeader({
  trainerName,
  planTitle,
  clientName,
  currentStreak,
  weekDone,
  weekTotal,
  saveState,
  lastSavedAt,
}: {
  trainerName: string | null;
  planTitle: string;
  clientName: string | null;
  currentStreak: number;
  weekDone: number;
  weekTotal: number;
  saveState: SaveState;
  lastSavedAt: number | null;
}) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {trainerName ?? "Workout log"}
          </p>
          <h1 className="truncate text-2xl font-bold tracking-tight">{planTitle}</h1>
          {clientName && (
            <p className="text-sm text-muted-foreground">For {clientName}</p>
          )}
        </div>
        <SaveBadge state={saveState} lastSavedAt={lastSavedAt} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {currentStreak > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400"
            title="Semanas consecutivas com pelo menos uma sessão"
          >
            <Flame className="h-3.5 w-3.5" />
            {currentStreak} {currentStreak === 1 ? "semana" : "semanas"} seguidas
          </span>
        )}
        {weekTotal > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{weekDone}</span>/{weekTotal} sessões esta semana
            <span className="flex gap-1">
              {Array.from({ length: weekTotal }).map((_, i) => (
                <span
                  key={i}
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (i < weekDone ? "bg-emerald-500" : "bg-border")
                  }
                />
              ))}
            </span>
          </span>
        )}
      </div>
    </header>
  );
}

function SaveBadge({ state, lastSavedAt }: { state: SaveState; lastSavedAt: number | null }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> A guardar…
      </span>
    );
  }
  if (state === "offline") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-400">
        <WifiOff className="h-3 w-3" /> Sem rede
      </span>
    );
  }
  if (state === "saved" && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Guardado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
      <Cloud className="h-3 w-3" /> Pronto
    </span>
  );
}