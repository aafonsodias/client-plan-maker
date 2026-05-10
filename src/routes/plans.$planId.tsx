import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import PlanEditorSurface from "@/components/PlanEditorSurface";

export const Route = createFileRoute("/plans/$planId")({
  component: PlanRoute,
});

function PlanRoute() {
  const { planId } = Route.useParams();
  const location = useLocation();
  const isBasePlanRoute = location.pathname === `/plans/${planId}`;

  if (!isBasePlanRoute) return <Outlet />;

  return (
    <AppShell back={{ to: "/plans", label: "All plans" }}>
      <PlanEditorSurface planId={planId} />
    </AppShell>
  );
}

