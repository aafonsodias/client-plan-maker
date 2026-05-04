import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BriefContextRail } from "@/components/BriefContextRail";
import { BriefSheetButton } from "@/components/BriefSheetButton";
import { MicrocyclePanel } from "@/components/MicrocyclePanel";

export const Route = createFileRoute("/plans/$planId/microcycle")({
  component: MicrocycleRoute,
});

function MicrocycleRoute() {
  const { planId } = Route.useParams();
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-3 flex justify-end xl:hidden">
          <BriefSheetButton planId={planId} />
        </div>
        <div className="xl:flex xl:gap-6">
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
              <MicrocyclePanel
                planId={planId}
                onApproved={() =>
                  navigate({ to: "/plans/$planId/progressions", params: { planId } })
                }
              />
            </div>
          </main>
          <aside className="hidden xl:block w-80 flex-shrink-0">
            <div className="scrollbar-hide sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-6">
              <BriefContextRail planId={planId} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
