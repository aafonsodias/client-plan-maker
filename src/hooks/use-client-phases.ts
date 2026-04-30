import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientPhase, derivePhase } from "@/lib/client-phase";

export function useClientPhases(clientIds: string[]): Record<string, ClientPhase> {
  const [phases, setPhases] = useState<Record<string, ClientPhase>>({});
  const key = clientIds.slice().sort().join(",");

  useEffect(() => {
    if (clientIds.length === 0) { setPhases({}); return; }
    let cancelled = false;
    void (async () => {
      // Need height/weight from clients for "risk" required check
      const [{ data: clientsData }, { data: assessments }, { data: plans }] = await Promise.all([
        supabase.from("clients").select("id, height_cm, weight_kg, intake_status").in("id", clientIds),
        supabase.from("assessments").select("*").in("client_id", clientIds),
        supabase
          .from("workout_plans")
          .select("id, client_id, status, duration_weeks, updated_at")
          .in("client_id", clientIds)
          .order("updated_at", { ascending: false }),
      ]);

      const clientsById = new Map<string, { height_cm: number | null; weight_kg: number | null; intake_status: any }>();
      (clientsData ?? []).forEach((c: any) => clientsById.set(c.id, { height_cm: c.height_cm, weight_kg: c.weight_kg, intake_status: c.intake_status }));

      const assessmentByClient = new Map<string, any>();
      (assessments ?? []).forEach((a: any) => {
        // Latest assessment wins (assessments rarely duplicate but be safe)
        if (!assessmentByClient.has(a.client_id)) assessmentByClient.set(a.client_id, a);
      });

      const latestPlanByClient = new Map<string, any>();
      const planIdsByClient = new Map<string, string[]>();
      (plans ?? []).forEach((p: any) => {
        if (!latestPlanByClient.has(p.client_id)) latestPlanByClient.set(p.client_id, p);
        if (!planIdsByClient.has(p.client_id)) planIdsByClient.set(p.client_id, []);
        planIdsByClient.get(p.client_id)!.push(p.id);
      });

      // For each client with a latest plan, fetch latest session date + max week
      const latestPlanIds = Array.from(latestPlanByClient.values()).map((p) => p.id);
      let sessionsByPlan = new Map<string, { latest: string | null; maxWeek: number | null }>();
      if (latestPlanIds.length > 0) {
        const { data: sessions } = await supabase
          .from("workout_sessions")
          .select("plan_id, session_date, week_number")
          .in("plan_id", latestPlanIds);
        (sessions ?? []).forEach((s: any) => {
          const cur = sessionsByPlan.get(s.plan_id) ?? { latest: null, maxWeek: null };
          if (!cur.latest || s.session_date > cur.latest) cur.latest = s.session_date;
          if (cur.maxWeek == null || (s.week_number ?? 0) > cur.maxWeek) cur.maxWeek = s.week_number ?? 0;
          sessionsByPlan.set(s.plan_id, cur);
        });
      }

      const out: Record<string, ClientPhase> = {};
      for (const id of clientIds) {
        const a = assessmentByClient.get(id) ?? null;
        const c = clientsById.get(id);
        // Merge client physical fields into assessment shape used by derive
        const merged = a ? { ...a, height_cm: a.height_cm ?? c?.height_cm, weight_kg: a.weight_kg ?? c?.weight_kg } : (c ? { ...c } : null);
        const plan = latestPlanByClient.get(id) ?? null;
        const ses = plan ? sessionsByPlan.get(plan.id) : null;
        out[id] = derivePhase({
          assessment: merged,
          latestPlan: plan,
          latestSessionDate: ses?.latest ?? null,
          currentWeek: ses?.maxWeek ?? null,
          intakeStatus: c?.intake_status ?? null,
        });
      }
      if (!cancelled) setPhases(out);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return phases;
}