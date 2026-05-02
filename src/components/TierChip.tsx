import { useState } from "react";
import { ChevronDown, ChevronUp, Shield, AlertTriangle } from "lucide-react";
import { toneChip, type Tone } from "@/lib/status-tone";
import type { Tier } from "@/server/phased/programming-tier.server";

const TIER_TONE: Record<Tier, Tone> = {
  remedial: "warn",      // amber: needs careful programming
  conservative: "warn",  // amber too — both signal "be cautious"
  advanced: "success",   // emerald: full library unlocked
};
// Distinguish remedial from conservative with a slightly different shade by
// composing a danger-leaning chip for remedial.
const REMEDIAL_OVERRIDE = "bg-blue-500/10 text-blue-300 border border-blue-500/30";

const TIER_LABEL: Record<Tier, { en: string; pt: string }> = {
  remedial: { en: "Remedial", pt: "Remediação" },
  conservative: { en: "Conservative", pt: "Conservativo" },
  advanced: { en: "Advanced", pt: "Avançado" },
};

const TIER_BLURB: Record<Tier, { en: string; pt: string }> = {
  remedial: {
    en: "Critical movement deficits or medical clearance required → 2 sessions/week, machines & bands only.",
    pt: "Défices críticos de movimento ou autorização médica → 2 sessões/semana, máquinas e bandas.",
  },
  conservative: {
    en: "2+ red flags, recovery compromised, or beginner training age → 3-4 sessions/week, safe progressions.",
    pt: "2+ sinais de alerta, recuperação comprometida ou iniciante → 3-4 sessões/semana, progressões seguras.",
  },
  advanced: {
    en: "Full movement competency → 5-6 sessions/week, full exercise library available.",
    pt: "Competência completa de movimento → 5-6 sessões/semana, biblioteca completa.",
  },
};

export type TierGuidelinesShape = {
  tier: Tier;
  sessionsPerWeekMin: number;
  sessionsPerWeekMax: number;
  rpeRange: string;
  forbiddenExercises: string[];
};

export function TierChip({
  tier,
  guidelines,
  locale = "en",
  onOverride,
  overridden,
}: {
  tier: Tier;
  guidelines?: TierGuidelinesShape | null;
  locale?: "en" | "pt";
  onOverride?: (next: Tier) => void;
  overridden?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tone = TIER_TONE[tier];
  const chipClass = tier === "remedial" ? REMEDIAL_OVERRIDE : toneChip(tone);
  const label = TIER_LABEL[tier][locale];
  const blurb = TIER_BLURB[tier][locale];

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {locale === "pt" ? "Nível programático" : "Programming tier"}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${chipClass}`}>
            {label}
          </span>
          {overridden && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-amber-300">
              <AlertTriangle className="h-2.5 w-2.5" />
              {locale === "pt" ? "Forçado" : "Override"}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-3 py-2.5 text-xs animate-fade-in">
          <p className="text-muted-foreground">{blurb}</p>
          {guidelines && (
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">
                  {locale === "pt" ? "Frequência: " : "Frequency: "}
                </span>
                {guidelines.sessionsPerWeekMin === guidelines.sessionsPerWeekMax
                  ? `${guidelines.sessionsPerWeekMin}×/wk`
                  : `${guidelines.sessionsPerWeekMin}-${guidelines.sessionsPerWeekMax}×/wk`}
              </li>
              <li>
                <span className="font-semibold text-foreground">RPE: </span>
                {guidelines.rpeRange}
              </li>
              {guidelines.forbiddenExercises.length > 0 && (
                <li>
                  <span className="font-semibold text-foreground">
                    {locale === "pt" ? "Proibidos: " : "Forbidden: "}
                  </span>
                  {guidelines.forbiddenExercises.slice(0, 6).join(", ")}
                  {guidelines.forbiddenExercises.length > 6 ? "…" : ""}
                </li>
              )}
            </ul>
          )}
          {onOverride && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(["remedial", "conservative", "advanced"] as Tier[])
                .filter((t) => t !== tier)
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const msg =
                        locale === "pt"
                          ? `Forçar nível ${TIER_LABEL[t].pt}? Pode comprometer recuperação ou subutilizar capacidade.`
                          : `Force ${TIER_LABEL[t].en} tier? May overload recovery or underuse capacity.`;
                      if (confirm(msg)) onOverride(t);
                    }}
                    className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
                  >
                    {locale === "pt" ? "→ " : "→ "}
                    {TIER_LABEL[t][locale]}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}