// ============================================================================
// EngineMetricsPanel — the three leap-of-faith numbers, on the dashboard.
// Replaces vanity counts. Each metric shows pct vs target with a tone signal.
// Insufficient data renders muted "—" instead of a fake 0%. See
// mem/strategy/leap-of-faith.md for hypothesis + target rationale.
// ============================================================================
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { loadEngineMetrics, type EngineMetric } from "@/server/engine-metrics.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

function tone(m: EngineMetric): { dot: string; text: string } {
  if (m.pct == null) return { dot: "bg-muted-foreground/30", text: "text-muted-foreground" };
  if (m.pct >= m.target) return { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (m.pct >= m.target * 0.7) return { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  return { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" };
}

export function EngineMetricsPanel() {
  const { t } = useTranslation("common");
  const load = useServerFn(loadEngineMetrics);
  const [metrics, setMetrics] = useState<EngineMetric[] | null>(null);

  useEffect(() => {
    void load({ data: {} as never }).then((r) => {
      if (r?.ok) setMetrics(r.metrics);
    }).catch(() => setMetrics([]));
  }, [load]);

  if (!metrics) return null;

  const labels: Record<EngineMetric["key"], { title: string; sub: string; help: string }> = {
    value: {
      title: t("engine.value_title", { defaultValue: "Valor" }),
      sub: t("engine.value_sub", { defaultValue: "planos finalizados que editou" }),
      help: t("engine.value_help", { defaultValue: "Se nunca toca no plano, o gerador não está a entregar valor. Alvo ≥60%." }),
    },
    engagement: {
      title: t("engine.engagement_title", { defaultValue: "Adesão" }),
      sub: t("engine.engagement_sub", { defaultValue: "sessões registadas vs prescritas (28d)" }),
      help: t("engine.engagement_help", { defaultValue: "Sem logging não há adaptação real. Alvo ≥80%." }),
    },
    differentiation: {
      title: t("engine.diff_title", { defaultValue: "Continuação" }),
      sub: t("engine.diff_sub", { defaultValue: "clientes que chegaram ao Bloco 2" }),
      help: t("engine.diff_help", { defaultValue: "Multi-bloco é o que nos distingue. Alvo ≥70% após 28d." }),
    },
  };

  return (
    <section className="rounded-2xl border border-border/50 bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {t("engine.eyebrow", { defaultValue: "Motor · últimos 28 dias" })}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="text-muted-foreground/60 hover:text-foreground" aria-label="info">
              <Info className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 text-xs text-muted-foreground">
            {t("engine.eyebrow_help", { defaultValue: "As três métricas que dizem se o produto está a funcionar. Tudo o resto é vaidade." })}
          </PopoverContent>
        </Popover>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map((m) => {
          const tn = tone(m);
          const lab = labels[m.key];
          return (
            <div key={m.key} className="rounded-xl bg-muted/30 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-foreground">{lab.title}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {t("engine.target", { defaultValue: "alvo {{n}}%", n: m.target })}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${tn.dot}`} />
                <span className={`font-display text-2xl font-light tabular-nums ${tn.text}`}>
                  {m.pct == null ? "—" : `${m.pct}%`}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {m.pct == null
                    ? t("engine.insufficient", { defaultValue: "dados insuficientes" })
                    : t("engine.sample", { defaultValue: "n={{n}}", n: m.sample })}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{lab.sub}</p>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground/70">{lab.help}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}