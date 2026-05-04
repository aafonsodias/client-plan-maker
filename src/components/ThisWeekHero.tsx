import { useState } from "react";
import { Download, FileText, Loader2, ExternalLink, Sparkles, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MacroIndexStrip } from "@/components/MacroIndexStrip";
import { downloadPlanById } from "@/lib/download-plan";
import { weekTagFor } from "@/lib/macro-index";

/**
 * Focal-point card for the client page. Replaces the flat "Plano final" row
 * with a single composed surface: macro index strip, week selector, primary
 * download CTA, and a secondary "open plan" link. When the client has no
 * complete plan yet, renders a calm onboarding variant instead.
 */
export function ThisWeekHero({
  plan,
  defaultWeek,
  onCreateManual,
  onEvolve,
  canEvolve,
  creating,
  zeroState,
}: {
  plan: {
    id: string;
    title: string;
    duration_weeks?: number | null;
    block_number?: number | null;
    updated_at?: string | null;
  } | null;
  defaultWeek: number;
  onCreateManual: () => void;
  onEvolve: () => void;
  canEvolve: boolean;
  creating: "manual" | "evolve" | null;
  zeroState: boolean;
}) {
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek);
  const [downloading, setDownloading] = useState(false);

  if (zeroState || !plan) {
    return (
      <section
        aria-label="Próximo passo"
        className="rounded-2xl border border-border bg-card/60 p-6"
      >
        <h2 className="text-base font-semibold text-foreground">Sem plano ativo</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Quando aprovar o briefing, plano-mestre, semana-tipo e progressão, o plano final aparece aqui — pronto para imprimir, semana a semana.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={creating !== null}
            onClick={onCreateManual}
          >
            {creating === "manual"
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Plano manual
          </Button>
          <Button size="sm" disabled={creating !== null || !canEvolve} onClick={onEvolve}>
            {creating === "evolve"
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Gerar próximo bloco (IA)
          </Button>
        </div>
      </section>
    );
  }

  const totalWeeks = Math.max(1, plan.duration_weeks ?? 1);
  const blockN = plan.block_number ?? 1;
  const tag = weekTagFor(selectedWeek, totalWeeks);

  async function handleDownload() {
    if (!plan) return;
    setDownloading(true);
    const tId = toast.loading(`A preparar PDF da Semana ${selectedWeek}…`);
    try {
      await downloadPlanById(plan.id, selectedWeek);
      toast.success("PDF descarregado.", { id: tId });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha a gerar PDF.", { id: tId });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section
      aria-label="Esta semana"
      className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] via-card to-card p-5 shadow-[inset_0_0_36px_rgba(245,158,11,0.06)] sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl"
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
              Esta semana
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{plan.title}</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Bloco {blockN} · Semana {selectedWeek} de {totalWeeks} · <span className="uppercase tracking-wider text-foreground/80">{tag}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5">
              <Link to="/plans/$planId" params={{ planId: plan.id }}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir plano
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <MacroIndexStrip
            totalWeeks={totalWeeks}
            selectedWeek={selectedWeek}
            onSelect={setSelectedWeek}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Imprima a semana atual e atualize ao fim-de-semana — o app é o registo, o papel é o guia.
          </p>
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.18)] transition hover:bg-amber-500/25 disabled:opacity-60"
          >
            {downloading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            Descarregar Semana {selectedWeek}
          </button>
        </div>
      </div>
    </section>
  );
}