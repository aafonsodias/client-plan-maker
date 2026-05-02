import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { OneRepMaxCalculator } from "@/components/OneRepMaxCalculator";
import { StudiesFeed } from "@/components/StudiesFeed";
import { Hammer } from "lucide-react";

export const Route = createFileRoute("/bancada")({
  component: BancadaPage,
  head: () => ({
    meta: [
      { title: "Bancada · Forge" },
      { name: "description", content: "Calculadora de 1RM, plate math e estudos recentes em treino — a bancada do treinador." },
      { property: "og:title", content: "Bancada · Forge" },
      { property: "og:description", content: "Calculadora de 1RM, plate math e estudos recentes em treino." },
    ],
  }),
});

function BancadaPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 px-1 py-2">
        <header>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Hammer className="h-3 w-3" /> Bancada
          </div>
          <h1 className="mt-3 text-3xl font-light tracking-tight text-foreground sm:text-4xl">Bancada</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Ferramentas rápidas e literatura honesta. Use entre sessões.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card/40 p-5">
            <OneRepMaxCalculator />
          </section>
          <section className="rounded-xl border border-border bg-card/40 p-5">
            <StudiesFeed />
          </section>
        </div>
      </div>
    </AppShell>
  );
}