import { AutoTextarea } from "@/components/AutoTextarea";

export type PostFeedback = {
  session_rpe?: number;
  mood?: "strong" | "ok" | "flat" | "crushed";
  notes?: string;
};

const MOODS: Array<{ key: NonNullable<PostFeedback["mood"]>; emoji: string; label: string }> = [
  { key: "strong", emoji: "💪", label: "Forte" },
  { key: "ok", emoji: "🙂", label: "Bem" },
  { key: "flat", emoji: "😐", label: "Flat" },
  { key: "crushed", emoji: "🥵", label: "Rebentado" },
];

export function PostFeedbackStep({
  value,
  onChange,
}: {
  value: PostFeedback;
  onChange: (next: PostFeedback) => void;
}) {
  const rpeScale = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Como correu?</h2>
        <p className="text-xs text-muted-foreground">
          Avalia o esforço global da sessão e como te sentiste no fim.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">RPE da sessão</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">1 = leve · 10 = máximo</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {rpeScale.map((i) => {
            const active = value.session_rpe === i;
            const tone =
              i <= 4
                ? "border-emerald-500 bg-emerald-500"
                : i <= 7
                  ? "border-amber-500 bg-amber-500"
                  : "border-red-500 bg-red-500";
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChange({ ...value, session_rpe: i })}
                className={
                  "h-9 min-w-9 rounded-full border px-3 text-sm font-semibold tabular-nums transition " +
                  (active
                    ? `${tone} text-white`
                    : "border-border bg-background text-muted-foreground hover:border-foreground/40")
                }
                aria-pressed={active}
                aria-label={`RPE ${i}`}
              >
                {i}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-semibold">Como te sentiste?</span>
        <div className="grid grid-cols-2 gap-2">
          {MOODS.map((m) => {
            const active = value.mood === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() =>
                  onChange({ ...value, mood: active ? undefined : m.key })
                }
                className={
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition " +
                  (active
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/40")
                }
                aria-pressed={active}
              >
                <span className="text-lg leading-none">{m.emoji}</span>
                <span className="font-medium">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Notas finais</span>
        <AutoTextarea
          minRows={1}
          placeholder="Como foi o treino? (opcional)"
          value={value.notes ?? ""}
          onChange={(ev) => onChange({ ...value, notes: ev.target.value })}
        />
      </div>
    </div>
  );
}