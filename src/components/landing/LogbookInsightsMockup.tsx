import { Activity, AlertTriangle, Sparkles, TrendingUp } from "lucide-react";

/**
 * Static landing preview: AI-derived insights surfaced from the logbook.
 * Reinforces the "logbook + intelligent reading" pitch without claiming
 * features that don't exist yet — the insights are framed as suggestions.
 */
export function LogbookInsightsMockup() {
  const insights = [
    {
      icon: TrendingUp,
      tone: "emerald",
      title: "Volume total · +12% em 4 semanas",
      body: "Progressão consistente nos principais padrões. Sugerido manter carga e juntar 1 série.",
    },
    {
      icon: TrendingUp,
      tone: "emerald",
      title: "Bench Press · +5kg em 3 sessões",
      body: "Força a subir no padrão de empurrar. Próxima sessão pronta para novo top set.",
    },
    {
      icon: Activity,
      tone: "violet",
      title: "Adesão · 6/6 sessões nas últimas 2 semanas",
      body: "Consistência alta. Boa janela para introduzir uma semana de intensificação.",
    },
    {
      icon: AlertTriangle,
      tone: "amber",
      title: "RPE médio 8.4 (alvo 7.5)",
      body: "Esforço percebido acima do prescrito. Reduzir 1 série nos acessórios pode ajudar a recuperar.",
    },
  ];
  const toneRing: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-500",
    violet: "border-violet-500/30 bg-violet-500/5 text-violet-400",
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/80 p-5 shadow-[var(--shadow-elegant)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Insights da IA
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
          últimos 21 dias
        </span>
      </div>
      <ul className="space-y-2">
        {insights.map((i) => (
          <li
            key={i.title}
            className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-3"
          >
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${toneRing[i.tone]}`}
            >
              <i.icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{i.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{i.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}