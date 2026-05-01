import type { Blueprint } from "@/server/phased/schemas";

export function WeekMatrixGrid({
  blueprint,
  onChange,
}: {
  blueprint: Blueprint;
  onChange: (next: Blueprint) => void;
}) {
  const archetypeIds = new Set(blueprint.session_archetypes.map((a) => a.id));
  const weekKeys = Object.keys(blueprint.week_to_session_map).sort(
    (a, b) => Number(a) - Number(b),
  );

  function setDay(wk: string, di: number, value: string) {
    const map = { ...blueprint.week_to_session_map };
    const arr = [...(map[wk] ?? [])];
    arr[di] = value;
    map[wk] = arr;
    onChange({ ...blueprint, week_to_session_map: map });
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {weekKeys.map((wk) => {
        const days = blueprint.week_to_session_map[wk] ?? [];
        return (
          <div key={wk} className="rounded-xl border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-foreground">Semana {wk}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {days.length} dias
              </span>
            </div>
            <div className="space-y-1.5">
              {days.map((id, di) => {
                const valid = archetypeIds.has(id);
                return (
                  <div key={di} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-[11px] font-mono text-muted-foreground">
                      Dia {di + 1}
                    </span>
                    <select
                      value={id}
                      onChange={(e) => setDay(wk, di, e.target.value)}
                      className={`w-full rounded border bg-background px-2 py-1.5 text-xs ${
                        valid
                          ? "border-border"
                          : "border-destructive text-destructive"
                      }`}
                    >
                      {!valid && <option value={id}>{id} (em falta)</option>}
                      {blueprint.session_archetypes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.focus} · {a.id}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}