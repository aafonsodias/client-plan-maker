import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BriefContextRail } from "@/components/BriefContextRail";
import { BlueprintEditorPanel } from "@/components/BlueprintEditorPanel";

export const Route = createFileRoute("/plans/$planId/blueprint")({
  component: BlueprintRoute,
});

function BlueprintRoute() {
  const { planId } = Route.useParams();
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="xl:flex xl:gap-6">
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-4xl p-4 sm:p-6">
              <BlueprintEditorPanel planId={planId} />
            </div>
          </main>
          <aside className="hidden xl:block w-80 2xl:w-96 flex-shrink-0">
            <div className="scrollbar-hide sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-6">
              <BriefContextRail planId={planId} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
