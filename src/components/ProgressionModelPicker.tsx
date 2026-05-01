import type { Blueprint } from "@/server/phased/schemas";

type Model = Blueprint["progression_model_proposal"]["model"];

const MODELS: {
  id: Model;
  title: string;
  whenToUse: string;
  // 4 weekly load points (relative 0..1) for the sparkline
  curve: [number, number, number, number];
}[] = [
  {
    id: "linear",
    title: "Linear",
    whenToUse:
      "Iniciantes ou retomas. Pequenos incrementos semanais consistentes. Simples de seguir, baixo risco.",
    curve: [0.4, 0.55, 0.7, 0.85],
  },
  {
    id: "undulating",
    title: "Undulating",
    whenToUse:
      "Intermédios/avançados. Varia volume e intensidade ao longo da semana — combate a estagnação e cobre múltiplas qualidades.",
    curve: [0.5, 0.7, 0.55, 0.8],
  },
  {
    id: "block",
    title: "Block",
    whenToUse:
      "Avançados com objetivo claro. Concentra um stimulus por bloco (acumulação → intensificação → realização).",
    curve: [0.45, 0.65, 0.85, 0.55],
  },
];

export function ProgressionModelPicker({
  proposal,
  onChange,
}: {
  proposal: Blueprint["progression_model_proposal"];
  onChange: (next: Blueprint["progression_model_proposal"]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {MODELS.map((m) => {
          const selected = proposal.model === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange({ ...proposal, model: m.id })}
              className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-accent bg-accent/10 ring-2 ring-accent/40"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{m.title}</span>
                {selected && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                    Selecionado
                  </span>
                )}
              </div>
              <Sparkline values={m.curve} highlighted={selected} />
              <p className="text-xs leading-relaxed text-muted-foreground">{m.whenToUse}</p>
            </button>
          );
        })}
      </div>
      {proposal.rationale && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Porquê para este cliente
          </div>
          <p className="text-xs text-foreground/90">{proposal.rationale}</p>
        </div>
      )}
    </div>
  );
}

function Sparkline({ values, highlighted }: { values: number[]; highlighted: boolean }) {
  const w = 140;
  const h = 44;
  const padX = 6;
  const padY = 6;
  const maxV = Math.max(...values, 1);
  const stepX = (w - padX * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = padX + i * stepX;
    const y = h - padY - (v / maxV) * (h - padY * 2);
    return [x, y] as const;
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const stroke = highlighted ? "var(--accent)" : "var(--muted-foreground)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" aria-hidden>
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={padX}
          x2={w - padX}
          y1={h - padY - g * (h - padY * 2)}
          y2={h - padY - g * (h - padY * 2)}
          stroke="var(--border)"
          strokeDasharray="2 3"
          strokeWidth={0.5}
        />
      ))}
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill={stroke} />
      ))}
      {points.map(([x], i) => (
        <text
          key={`l${i}`}
          x={x}
          y={h - 0.5}
          textAnchor="middle"
          fontSize={7}
          fill="var(--muted-foreground)"
        >
          W{i + 1}
        </text>
      ))}
    </svg>
  );
}