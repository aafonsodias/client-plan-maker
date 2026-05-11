import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import PlanEditorSurface from "@/components/PlanEditorSurface";
import { PlanWithDeck } from "@/components/PlanWithDeck";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/plans/$planId")({
  component: PlanRoute,
});

function PlanRoute() {
  const { planId } = Route.useParams();
  const location = useLocation();
  const isBasePlanRoute = location.pathname === `/plans/${planId}`;

  if (!isBasePlanRoute) return <Outlet />;

  const [plan, setPlan] = useState<{
    id: string;
    title: string;
    duration_weeks: number | null;
    block_number: number | null;
  } | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: p } = await supabase
        .from("workout_plans")
        .select("id, title, duration_weeks, block_number")
        .eq("id", planId)
        .maybeSingle();
      if (cancelled) return;
      if (p) setPlan(p as any);
      const { data: s } = await supabase
        .from("workout_sessions")
        .select("week_number")
        .eq("plan_id", planId)
        .order("week_number", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const wn = (s?.[0] as any)?.week_number;
      if (typeof wn === "number") setCurrentWeek(wn);
    })();
    return () => { cancelled = true; };
  }, [planId]);

  return (
    <AppShell back={{ to: "/plans", label: "All plans" }}>
      {plan ? (
        <PlanWithDeck plan={plan} currentWeek={currentWeek} />
      ) : (
        <PlanEditorSurface planId={planId} />
      )}
    </AppShell>
  );
}

