import type { Billing } from "@/lib/pricing-tiers";
import { ANNUAL_DISCOUNT_PCT } from "@/lib/pricing-tiers";
import { useTranslation } from "react-i18next";

/**
 * R71 — Segmented Mensal/Anual toggle for the landing pricing section.
 * Pure presentation, design-token only (no hardcoded colours beyond amber
 * accent which is already a project-wide convention).
 */
export function PricingToggle({
  billing,
  onChange,
}: {
  billing: Billing;
  onChange: (b: Billing) => void;
}) {
  const { t } = useTranslation("plan");
  const monthlyLabel = t("landing.pricing.toggle.monthly", "Mensal");
  const annualLabel = t("landing.pricing.toggle.annual", "Anual");
  const saveChip = t("landing.pricing.toggle.save_badge", "−{{pct}}% · 2 meses grátis", {
    pct: ANNUAL_DISCOUNT_PCT,
  });

  return (
    <div
      role="radiogroup"
      aria-label={t("landing.pricing.toggle.aria", "Período de pagamento")}
      className="inline-flex items-center gap-3"
    >
      <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-[var(--shadow-elegant)]">
        {(["monthly", "annual"] as const).map((b) => {
          const active = billing === b;
          return (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(b)}
              className={`relative rounded-full px-4 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-accent text-accent-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {b === "monthly" ? monthlyLabel : annualLabel}
            </button>
          );
        })}
      </div>
      {billing === "annual" && (
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          {saveChip}
        </span>
      )}
    </div>
  );
}