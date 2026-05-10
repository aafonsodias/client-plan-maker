import { TrendingUp, ArrowDown, Activity, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BlockTransitionDialog } from "@/components/BlockTransitionDialog";
import { Button } from "@/components/ui/button";
import { avgRpe } from "@/lib/capacity-gain";

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

const TONES: Record<Recommendation, { tone: string; icon: typeof TrendingUp }> = {
  deload: { tone: "border-amber-500/40 bg-amber-500/10 text-amber-200", icon: ArrowDown },
  normal: { tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200", icon: Activity },
  push: { tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200", icon: TrendingUp },
};

export function NextBlockCard({
  planId,
  blockNumber,
  sessions,
  fullyLogged,
  allowAi,
  completionState,
  onMarkFinished,
  markFinishedBusy,
}: {
  planId: string;
  blockNumber: number;
  sessions: Array<{ status?: string | null; entries?: any[] }>;
  fullyLogged: boolean;
  allowAi: boolean;
  completionState?: string | null;
  onMarkFinished?: () => void | Promise<void>;
  markFinishedBusy?: boolean;
}) {
  const { t } = useTranslation("common");
  const hasSessions = sessions.length > 0;
  const completed = hasSessions ? sessions.filter((s) => s.status === "done").length : 0;
  const adherence = hasSessions ? Math.round((completed / sessions.length) * 100) : 0;
  const rpe = hasSessions ? avgRpe(sessions as any) : null;
  const rec: Recommendation = hasSessions ? recommend(adherence, rpe) : "normal";
  const c = TONES[rec];
  const Icon = c.icon;
  const finishedAlready = completionState === "finished_logging";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs ${c.tone}`}>
      <div className="flex flex-1 items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">
            {hasSessions
              ? t(`blocks.next.${rec}_title`)
              : `Bloco ${blockNumber} · pronto para fechar`}
          </p>
          <p className="mt-0.5 text-[11px] opacity-80">
            {hasSessions
              ? t(`blocks.next.${rec}_sub`)
              : `Arquive este bloco e desenhe o Bloco ${blockNumber + 1}. Pré-preenchemos a nota de transição com adesão e variação de RPE — você assina.`}
          </p>
          {hasSessions && (
            <p className="mt-1 text-[10px] uppercase tracking-widest opacity-70">
              {t("blocks.next.adherence")} <span className="tabular-nums">{adherence}%</span>
              {rpe !== null && <> · {t("blocks.next.avg_rpe")} <span className="tabular-nums">{rpe.toFixed(1)}</span></>}
              {" · "}{t("blocks.next.block")} {blockNumber}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!finishedAlready && onMarkFinished && (
          <Button
            size="sm"
            variant="outline"
            disabled={markFinishedBusy}
            onClick={() => void onMarkFinished()}
          >
            {markFinishedBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Marcar como concluído
          </Button>
        )}
        <BlockTransitionDialog
          priorPlanId={planId}
          currentBlockNumber={blockNumber}
          allowAi={allowAi}
          trigger={
            <Button size="sm" variant={fullyLogged ? "default" : "outline"}>
              {t("blocks.next.start_next", { n: blockNumber + 1 })}
            </Button>
          }
        />
      </div>
    </div>
  );
}