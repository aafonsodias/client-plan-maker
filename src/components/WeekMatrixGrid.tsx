import type { Blueprint } from "@/server/phased/schemas";
import { archetypeLabel } from "@/lib/archetype-labels";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

export function WeekMatrixGrid({
  blueprint,
  onChange,
}: {
  blueprint: Blueprint;
  onChange: (next: Blueprint) => void;
}) {
  const { i18n } = useTranslation();
  const locale: "pt" | "en" = i18n.language?.startsWith("pt") ? "pt" : "en";
  const archetypeIds = new Set(blueprint.session_archetypes.map((a) => a.id));
  const firstValid = blueprint.session_archetypes[0]?.id ?? "";
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

  // Auto-heal: if a fresh blueprint comes in with an empty day cell,
  // default it to the first valid archetype so the matrix is never
  // half-blank when the trainer first opens it.
  useEffect(() => {
    if (!firstValid) return;
    let dirty = false;
    const map = { ...blueprint.week_to_session_map };
    for (const wk of weekKeys) {
      const arr = [...(map[wk] ?? [])];
      for (let i = 0; i < arr.length; i++) {
        if (!arr[i] || arr[i].trim() === "") {
          arr[i] = firstValid;
          dirty = true;
        }
      }
      map[wk] = arr;
    }
    if (dirty) onChange({ ...blueprint, week_to_session_map: map });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstValid]);

  function archLabel(id: string, focus?: string): string {
    if (focus && focus.trim() !== "" && focus !== "Custom") return focus;
    return archetypeLabel(id, locale);
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {weekKeys.map((wk) => {
        const days = blueprint.week_to_session_map[wk] ?? [];
        return (
          <div key={wk} className="rounded-xl border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-foreground">
                {locale === "pt" ? `Semana ${wk}` : `Week ${wk}`}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {days.length} {locale === "pt" ? "dias" : "days"}
              </span>
            </div>
            <div className="space-y-1.5">
              {days.map((id, di) => {
                const valid = archetypeIds.has(id);
                return (
                  <div key={di} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-[11px] font-mono text-muted-foreground">
                      {locale === "pt" ? `Dia ${di + 1}` : `Day ${di + 1}`}
                    </span>
                    <select
                      value={id}
                      onChange={(e) => setDay(wk, di, e.target.value)}
                      className={`w-full rounded border bg-background px-2 py-1.5 text-sm ${
                        valid
                          ? "border-border"
                          : "border-destructive text-destructive"
                      }`}
                    >
                      {!valid && (
                        <option value={id}>
                          {id} {locale === "pt" ? "(em falta)" : "(missing)"}
                        </option>
                      )}
                      {blueprint.session_archetypes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {archLabel(a.id, a.focus)}
                        </option>
                      ))}
                    </select>
                    {!valid && firstValid && (
                      <button
                        type="button"
                        onClick={() => setDay(wk, di, firstValid)}
                        className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-300 hover:bg-amber-500/20"
                        title={locale === "pt" ? "Substituir pelo primeiro arquétipo válido" : "Replace with first valid archetype"}
                      >
                        {locale === "pt" ? "corrigir" : "fix"}
                      </button>
                    )}
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