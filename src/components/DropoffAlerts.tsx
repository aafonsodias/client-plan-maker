import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, ChevronRight } from "lucide-react";

/**
 * Drop-off radar.
 * A client is "drifting" when they have at least one finalized/active plan
 * AND no logged session for >= IDLE_DAYS days (default 10).
 * Computed live from workout_plans + workout_sessions — no cron needed.
 * Only the trainer's own data is fetched (RLS-protected).
 */

const IDLE_DAYS = 10;

type Drift = {
  client_id: string;
  client_name: string;
  plan_id: string;
  plan_title: string;
  last_session_date: string | null;
  days_idle: number;
};

export function DropoffAlerts() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [drifts, setDrifts] = useState<Drift[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Pull all plans (active + finalized — anything that isn't a draft counts
      // toward retention; drafts are still being authored so we ignore them).
      const { data: plans } = await supabase
        .from("workout_plans")
        .select("id, title, status, client_id, created_at, client:clients(full_name)")
        .neq("status", "draft");

      const planIds = (plans ?? []).map((p) => p.id);
      let lastByPlan = new Map<string, string>();
      if (planIds.length > 0) {
        const { data: sessions } = await supabase
          .from("workout_sessions")
          .select("plan_id, session_date")
          .in("plan_id", planIds)
          .order("session_date", { ascending: false });
        for (const s of sessions ?? []) {
          if (!lastByPlan.has(s.plan_id)) lastByPlan.set(s.plan_id, s.session_date);
        }
      }

      const now = Date.now();
      const out: Drift[] = [];
      // Keep only the most-recent plan per client to avoid duplicate alerts.
      const seenClient = new Set<string>();
      const sortedPlans = (plans ?? []).slice().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      for (const p of sortedPlans) {
        if (seenClient.has(p.client_id)) continue;
        seenClient.add(p.client_id);
        const last = lastByPlan.get(p.id) ?? null;
        const referenceDate = last ?? p.created_at;
        const days = Math.floor((now - new Date(referenceDate).getTime()) / 86400000);
        if (days >= IDLE_DAYS) {
          out.push({
            client_id: p.client_id,
            client_name: (p.client as any)?.full_name ?? "—",
            plan_id: p.id,
            plan_title: p.title,
            last_session_date: last,
            days_idle: days,
          });
        }
      }
      out.sort((a, b) => b.days_idle - a.days_idle);
      if (!cancelled) {
        setDrifts(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || drifts.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h2 className="text-lg font-bold">Drop-off radar</h2>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">
          {drifts.length} need{drifts.length === 1 ? "s" : ""} attention
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-card">
        {drifts.map((d) => (
          <Link
            key={d.client_id}
            to="/clients/$clientId"
            params={{ clientId: d.client_id }}
            className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 last:border-b-0 hover:bg-secondary/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{d.client_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {d.plan_title} ·{" "}
                {d.last_session_date
                  ? `last logged ${d.last_session_date}`
                  : "no sessions logged yet"}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  d.days_idle >= 21
                    ? "bg-rose-500/15 text-rose-600"
                    : "bg-amber-500/15 text-amber-600"
                }`}
              >
                {d.days_idle} days idle
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}