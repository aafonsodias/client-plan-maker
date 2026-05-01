import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CAPACITY_FIELDS,
  FORM_CRITERIA,
  PATTERN_LABELS_PT,
  formScore,
  type PatternId,
} from "@/lib/movement-criteria";

export default function MovementPatternCard({
  pattern,
  formCriteria,
  capacity,
  notAssessed,
  onFormCriteria,
  onCapacity,
  onNotAssessed,
}: {
  pattern: PatternId;
  formCriteria: Record<string, boolean>;
  capacity: Record<string, number | null>;
  notAssessed: boolean;
  onFormCriteria: (next: Record<string, boolean>) => void;
  onCapacity: (next: Record<string, number | null>) => void;
  onNotAssessed: (v: boolean) => void;
}) {
  const criteria = FORM_CRITERIA[pattern];
  const fields = CAPACITY_FIELDS[pattern];
  const score = formScore(formCriteria);
  const disabled = notAssessed;

  return (
    <div
      className={`rounded-md border border-border bg-background/40 p-3 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">
            {PATTERN_LABELS_PT[pattern]}
          </h4>
          {!disabled && (
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
              Forma: {score}/5
            </span>
          )}
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <Checkbox
            checked={notAssessed}
            onCheckedChange={(v) => onNotAssessed(v === true)}
            className="h-3.5 w-3.5"
          />
          Ainda não avaliado
        </label>
      </div>

      <ul className="space-y-1">
        {criteria.map((c) => {
          const checked = !!formCriteria?.[c.key];
          return (
            <li key={c.key} className="flex items-start gap-2">
              <Checkbox
                id={`fc-${pattern}-${c.key}`}
                disabled={disabled}
                checked={checked}
                onCheckedChange={(v) =>
                  onFormCriteria({ ...(formCriteria ?? {}), [c.key]: v === true })
                }
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
              />
              <label
                htmlFor={`fc-${pattern}-${c.key}`}
                className="flex flex-1 cursor-pointer items-start gap-1.5 text-xs leading-snug text-foreground"
              >
                <span className="flex-1">{c.label_pt}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.preventDefault()}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Detalhe técnico"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {c.tooltip_pt}
                  </TooltipContent>
                </Tooltip>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 border-t border-border/50 pt-2.5">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Capacidade (opcional)
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {fields.map((f) => {
            const v = capacity?.[f.key];
            return (
              <label key={f.key} className="block">
                <span className="mb-0.5 block text-[11px] text-muted-foreground">
                  {f.label_pt}
                </span>
                <input
                  type="number"
                  disabled={disabled}
                  value={v == null ? "" : String(v)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = raw === "" ? null : Number(raw);
                    onCapacity({
                      ...(capacity ?? {}),
                      [f.key]: Number.isFinite(next as number) ? (next as number) : null,
                    });
                  }}
                  className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs"
                  step="any"
                />
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}