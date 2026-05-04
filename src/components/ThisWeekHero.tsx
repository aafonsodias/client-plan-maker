import { useState } from "react";
import { FileText, Loader2, ExternalLink, Sparkles, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
// toast no longer used here — week download moved to the per-plan row.
import { Button } from "@/components/ui/button";
import { MacroIndexStrip } from "@/components/MacroIndexStrip";
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

  return (
    <section
      aria-label="Esta semana"
      className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] via-card to-card p-4"
    >
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
              Esta semana
            </p>
            <h2 className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{plan.title}</span>
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Bloco {blockN} · Semana {selectedWeek} de {totalWeeks} · <span className="uppercase tracking-wider text-foreground/80">{tag}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost" className="h-7 gap-1.5">
              <Link to="/plans/$planId" params={{ planId: plan.id }}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir plano
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <MacroIndexStrip
            totalWeeks={totalWeeks}
            selectedWeek={selectedWeek}
            onSelect={setSelectedWeek}
          />
        </div>
      </div>
    </section>
  );
}