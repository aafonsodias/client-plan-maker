import { Activity, Sparkles, TrendingUp, Moon, BatteryCharging } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Static landing preview: AI-derived insights surfaced from the logbook.
 * Reinforces the "logbook + intelligent reading" pitch without claiming
 * features that don't exist yet — the insights are framed as suggestions.
 */
export function LogbookInsightsMockup() {
  const { t } = useTranslation("plan");
  const insights = [
    {
      icon: Moon,
      tone: "emerald",
      title: t("landing.logbook_insights.cards.sleep.title", "Sono médio · 7h12 (+38min vs mês passado)"),
      body: t("landing.logbook_insights.cards.sleep.body", "Recuperação a melhorar. Janela boa para subir um pouco a intensidade."),
    },
    {
      icon: BatteryCharging,
      tone: "emerald",
      title: t("landing.logbook_insights.cards.energy.title", "Energia pré-treino · 7.4 / 10 — em subida"),
      body: t("landing.logbook_insights.cards.energy.body", "Os treinos estão a deixá-lo com mais bateria do que tinham antes."),
    },
    {
      icon: Activity,
      tone: "emerald",
      title: t("landing.logbook_insights.cards.vo2.title", "VO₂máx estimado · 42 ml/kg/min (zona “Bom”)"),
      body: t("landing.logbook_insights.cards.vo2.body", "Estimativa derivada do submáximo. Reavaliar em 6 semanas."),
    },
    {
      icon: TrendingUp,
      tone: "emerald",
      title: t("landing.logbook_insights.cards.hang.title", "Dead hang ativo · 38s (+9s em 4 semanas)"),
      body: t("landing.logbook_insights.cards.hang.body", "Pega e ombros mais fortes — bom marcador de saúde geral."),
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
          {t("landing.logbook_insights.header", "Insights da IA")}
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
          {t("landing.logbook_insights.window", "últimos 21 dias")}
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
      <p className="mt-3 text-[10px] italic text-muted-foreground/70">
        {t("landing.logbook_insights.disclaimer", "Métricas derivadas do que regista. VO₂máx é estimativa, não medição clínica.")}
      </p>
    </div>
  );
}