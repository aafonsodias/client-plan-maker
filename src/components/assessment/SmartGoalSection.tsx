import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  GOAL_TEMPLATES,
  GOAL_CATEGORIES,
  DURATION_PRESETS,
  deadlineFromDuration,
  type GoalTemplate,
  type GoalCategory,
} from "@/lib/goal-templates";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface SmartGoalValue {
  smart_specific: string | null;
  smart_measurable: string | null;
  smart_deadline: string | null;
  primary_goal: string | null;
}

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch {
    return iso;
  }
}

function durationDeadline(p: (typeof DURATION_PRESETS)[number]): string {
  return deadlineFromDuration({ weeks: p.weeks, months: p.months, years: p.years });
}

export function SmartGoalSection({
  value,
  onChange,
}: {
  value: SmartGoalValue;
  onChange: (next: SmartGoalValue) => void;
}) {
  const { t, i18n } = useTranslation("assessment");
  const dateLocale = i18n.language === "pt" ? "pt-PT" : i18n.language === "es" ? "es-ES" : i18n.language === "hi" ? "hi-IN" : "en-GB";

  // State: which category is active for the chip filter, the last template applied, and manual reveal.
  const [activeCat, setActiveCat] = useState<GoalCategory>("strength");
  const [lastApplied, setLastApplied] = useState<GoalTemplate | null>(null);
  const [manualRevealed, setManualRevealed] = useState<boolean>(
    Boolean(value.smart_specific || value.smart_measurable || value.smart_deadline)
  );
  const [pendingTpl, setPendingTpl] = useState<GoalTemplate | null>(null);

  // Duration mode: which preset is selected, or "custom" for the date input.
  const initialMode: string = (() => {
    if (!value.smart_deadline) return "12w";
    // try to match a preset
    for (const p of DURATION_PRESETS) {
      if (durationDeadline(p) === value.smart_deadline) return p.id;
    }
    return "custom";
  })();
  const [durationMode, setDurationMode] = useState<string>(initialMode);

  const filtered = useMemo(() => GOAL_TEMPLATES.filter((x) => x.category === activeCat), [activeCat]);

  function applyTemplate(tpl: GoalTemplate) {
    const specific = t(tpl.specific_key as never) as string;
    const measurable = t(tpl.measurable_key as never) as string;
    const deadline = deadlineFromDuration({ weeks: tpl.default_weeks });
    onChange({
      smart_specific: specific,
      smart_measurable: measurable,
      smart_deadline: deadline,
      primary_goal: tpl.category,
    });
    setLastApplied(tpl);
    setManualRevealed(true);
    // sync duration mode if matches a preset
    const matched = DURATION_PRESETS.find((p) => durationDeadline(p) === deadline);
    setDurationMode(matched?.id ?? "custom");
  }

  function handleTemplateClick(tpl: GoalTemplate) {
    // If user has customised relative to lastApplied, confirm before overwriting.
    const customised = (() => {
      if (!lastApplied) {
        // no template applied yet — allow overwrite if any field has content
        return Boolean(value.smart_specific || value.smart_measurable);
      }
      const prevSpec = t(lastApplied.specific_key as never) as string;
      const prevMeas = t(lastApplied.measurable_key as never) as string;
      return value.smart_specific !== prevSpec || value.smart_measurable !== prevMeas;
    })();
    if (customised) {
      setPendingTpl(tpl);
      return;
    }
    applyTemplate(tpl);
  }

  function handleDurationChip(id: string) {
    setDurationMode(id);
    if (id === "custom") return;
    const preset = DURATION_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onChange({ ...value, smart_deadline: durationDeadline(preset) });
  }

  return (
    <div className="space-y-4">
      {/* Category chips */}
      <div>
        <p className="eyebrow mb-1.5 text-muted-foreground">{t("goals.category_label")}</p>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_CATEGORIES.map((cat) => {
            const selected = cat === activeCat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCat(cat)}
                aria-pressed={selected}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                  selected ? "bg-muted/60 text-foreground" : "bg-muted/25 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                {t(`goals.cat.${cat}` as never) as string}
              </button>
            );
          })}
        </div>
      </div>

      {/* Template list for active category */}
      <div className="space-y-1.5">
        {filtered.map((tpl) => {
          const isActive = lastApplied?.id === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleTemplateClick(tpl)}
              className={cn(
                "flex w-full items-start justify-between rounded-md px-3 py-2 text-left transition",
                isActive ? "bg-muted/55 ring-1 ring-inset ring-border" : "bg-muted/30 hover:bg-muted/45"
              )}
            >
              <p className="body-prose flex-1 text-[13px] leading-snug text-foreground">
                {t(tpl.specific_key as never) as string}
              </p>
              <span className="label-caps ml-3 shrink-0 tabular-nums text-muted-foreground">
                {tpl.default_weeks}w
              </span>
            </button>
          );
        })}
      </div>

      {/* Pending overwrite confirmation */}
      {pendingTpl && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-[12px]">
          <p className="mb-2 text-foreground">{t("goals.confirm_overwrite")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { applyTemplate(pendingTpl); setPendingTpl(null); }}
              className="rounded-md bg-foreground/90 px-2.5 py-1 text-[11px] font-medium text-background hover:bg-foreground"
            >
              {t("goals.confirm_replace")}
            </button>
            <button
              type="button"
              onClick={() => setPendingTpl(null)}
              className="rounded-md bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60"
            >
              {t("goals.confirm_keep")}
            </button>
          </div>
        </div>
      )}

      {/* Manual reveal link (when no template + no data yet) */}
      {!manualRevealed && (
        <button
          type="button"
          onClick={() => setManualRevealed(true)}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("goals.fill_manual")}
        </button>
      )}

      {/* Manual fields */}
      {manualRevealed && (
        <div className="space-y-3 rounded-md bg-muted/20 p-3">
          <div className="space-y-1">
            <Label className="label-caps text-[10px] text-muted-foreground">{t("goal_block.specific")}</Label>
            <Input
              className="h-8 text-sm"
              value={value.smart_specific ?? ""}
              onChange={(e) => onChange({ ...value, smart_specific: e.target.value })}
              placeholder={t("goal_block.specific_placeholder") as string}
            />
          </div>
          <div className="space-y-1">
            <Label className="label-caps text-[10px] text-muted-foreground">{t("goal_block.measurable")}</Label>
            <Textarea
              className="min-h-0 py-1.5 text-sm"
              rows={2}
              value={value.smart_measurable ?? ""}
              onChange={(e) => onChange({ ...value, smart_measurable: e.target.value })}
              placeholder={t("goal_block.measurable_placeholder") as string}
            />
          </div>

          {/* Deadline as duration chips */}
          <div className="space-y-1.5">
            <Label className="label-caps text-[10px] text-muted-foreground">{t("goal_block.deadline")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((p) => {
                const selected = durationMode === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleDurationChip(p.id)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      selected ? "bg-muted/60 text-foreground" : "bg-muted/25 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    {t(`goals.duration.${p.id}` as never) as string}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleDurationChip("custom")}
                aria-pressed={durationMode === "custom"}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  durationMode === "custom" ? "bg-muted/60 text-foreground" : "bg-muted/25 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                {t("goals.duration.custom")}
              </button>
            </div>
            {durationMode === "custom" ? (
              <Input
                className="h-8 text-sm"
                type="date"
                value={value.smart_deadline ?? ""}
                onChange={(e) => onChange({ ...value, smart_deadline: e.target.value })}
              />
            ) : (
              value.smart_deadline && (
                <p className="body-prose text-[11px] text-muted-foreground">
                  {t("goals.duration.resolved", { date: formatDate(value.smart_deadline, dateLocale) })}
                </p>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}