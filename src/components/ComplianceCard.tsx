import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ComplianceDashboard } from "./ComplianceDashboard";

/**
 * Wraps ComplianceDashboard with a gate: only renders the collapsible
 * section once the client has at least 2 distinct logged training weeks
 * (otherwise comparisons/trends are meaningless and the panel just eats
 * vertical space). Collapsed footprint is intentionally minimal.
 */
export function ComplianceCard({ clientId }: { clientId: string }) {
  const [weeksLogged, setWeeksLogged] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: planRows } = await supabase
        .from("workout_plans")
        .select("id")
        .eq("client_id", clientId);
      const planIds = (planRows ?? []).map((p) => p.id);
      if (planIds.length === 0) {
        if (!cancelled) setWeeksLogged(0);
        return;
      }
      const { data } = await supabase
        .from("workout_sessions")
        .select("plan_id, week_number")
        .in("plan_id", planIds);
      const keys = new Set<string>();
      for (const r of (data ?? []) as Array<{ plan_id: string; week_number: number }>) {
        keys.add(`${r.plan_id}:${r.week_number}`);
      }
      if (!cancelled) setWeeksLogged(keys.size);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (weeksLogged === null || weeksLogged < 2) return null;

  return (
    <details className="group mt-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-1 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
          Compliance &amp; estatísticas
        </span>
        <span className="text-muted-foreground/60 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="px-1 pb-1 pt-2">
        <ComplianceDashboard clientId={clientId} />
      </div>
    </details>
  );
}