import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import {
  GOAL_TEMPLATES,
  GOAL_CATEGORIES,
  DURATION_PRESETS,
  deadlineFromDuration,
  type GoalTemplate,
  type GoalCategory,
} from "@/lib/goal-templates";
import { matchAspiration, type SkillAspiration } from "@/lib/skill-aspirations";
import { logUnmatchedAspiration } from "@/server/aspirations.functions";
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
  clientId,
}: {
  value: SmartGoalValue;
  onChange: (next: SmartGoalValue) => void;
  /** Required to log unmatched aspirations for founder review. */
  clientId?: string;
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

  // ── Custom skill aspiration builder ────────────────────────────────────
  const logAspirationFn = useServerFn(logUnmatchedAspiration);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [aspirationInput, setAspirationInput] = useState("");
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [matched, setMatched] = useState<SkillAspiration | null>(null);
  const [logState, setLogState] = useState<"idle" | "logging" | "logged">("idle");

  function runSearch() {
    const text = aspirationInput.trim();
    if (text.length < 3) return;
    const m = matchAspiration(text);
    setSearchedFor(text);
    setMatched(m);
    setLogState("idle");
    if (!m && clientId) {
      setLogState("logging");
      logAspirationFn({ data: { clientId, text } })
        .then(() => setLogState("logged"))
        .catch(() => setLogState("idle"));
    }
  }

  function applyAspiration(a: SkillAspiration) {
    const specific = t(a.specific_key as never) as string;
    const measurable = t(a.measurable_key as never) as string;
    const deadline = deadlineFromDuration({ weeks: a.default_weeks });
    onChange({
      smart_specific: specific,
      smart_measurable: measurable,
      smart_deadline: deadline,
      primary_goal: "skill",
    });
    setManualRevealed(true);
    setActiveCat("skill");
    setLastApplied(null);
    const matchedPreset = DURATION_PRESETS.find((p) => durationDeadline(p) === deadline);
    setDurationMode(matchedPreset?.id ?? "custom");
    setBuilderOpen(false);
    setAspirationInput("");
    setSearchedFor(null);
    setMatched(null);
  }

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
                  selected
                    ? "bg-foreground/10 ring-1 ring-foreground/30 text-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40"
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
          // R-F: derive selected state from current value (survives reload),
          // falling back to lastApplied for the in-memory case.
          const tplSpecific = t(tpl.specific_key as never) as string;
          const isActive =
            lastApplied?.id === tpl.id ||
            (Boolean(value.smart_specific) && value.smart_specific === tplSpecific);
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleTemplateClick(tpl)}
              aria-pressed={isActive}
              className={cn(
                "flex w-full items-start justify-between rounded-md px-3 py-2 text-left transition",
                isActive
                  ? "bg-primary/5 ring-2 ring-primary hover:bg-primary/10"
                  : "bg-muted/30 hover:bg-muted/45"
              )}
            >
              <p className="body-prose flex-1 text-[13px] leading-snug text-foreground">
                {tplSpecific}
              </p>
              <span className={cn(
                "label-caps ml-3 shrink-0 tabular-nums",
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              )}>
                {tpl.default_weeks}w
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom skill aspiration builder ─ collapsible deterministic search */}
      {activeCat === "skill" && (
        <div className="rounded-md border border-border/50 bg-muted/15 p-2.5">
          {!builderOpen ? (
            <button
              type="button"
              onClick={() => setBuilderOpen(true)}
              className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {t("aspirations.builder.open")}
            </button>
          ) : (
            <div className="space-y-2">
              <div>
                <Label className="label-caps text-[10px] text-muted-foreground">
                  {t("aspirations.builder.label")}
                </Label>
                <p className="body-prose text-[10px] text-muted-foreground">
                  {t("aspirations.builder.hint")}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Input
                  className="h-8 flex-1 text-sm"
                  value={aspirationInput}
                  onChange={(e) => setAspirationInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
                  placeholder={t("aspirations.builder.placeholder") as string}
                />
                <button
                  type="button"
                  onClick={runSearch}
                  disabled={aspirationInput.trim().length < 3}
                  className="rounded-md bg-foreground/90 px-3 py-1 text-[11px] font-medium text-background hover:bg-foreground disabled:opacity-40"
                >
                  {t("aspirations.builder.search")}
                </button>
              </div>

              {searchedFor && matched && (
                <div className="space-y-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/[0.05] p-2.5">
                  <p className="label-caps text-[10px] text-emerald-700 dark:text-emerald-400">
                    {t("aspirations.builder.matched")}
                  </p>
                  <p className="body-prose text-[12px] text-foreground">
                    {t(matched.specific_key as never) as string}
                  </p>
                  <p className="body-prose text-[11px] text-muted-foreground">
                    {t(matched.measurable_key as never) as string}
                  </p>
                  <p className="body-prose text-[10px] italic text-muted-foreground">
                    {t(matched.prerequisite_note_key as never) as string}
                  </p>
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => applyAspiration(matched)}
                      className="rounded-md bg-foreground/90 px-2.5 py-1 text-[11px] font-medium text-background hover:bg-foreground"
                    >
                      {t("aspirations.builder.apply")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSearchedFor(null); setMatched(null); }}
                      className="rounded-md bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60"
                    >
                      {t("aspirations.builder.cancel")}
                    </button>
                  </div>
                </div>
              )}

              {searchedFor && !matched && (
                <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/[0.05] p-2.5">
                  <p className="label-caps text-[10px] text-amber-700 dark:text-amber-400">
                    {t("aspirations.builder.unmatched_title")}
                  </p>
                  <p className="body-prose text-[11px] text-foreground">
                    {t("aspirations.builder.unmatched_body", { text: searchedFor })}
                  </p>
                  {logState === "logged" && (
                    <p className="body-prose text-[10px] italic text-muted-foreground">
                      {t("aspirations.builder.logged")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
            <p className="body-prose text-[10px] text-muted-foreground">{t("goal_block.specific_hint")}</p>
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
            <p className="body-prose text-[10px] text-muted-foreground">{t("goal_block.measurable_hint")}</p>
          </div>

          {/* Deadline as duration chips */}
          <div className="space-y-1.5">
            <Label className="label-caps text-[10px] text-muted-foreground">{t("goal_block.deadline")}</Label>
            <p className="body-prose text-[10px] text-muted-foreground">{t("goal_block.deadline_hint")}</p>
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
                      selected
                        ? "bg-foreground/10 ring-1 ring-foreground/30 text-foreground"
                        : "bg-muted/20 text-muted-foreground hover:bg-muted/40"
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
                  durationMode === "custom"
                    ? "bg-foreground/10 ring-1 ring-foreground/30 text-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40"
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