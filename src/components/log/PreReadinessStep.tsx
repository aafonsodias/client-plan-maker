import { AutoTextarea } from "@/components/AutoTextarea";

export type PreReadiness = {
  sleep?: number;
  energy?: number;
  soreness?: number;
  notes?: string;
};

function NumberRow({
  label,
  hint,
  min,
  max,
  value,
  onChange,
  tone,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  value: number | undefined;
  onChange: (v: number) => void;
  tone: "emerald" | "amber" | "blue";
}) {
  const items = [];
  for (let i = min; i <= max; i++) items.push(i);
  const tones: Record<typeof tone, string> = {
    emerald: "border-emerald-500 bg-emerald-500 text-white",
    amber: "border-amber-500 bg-amber-500 text-white",
    blue: "border-blue-500 bg-blue-500 text-white",
  };
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => {
          const active = value === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={
                "h-9 min-w-9 rounded-full border px-3 text-sm font-semibold tabular-nums transition " +
                (active
                  ? tones[tone]
                  : "border-border bg-background text-muted-foreground hover:border-foreground/40")
              }
              aria-pressed={active}
              aria-label={`${label} ${i}`}
            >
              {i}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PreReadinessStep({
  value,
  onChange,
}: {
  value: PreReadiness;
  onChange: (next: PreReadiness) => void;
}) {
  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Antes de começar</h2>
        <p className="text-xs text-muted-foreground">
          Como te sentes hoje? Isto ajusta o próximo treino automaticamente.
        </p>
      </div>
      <NumberRow
        label="Sono"
        hint="1 = mau · 5 = ótimo"
        min={1}
        max={5}
        value={value.sleep}
        onChange={(v) => onChange({ ...value, sleep: v })}
        tone="emerald"
      />
      <NumberRow
        label="Energia"
        hint="1 = baixa · 5 = alta"
        min={1}
        max={5}
        value={value.energy}
        onChange={(v) => onChange({ ...value, energy: v })}
        tone="emerald"
      />
      <NumberRow
        label="Dores musculares"
        hint="0 = nenhuma · 10 = muitas"
        min={0}
        max={10}
        value={value.soreness}
        onChange={(v) => onChange({ ...value, soreness: v })}
        tone="amber"
      />
      <div className="space-y-1">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Notas</span>
        <AutoTextarea
          minRows={1}
          placeholder="Algo que o teu treinador deva saber? (opcional)"
          value={value.notes ?? ""}
          onChange={(ev) => onChange({ ...value, notes: ev.target.value })}
        />
      </div>
    </div>
  );
}