import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { proposeProgressions, approveProgressions } from "@/server/phased/stage4-progressions.functions";
import { bulkFillRemainingWeeks } from "@/server/phased/stage5-bulkfill.functions";
import { ProgressionPlanSchema, type ProgressionPlan } from "@/server/phased/schemas";
import { Loader2, Sparkles, CheckCircle2, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { ProgressionExerciseCard } from "@/components/ProgressionExerciseCard";

type Row = ProgressionPlan["rows"][number] & { _idx: number };

/**
 * ProgressionsPanel — Stage 5 inline panel rendered inside the client page's
 * StageCard expandedBody. Mirrors MicrocyclePanel's contract: hosts owns
 * "what happens after approve" via `onApproved`. Replaces the broken
 * navigate(/plans/$planId/progressions) bounce-redirect from R34.
 */
export function ProgressionsPanel({
  planId,
  onApproved,
}: {
  planId: string;
  onApproved?: () => void;
}) {
  const proposeFn = useServerFn(proposeProgressions);
  const approveFn = useServerFn(approveProgressions);
  const bulkFillFn = useServerFn(bulkFillRemainingWeeks);

  const [loaded, setLoaded] = useState(false);
  const [plan, setPlan] = useState<ProgressionPlan | null>(null);
  const [weeks, setWeeks] = useState<number>(4);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("workout_plans")
        .select("progression_plan, duration_weeks")
        .eq("id", planId)
        .maybeSingle();
      if (!alive) return;
      const raw = (data as any)?.progression_plan;
      const parsed = raw ? ProgressionPlanSchema.safeParse(raw) : null;
      setPlan(parsed?.success ? parsed.data : null);
      setWeeks(((data as any)?.duration_weeks as number | null) ?? 4);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [planId]);

  const groupedRows = useMemo(() => {
    if (!plan) return [] as Array<{ exerciseId: string; rows: Row[] }>;
    const map = new Map<string, Row[]>();
    plan.rows.forEach((r, i) => {
      const list = map.get(r.exercise_id) ?? [];
      list.push({ ...r, _idx: i });
      map.set(r.exercise_id, list);
    });
    return Array.from(map.entries()).map(([exerciseId, rows]) => ({ exerciseId, rows }));
  }, [plan]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    const tId = toast.loading("A gerar progressões…");
    try {
      const res: any = await proposeFn({ data: { planId } });
      if (!res?.ok) {
        toast.error(res?.error ?? "Falha a gerar progressões.", { id: tId });
        return;
      }
      const parsed = ProgressionPlanSchema.safeParse(res.progressionPlan);
      if (!parsed.success) {
        toast.error("Progressões com formato inválido.", { id: tId });
        return;
      }
      setPlan(parsed.data);
      toast.success("Progressões prontas — revê e aprova.", { id: tId });
    } finally {
      setGenerating(false);
    }
  };

  const approve = async () => {
    if (!plan || approving) return;
    setApproving(true);
    const tId = toast.loading("A aprovar e a expandir o plano para todas as semanas…");
    try {
      const res: any = await approveFn({ data: { planId, progressionPlan: plan } });
      if (!res?.ok) {
        toast.error(res?.error ?? "Falha a aprovar.", { id: tId });
        return;
      }
      // Expand W1 → W2..N applying the deltas. Without this the final plan only has Week 1.
      const fill: any = await bulkFillFn({ data: { planId } });
      if (!fill?.ok) {
        toast.error(fill?.error ?? "Aprovado, mas falhou expandir as semanas.", { id: tId });
        return;
      }
      toast.success(`Plano completo — ${weeks} semanas prontas a entregar.`, { id: tId });
      onApproved?.();
    } finally {
      setApproving(false);
    }
  };

  const updateRow = (rowIdx: number, patch: Partial<Row>) => {
    if (!plan) return;
    const next = {
      ...plan,
      rows: plan.rows.map((r, i) => (i === rowIdx ? { ...r, ...patch } : r)),
    };
    setPlan(next);
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar progressões…
      </div>
    );
  }

  if (!plan || plan.rows.length === 0) {
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-muted-foreground">
          Esta fase desenha como o plano evolui depois da Semana 1.
          A IA propõe pequenos ajustes (carga, reps, sets, RPE) por exercício
          ao longo das {weeks} semanas, e marca a última como deload.
          Tu revês, ajustas o que quiseres, e aprovas.
        </p>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500/15 border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "A gerar progressões…" : `Gerar progressões (${weeks} semanas)`}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{groupedRows.length} exercícios</span> ·
          plano de <span className="font-semibold text-foreground">{weeks} semanas</span> ·
          última semana = deload
          <span className="ml-1 opacity-60">({plan.rows.length} ajustes)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Info className="h-3 w-3" /> {showGuide ? "Fechar guia" : "Como editar"}
          </button>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating || approving}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerar
          </button>
        </div>
      </div>
      {showGuide && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Cada linha</strong> é a mudança que esse exercício sofre na Semana 2, 3 e 4 vs a Semana 1.
            Em branco = manter igual. A última semana é tipicamente um deload (carga ou volume mais baixos para recuperar).
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li><strong>Carga:</strong> <code>+2.5kg</code>, <code>+5%</code>, <code>-10%</code></li>
            <li><strong>Reps:</strong> <code>+1rep</code>, <code>+2reps</code>, <code>-1rep</code></li>
            <li><strong>Sets:</strong> <code>+1set</code>, <code>-1set</code></li>
            <li><strong>RPE:</strong> <code>+0.5rpe</code>, <code>-1rpe</code></li>
          </ul>
          <p className="opacity-80">
            Regra prática: começar leve e ir subindo. Em compostos com carga externa, prefere <em>+kg ou +%</em>; em peso de corpo / máquinas, prefere <em>+reps</em> ou <em>+RPE</em>; em isolados, prefere <em>+reps</em> ou <em>+sets</em>.
          </p>
        </div>
      )}
      <div className="space-y-3">
        {groupedRows.map((g) => (
          <ProgressionExerciseCard
            key={g.exerciseId}
            exerciseId={g.exerciseId}
            rows={g.rows}
            onChange={updateRow}
          />
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={() => void approve()}
          disabled={approving || generating}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 shadow hover:opacity-90 disabled:opacity-50"
        >
          {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {approving ? "A expandir plano…" : `Aprovar e gerar ${weeks} semanas`}
        </button>
      </div>
    </div>
  );
}