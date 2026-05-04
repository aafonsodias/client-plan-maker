import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  getPlanGenerationTelemetry,
  getTrainerGenerationTelemetry,
  type StageTelemetry,
} from "@/server/generation-telemetry.functions";
import { Beaker, Loader2, RefreshCw, AlertTriangle, X } from "lucide-react";

const FOUNDER_EMAIL = "aafonsodias@gmail.com";

function fmtCost(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.001) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}
function fmtMs(ms: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function FounderAiTelemetryPanel({
  planId,
  variant = "inline",
}: {
  planId?: string;
  /** "inline" preserves legacy embedded layout. "dock" floats bottom-left. */
  variant?: "inline" | "dock";
}) {
  const { user } = useAuth();
  const isFounder = (user?.email ?? "").toLowerCase() === FOUNDER_EMAIL;
  const planFn = useServerFn(getPlanGenerationTelemetry);
  const trainerFn = useServerFn(getTrainerGenerationTelemetry);
  const [planData, setPlanData] = useState<{
    stages: StageTelemetry[];
    total_cost_usd: number;
    total_calls: number;
    total_failures: number;
  } | null>(null);
  const [acctData, setAcctData] = useState<{
    stages: StageTelemetry[];
    total_cost_usd: number;
    total_calls: number;
    total_failures: number;
    avg_duration_ms: number;
    days: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"plan" | "account">(planId ? "plan" : "account");
  const [dockOpen, setDockOpen] = useState(false);

  const refresh = async () => {
    if (!isFounder) return;
    setLoading(true);
    try {
      if (planId) {
        const r: any = await planFn({ data: { planId } });
        if (r?.ok) setPlanData(r);
      }
      const a: any = await trainerFn({ data: { days: 7 } });
      if (a?.ok) setAcctData(a);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFounder) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFounder, planId]);

  if (!isFounder) return null;

  const rows = tab === "plan" ? planData?.stages ?? [] : acctData?.stages ?? [];
  const totalCost =
    tab === "plan" ? planData?.total_cost_usd ?? 0 : acctData?.total_cost_usd ?? 0;
  const totalCalls =
    tab === "plan" ? planData?.total_calls ?? 0 : acctData?.total_calls ?? 0;
  const totalFailures =
    tab === "plan" ? planData?.total_failures ?? 0 : acctData?.total_failures ?? 0;

  const body = (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-500/90">
          <Beaker className="h-4 w-4" />
          AI spend & latency · founder view
        </div>
        <div className="flex items-center gap-1">
          {planId && (
            <>
              <button
                type="button"
                onClick={() => setTab("plan")}
                className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                  tab === "plan"
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                    : "border-amber-500/20 text-muted-foreground"
                }`}
              >
                this plan
              </button>
              <button
                type="button"
                onClick={() => setTab("account")}
                className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                  tab === "account"
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                    : "border-amber-500/20 text-muted-foreground"
                }`}
              >
                7d account
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-md border border-amber-500/30 px-1.5 py-0.5 text-amber-500/80 hover:text-amber-300 disabled:opacity-50"
            aria-label="Refresh"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </button>
          {variant === "dock" && (
            <button
              type="button"
              onClick={() => setDockOpen(false)}
              className="rounded-md border border-amber-500/30 px-1.5 py-0.5 text-amber-500/80 hover:text-amber-300"
              aria-label="Close"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-mono">{fmtCost(totalCost)} total</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono tabular-nums">{totalCalls} calls</span>
        {totalFailures > 0 && (
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {totalFailures} failed
          </span>
        )}
        {tab === "account" && acctData && (
          <span className="text-muted-foreground">
            avg {fmtMs(acctData.avg_duration_ms)} · last {acctData.days}d
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground">
          {loading ? "Loading…" : "No AI calls recorded yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1 pr-2 font-medium">Stage</th>
                <th className="pb-1 pr-2 text-right font-medium">Calls</th>
                <th className="pb-1 pr-2 text-right font-medium">Cost</th>
                <th className="pb-1 pr-2 text-right font-medium">Avg time</th>
                <th className="pb-1 pr-2 text-right font-medium">Fails</th>
                <th className="pb-1 font-medium">Last model</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.stage} className="border-t border-amber-500/10">
                  <td className="py-1 pr-2 font-mono">{s.stage}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{s.calls}</td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">{fmtCost(s.cost_usd)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{fmtMs(s.avg_duration_ms)}</td>
                  <td className={`py-1 pr-2 text-right tabular-nums ${s.failures > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {s.failures}
                  </td>
                  <td className="py-1 truncate text-muted-foreground" title={s.last_error ?? undefined}>
                    {s.last_model ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (variant === "inline") return body;

  // Dock variant — small pill bottom-left, expands to a panel.
  return (
    <div className="fixed bottom-4 left-4 z-40 print:hidden">
      {dockOpen ? (
        <div className="w-[min(420px,calc(100vw-2rem))] shadow-2xl">
          {body}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDockOpen(true);
            void refresh();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 shadow-md backdrop-blur hover:bg-amber-500/20"
          aria-label="Open AI spend panel"
        >
          <Beaker className="h-3.5 w-3.5" />
          AI · {fmtCost(
            (tab === "plan" ? planData?.total_cost_usd : acctData?.total_cost_usd) ?? 0,
          )}
        </button>
      )}
    </div>
  );
}