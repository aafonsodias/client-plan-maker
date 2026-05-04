import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { proposeProgressions, approveProgressions } from "@/server/phased/stage4-progressions.functions";
import { ProgressionPlanSchema, type ProgressionPlan } from "@/server/phased/schemas";
import { Loader2, Sparkles, CheckCircle2, RefreshCw } from "lucide-react";
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

  const [loaded, setLoaded] = useState(false);
  const [plan, setPlan] = useState<ProgressionPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("workout_plans")
        .select("progression_plan")
        .eq("id", planId)
        .maybeSingle();
      if (!alive) return;
      const raw = (data as any)?.progression_plan;
      const parsed = raw ? ProgressionPlanSchema.safeParse(raw) : null;
      setPlan(parsed?.success ? parsed.data : null);
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
    const tId = toast.loading("A aprovar progressões…");
    try {
      const res: any = await approveFn({ data: { planId, progressionPlan: plan } });
      if (!res?.ok) {
        toast.error(res?.error ?? "Falha a aprovar.", { id: tId });
        return;
      }
      toast.success("Plano completo — pronto a entregar.", { id: tId });
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
          Ainda não há deltas. Gera as progressões para as semanas 2–4
          (cargas, reps, RPE e deload) a partir da Semana 1 aprovada.
        </p>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500/15 border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "A gerar progressões…" : "Gerar progressões"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {groupedRows.length} exercícios · {plan.rows.length} deltas
        </p>
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
          {approving ? "A aprovar…" : "Aprovar progressões"}
        </button>
      </div>
    </div>
  );
}