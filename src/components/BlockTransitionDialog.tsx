import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Sparkles, PenLine, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AutoTextarea } from "@/components/AutoTextarea";
import {
  archivePlanAndStartManualNextBlock,
  computeTransitionSummary,
} from "@/server/blocks-manual.functions";
import { archivePlanAndStartNextBlock } from "@/server/blocks.functions";

/**
 * Diálogo unificado para fechar um bloco e iniciar o próximo.
 *
 * Princípio: a IA propõe, o humano assina. O resumo de transição vem
 * pré-preenchido com adesão + RPE drift; o treinador edita. Depois
 * escolhe entre criar manualmente (caminho padrão) ou pedir à IA para
 * gerar o próximo bloco (atalho — apenas em demo plans).
 */
export function BlockTransitionDialog({
  priorPlanId,
  currentBlockNumber,
  allowAi,
  trigger,
}: {
  priorPlanId: string;
  currentBlockNumber: number;
  allowAi: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [submitting, setSubmitting] = useState<"manual" | "ai" | null>(null);
  const navigate = useNavigate();

  const computeFn = useServerFn(computeTransitionSummary);
  const manualFn = useServerFn(archivePlanAndStartManualNextBlock);
  const aiFn = useServerFn(archivePlanAndStartNextBlock);

  useEffect(() => {
    if (!open) return;
    setLoadingSuggestion(true);
    computeFn({ data: { priorPlanId } })
      .then((r: any) => {
        if (r?.ok && r?.summary && !summary) setSummary(r.summary);
      })
      .catch(() => {})
      .finally(() => setLoadingSuggestion(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, priorPlanId]);

  const handleManual = async () => {
    setSubmitting("manual");
    try {
      const r: any = await manualFn({ data: { priorPlanId, summary } });
      if (r?.ok && r?.planId) {
        toast.success(`Bloco ${r.blockNumber} criado em rascunho. Edite o blueprint.`);
        setOpen(false);
        void navigate({ to: "/plans/$planId/blueprint", params: { planId: r.planId } });
      } else {
        toast.error(r?.error ?? "Falhou criar o próximo bloco.");
      }
    } finally {
      setSubmitting(null);
    }
  };

  const handleAi = async () => {
    setSubmitting("ai");
    try {
      const r: any = await aiFn({ data: { priorPlanId } });
      if (r?.ok && r?.planId) {
        toast.success(`Bloco ${r.blockNumber} gerado pela IA. Reveja antes de partilhar.`);
        setOpen(false);
        void navigate({ to: "/plans/$planId", params: { planId: r.planId } });
      } else {
        toast.error(r?.error ?? "Falhou a gerar o próximo bloco.");
      }
    } finally {
      setSubmitting(null);
    }
  };

  const nextBlock = currentBlockNumber + 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Concluir bloco {currentBlockNumber} → bloco {nextBlock}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="transition-summary" className="text-xs uppercase tracking-wider text-muted-foreground">
              Nota de transição
            </Label>
            <p className="mb-2 mt-1 text-xs text-muted-foreground">
              Pré-preenchido com adesão e variação de RPE. Edite, valide, assine.
            </p>
            {loadingSuggestion ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> a calcular adesão e RPE…
              </div>
            ) : (
              <AutoTextarea
                id="transition-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Resumo do bloco anterior e plano para o próximo…"
                className="min-h-24 text-sm"
              />
            )}
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Caminho honesto:</p>
            <p className="mt-1">
              <span className="font-semibold">Manual</span> abre o blueprint em branco para você desenhar o bloco {nextBlock}
              à mão. <span className="font-semibold">IA</span> gera uma proposta — disponível apenas em planos de demonstração.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting !== null}
          >
            Cancelar
          </Button>
          {allowAi && (
            <Button
              variant="secondary"
              onClick={handleAi}
              disabled={submitting !== null || loadingSuggestion}
            >
              {submitting === "ai" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Gerar com IA
            </Button>
          )}
          <Button onClick={handleManual} disabled={submitting !== null || loadingSuggestion}>
            {submitting === "manual" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PenLine className="mr-2 h-4 w-4" />
            )}
            Continuar manualmente
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}