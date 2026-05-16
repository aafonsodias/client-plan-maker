import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Gavel, ChevronRight } from "lucide-react";
import { listPendingProposals } from "@/server/adaptation/proposal.functions";

/**
 * PendingDecisionsPanel — dashboard surface for the R-D restraint refactor.
 * Lists `adaptation_proposals` with status=`pending` so the trainer can act
 * before any new block is generated. The engine produced evidence; the
 * decision belongs to the trainer.
 */
type Item = {
  id: string;
  clientId: string;
  clientName: string | null;
  priorPlanTitle: string | null;
  priorBlock?: number | null;
  createdAt: string;
};

export function PendingDecisionsPanel() {
  const listFn = useServerFn(listPendingProposals);
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await listFn({ data: {} as any });
        if (cancelled) return;
        if (res.ok) setItems(res.items as Item[]);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listFn]);

  if (!items || items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-light tracking-tight text-foreground">
        <Gavel className="h-4 w-4 text-amber-400" />
        Decisões pendentes
      </h2>
      <p className="mb-2 text-xs text-muted-foreground">
        O Protocol mostra evidência. Você decide.
      </p>
      <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5">
        {items.map((it) => (
          <Link
            key={it.id}
            to="/clients/$clientId/adaptation/$proposalId"
            params={{ clientId: it.clientId, proposalId: it.id }}
            className="flex items-center gap-3 border-b border-amber-500/20 px-5 py-3 last:border-b-0 transition hover:bg-amber-500/10"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {it.clientName ?? "Cliente"} · revisão de bloco
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {it.priorPlanTitle ?? "Plano anterior"}
                {it.priorBlock ? ` · Bloco ${it.priorBlock}` : ""} · evidência pronta
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-200">
              Decidir
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}