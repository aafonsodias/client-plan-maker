import { TrendingUp, ArrowDown, Activity } from "lucide-react";
import { BlockTransitionDialog } from "@/components/BlockTransitionDialog";
import { Button } from "@/components/ui/button";
import { avgRpe } from "@/lib/capacity-gain";
import type { BlockSummary } from "@/lib/block-feedback";

/**
 * NextBlockCard — sugere deload / normal / push para o próximo bloco com
 * base em adesão + RPE médio do bloco actual. Reusa o BlockTransitionDialog
 * para que o treinador feche e gere o próximo bloco num clique.
 *
 * Heurística simples e honesta:
 *  - Adesão <70% OU RPE médio ≥ 8.5  → DELOAD (recuar para MEV, RPE -1)
 *  - RPE médio ≤ 6.5 e adesão ≥ 90%  → PUSH (subir para MAV/MRV, +volume)
 *  - Restantes                       → NORMAL (continuar curva MEV→MAV)
 */
type Recommendation = "deload" | "normal" | "push";

function recommend(adherence: number, rpe: number | null): Recommendation {
  if (adherence < 70 || (rpe !== null && rpe >= 8.5)) return "deload";
  if (adherence >= 90 && rpe !== null && rpe <= 6.5) return "push";
  return "normal";
}

const COPY: Record<Recommendation, { title: string; sub: string; tone: string; icon: typeof TrendingUp }> = {
  deload: {
    title: "Sugestão: deload no próximo bloco",
    sub: "RPE alto ou adesão baixa — recua para MEV, baixa 1 ponto de RPE e volta a construir.",
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    icon: ArrowDown,
  },
  normal: {
    title: "Sugestão: progressão normal",
    sub: "Continuar curva MEV → MAV, variar acessórios e manter ancoragem.",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    icon: Activity,
  },
  push: {
    title: "Sugestão: pisar acelerador",
    sub: "RPE baixo + adesão alta — subir para MAV/MRV e adicionar 1–2 séries por padrão.",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    icon: TrendingUp,
  },
};

export function NextBlockCard({
  planId,
  blockNumber,
  sessions,
  fullyLogged,
  allowAi,
}: {
  planId: string;
  blockNumber: number;
  sessions: Array<{ status?: string | null; entries?: any[] }>;
  fullyLogged: boolean;
  allowAi: boolean;
}) {
  if (sessions.length === 0) return null;
  const completed = sessions.filter((s) => s.status === "done").length;
  const adherence = Math.round((completed / sessions.length) * 100);
  const rpe = avgRpe(sessions as any);
  const rec = recommend(adherence, rpe);
  const c = COPY[rec];
  const Icon = c.icon;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs ${c.tone}`}>
      <div className="flex flex-1 items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{c.title}</p>
          <p className="mt-0.5 text-[11px] opacity-80">{c.sub}</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest opacity-70">
            Adesão <span className="tabular-nums">{adherence}%</span>
            {rpe !== null && <> · RPE médio <span className="tabular-nums">{rpe.toFixed(1)}</span></>}
            {" · Bloco "}{blockNumber}
          </p>
        </div>
      </div>
      <BlockTransitionDialog
        priorPlanId={planId}
        currentBlockNumber={blockNumber}
        allowAi={allowAi}
        trigger={
          <Button size="sm" variant={fullyLogged ? "default" : "outline"} className="shrink-0">
            Iniciar Bloco {blockNumber + 1}
          </Button>
        }
      />
    </div>
  );
}