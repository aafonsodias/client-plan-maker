import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import YearView from "@/components/YearView";

export const Route = createFileRoute("/clients_/$clientId/year")({
  component: ClientYearPage,
  head: () => ({
    meta: [
      { title: "Vista anual do cliente" },
      { name: "description", content: "Histórico longitudinal de adesão, RPE, tonelagem e força ao longo de todos os blocos." },
    ],
  }),
});

function ClientYearPage() {
  const { clientId } = Route.useParams();
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
      <Link
        to="/clients/$clientId"
        params={{ clientId }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar ao cliente
      </Link>
      <YearView clientId={clientId} />
    </div>
  );
}