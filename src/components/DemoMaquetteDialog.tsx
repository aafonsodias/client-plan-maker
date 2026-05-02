import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { judgeDemoRun, type DemoCritique } from "@/server/demo-judge.functions";
import { MesocycleTableView } from "@/components/MesocycleTableView";
import type { PlanData, Week, Day } from "@/lib/pdf";
import { toast } from "sonner";
import { toneChip } from "@/lib/status-tone";

/**
 * DemoMaquetteDialog — shown when the demo orchestrator finishes the
 * end-to-end run. Tabs: Plan (mesocycle table maquette), Reasoning
 * (AI judge verdict), Notes (raw archetype + brief/blueprint JSON).
 */
export function DemoMaquetteDialog({
  planId,
  open,
  onOpenChange,
}: {
  planId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [plan, setPlan] = useState<PlanData>({ weeks: [] });
  const [planRow, setPlanRow] = useState<any>(null);
  const [demoMeta, setDemoMeta] = useState<{ archetype?: string; expected_red_flags?: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [critique, setCritique] = useState<DemoCritique | null>(null);
  const [judging, setJudging] = useState(false);

  const judgeFn = useServerFn(judgeDemoRun);

  useEffect(() => {
    if (!planId || !open) return;
    setLoading(true);
    void (async () => {
      // Plan metadata + cached critique
      const { data: row } = await supabase
        .from("workout_plans")
        .select("id, title, client_id, brief, blueprint, programming_variables, red_flag_accommodations, progression_plan, demo_critique")
        .eq("id", planId)
        .maybeSingle();
      setPlanRow(row);
      setCritique(((row as any)?.demo_critique as DemoCritique) ?? null);

      // Persona meta from the linked assessment
      if ((row as any)?.client_id) {
        const { data: a } = await supabase
          .from("assessments")
          .select("extended")
          .eq("client_id", (row as any).client_id)
          .order("performed_on", { ascending: false })
          .limit(1)
          .maybeSingle();
        const meta = (a as any)?.extended?.demo_meta ?? null;
        setDemoMeta(meta);
      }

      // Synthesize PlanData from workout_plan_days
      const { data: dayRows } = await supabase
        .from("workout_plan_days")
        .select("week_number, day_number, day_label, focus, rationale, content")
        .eq("plan_id", planId)
        .order("week_number", { ascending: true })
        .order("day_number", { ascending: true });
      const weeksMap = new Map<number, Week>();
      for (const r of (dayRows ?? []) as any[]) {
        const wn = r.week_number as number;
        if (!weeksMap.has(wn)) {
          weeksMap.set(wn, { week_number: wn, focus: "", days: [] } as Week);
        }
        const wk = weeksMap.get(wn)!;
        const content = r.content ?? {};
        wk.days.push({
          day_label: r.day_label ?? `Day ${r.day_number}`,
          focus: r.focus ?? "",
          rationale: r.rationale ?? undefined,
          exercises: Array.isArray(content.exercises) ? content.exercises : [],
        } as Day);
      }
      setPlan({ weeks: Array.from(weeksMap.values()).sort((a, b) => a.week_number - b.week_number) });
      setLoading(false);

      // Auto-trigger judge on first open if no cached critique
      if (!((row as any)?.demo_critique)) {
        void runJudge(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, open]);

  const runJudge = async (force: boolean) => {
    if (!planId || judging) return;
    setJudging(true);
    try {
      const res: any = await judgeFn({ data: { planId, force } });
      if (!res?.ok) {
        toast.error(res?.error || "AI judge failed");
        return;
      }
      setCritique(res.critique as DemoCritique);
      if (force) toast.success("Critique refreshed");
    } catch (e: any) {
      toast.error(e?.message ?? "AI judge failed");
    } finally {
      setJudging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Maquete do plano gerado
            {demoMeta?.archetype && (
              <span className="rounded-full bg-accent/10 border border-accent/30 text-accent px-2 py-0.5 text-xs font-medium">
                {demoMeta.archetype}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Pré-visualização end-to-end do que o gerador produziu para esta persona. Use os separadores para inspeccionar a tabela do mesociclo, o veredicto da IA e os dados em bruto.
          </DialogDescription>
        </DialogHeader>

        {demoMeta?.expected_red_flags && demoMeta.expected_red_flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-2">
            <span className="text-xs text-muted-foreground self-center mr-1">Red flags da persona:</span>
            {demoMeta.expected_red_flags.map((f) => (
              <span key={f} className="rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 px-2 py-0.5 text-xs font-mono">
                {f}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="plan" className="h-full flex flex-col">
            <TabsList className="self-start">
              <TabsTrigger value="plan">Plano</TabsTrigger>
              <TabsTrigger value="reasoning">Análise da IA</TabsTrigger>
              <TabsTrigger value="notes">Dados em bruto</TabsTrigger>
            </TabsList>

            <TabsContent value="plan" className="flex-1 overflow-auto mt-3">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A carregar plano…
                </div>
              ) : plan.weeks.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhum dia gerado ainda.</p>
              ) : (
                <MesocycleTableView plan={plan} planId={planId ?? undefined} editable={false} />
              )}
            </TabsContent>

            <TabsContent value="reasoning" className="flex-1 overflow-auto mt-3 space-y-4">
              {judging && !critique && (
                <div className="flex items-center gap-2 text-muted-foreground p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A IA está a avaliar o plano contra a persona…
                </div>
              )}
              {!judging && !critique && (
                <div className="p-4">
                  <Button onClick={() => void runJudge(false)} size="sm">
                    Pedir análise à IA
                  </Button>
                </div>
              )}
              {critique && <CritiqueView critique={critique} onRefresh={() => void runJudge(true)} judging={judging} />}
            </TabsContent>

            <TabsContent value="notes" className="flex-1 overflow-auto mt-3 space-y-3 text-xs">
              <NotesBlock label="Brief" data={planRow?.brief} />
              <NotesBlock label="Blueprint" data={planRow?.blueprint} />
              <NotesBlock label="Programming variables" data={planRow?.programming_variables} />
              <NotesBlock label="Red-flag accommodations" data={planRow?.red_flag_accommodations} />
              <NotesBlock label="Progression plan" data={planRow?.progression_plan} />
              <NotesBlock label="Demo metadata" data={demoMeta} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Plano #{planId?.slice(0, 8)}
          </span>
          <div className="flex gap-2">
            {planId && (
              <Button asChild variant="outline" size="sm">
                <Link to="/plans/$planId" params={{ planId }}>
                  <ExternalLink className="mr-2 h-3.5 w-3.5" /> Abrir plano completo
                </Link>
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)} size="sm">Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CritiqueView({
  critique,
  onRefresh,
  judging,
}: {
  critique: DemoCritique;
  onRefresh: () => void;
  judging: boolean;
}) {
  const gradeColor = (g: string) =>
    g === "A" ? "text-emerald-500"
    : g === "B" ? "text-emerald-400"
    : g === "C" ? "text-amber-500"
    : g === "D" ? "text-orange-500"
    : "text-red-500";

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Nota global</span>
          <span className={`text-5xl font-light ${gradeColor(critique.overall_grade)}`}>{critique.overall_grade}</span>
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm" disabled={judging}>
          {judging ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          Re-avaliar
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Para o cliente</div>
        <p className="text-sm">{critique.client_summary}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GradeCard title="Progressão" grade={critique.progression_realism.grade} note={critique.progression_realism.note} />
        <GradeCard title="Equipamento" grade={critique.equipment_adherence.grade} note={critique.equipment_adherence.note} />
        <GradeCard title="Volume / equilíbrio" grade={critique.volume_balance.grade} note={critique.volume_balance.note} />
      </div>

      {critique.safety_violations.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-500 mb-2">
            <AlertTriangle className="h-4 w-4" /> Violações de segurança ({critique.safety_violations.length})
          </div>
          <ul className="space-y-1 text-sm">
            {critique.safety_violations.map((v, i) => (
              <li key={i} className="text-foreground/90">• {v}</li>
            ))}
          </ul>
        </div>
      )}

      {critique.red_flag_coverage.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-sm font-semibold mb-2">Cobertura de red flags</div>
          <ul className="space-y-1.5 text-sm">
            {critique.red_flag_coverage.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                {r.respected ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{r.flag}</span>
                  <span className="ml-2 text-muted-foreground">{r.evidence}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {critique.top_friction_points.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-sm font-semibold mb-2">Top friction points (para o developer)</div>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            {critique.top_friction_points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Gerado a {new Date(critique.generated_at).toLocaleString()} · {toneChip("neutral", "AI critique")}
      </p>
    </div>
  );
}

function GradeCard({ title, grade, note }: { title: string; grade: string; note: string }) {
  const gradeColor =
    grade === "A" ? "text-emerald-500"
    : grade === "B" ? "text-emerald-400"
    : grade === "C" ? "text-amber-500"
    : grade === "D" ? "text-orange-500"
    : "text-red-500";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{title}</span>
        <span className={`text-2xl font-light ${gradeColor}`}>{grade}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{note}</p>
    </div>
  );
}

function NotesBlock({ label, data }: { label: string; data: any }) {
  const [open, setOpen] = useState(false);
  if (data == null) return null;
  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="rounded-lg border border-border bg-muted/20">
      <summary className="cursor-pointer px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-foreground hover:bg-muted/40 select-none">
        {label}
      </summary>
      <pre className="p-3 overflow-auto text-[11px] leading-snug font-mono whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}