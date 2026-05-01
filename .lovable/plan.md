# Reopen A0a, then A1 + B1 + B3

A0a was prematurely closed: validation never expanded sections, so PAR-Q rows and the header progress strip were never seen at 375px. Fix both, re-validate properly, then continue with the next focused batch.

---

## Step 1 — A0a-1: PAR-Q + question/answer row pattern

`src/routes/clients_.$clientId.tsx` line 1189 wraps PAR-Q text + `<YesNo>` in a single `flex items-start justify-between gap-3` row — guarantees clipping at 375px because `<YesNo>` is fixed width and question text has no `min-w-0`.

Replace the wrapper for each PAR-Q `<li>`:

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
  <p className="min-w-0 flex-1 text-xs">
    <span className="font-semibold">{idx + 1}.</span>{" "}
    {t(`parq_block.questions.${key}` as const)}
  </p>
  <div className="shrink-0 self-start">
    <YesNo value={value} onChange={...} />
  </div>
</div>
```

Audit other "label left, control right" rows in the same file and apply the same pattern where the right side is a fixed-width pill/toggle group:

- "Lado dominante" row (handedness, in Anthropometrics)
- Lifestyle Yes/No toggle rows (sleep quality, stress markers if any)
- Nutrition toggle rows
- Anywhere `<Toggle>` or `<YesNo>` sits to the right of long label text

Rule: any flex row with text + fixed control becomes `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`, text gets `min-w-0 flex-1`, control gets `shrink-0 self-start sm:self-auto`.

`grid gap-2 sm:grid-cols-2` rows in Risk Stratification (smoking, BMI selects) are already responsive — leave them.

---

## Step 2 — A0a-2: Assessment header progress strip

Lines 1162-1175: `headerProgress` packs `<h2>`, progress bar, `t("progress", ...)` string ("Secção 1 de 14 · 100% completo · ~1 min restantes"), and `<SaveIndicator>` on a single flex row. The translated string has 4 dot-separated facts → overflows at 375px.

Restructure into two rows that collapse to one on `sm:`:

```tsx
<div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
  <div className="flex min-w-0 items-center gap-3">
    <h2 className="shrink-0 text-base font-bold">{t("title")}</h2>
    <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-secondary">
      <div className="h-full bg-accent/70 transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  </div>
  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tabular-nums text-muted-foreground">
    <span>{t("progress_short", { current: sectionNumber, total: totalSections, pct })}</span>
    <span className="hidden sm:inline">{t("progress_minutes", { minutes: minutesLeft })}</span>
    <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
  </div>
</div>
```

Add two new i18n keys to `src/i18n/locales/pt/assessment.json` and `en/assessment.json`:
- `progress_short`: `"Secção {{current}}/{{total}} · {{pct}}%"` (pt) / `"Section {{current}}/{{total}} · {{pct}}%"` (en)
- `progress_minutes`: `"~{{minutes}} min restantes"` / `"~{{minutes}} min left"`

Keep the existing `progress` key for backward compatibility but stop using it here.

`AssessmentSection` receives `headerProgress` — verify its outer wrapper allows wrapping (no `flex-nowrap`, no fixed height). If it currently sets `flex items-center`, switch to `flex flex-wrap items-center` or just render `{headerProgress}` directly without wrapping flex.

"Expandir tudo / Recolher tudo" row near line 2042: ensure parent uses `flex flex-wrap gap-2`.

---

## Step 3 — A0a-3: Re-validate (h) properly

Use browser tools in this order:

1. `browser--navigate_to_sandbox` → `/clients/bfc11030-9a47-40fb-94a7-68945c73789d` at width 375
2. `browser--act` → click "Expandir tudo"
3. `browser--screenshot` (full page implicit), then scroll via `browser--act` ("scroll to bottom") and screenshot again
4. Repeat at 414, 768
5. Verify: zero horizontal scrollbar; PAR-Q `Sim`/`Não` buttons visible; header strip wraps cleanly; no truncated mid-word text in section bodies

If any clipping remains after Step 1+2, fix the offending row before proceeding.

---

## Step 4 — A1: inline "Última avaliação" link

In `src/routes/clients_.$clientId.tsx`:

- Delete the `<ClientSnapshotCard ... />` render (line 1134-1140).
- Delete the `ClientSnapshotCard` function definition starting line 2549 (or leave it dead if simpler — preference is to delete to keep file tidy).
- Add `id="sintese-da-avaliacao"` to the synthesis dashboard wrapper (the section that already lives at the bottom of the assessment — locate via `rg "synthesis|Síntese|sintese|ComplianceDashboard|ComplianceSnapshot" src/routes/clients_.$clientId.tsx` and tag the outermost wrapper of that block).
- In the route header area (just below `<ClientHeader>` / where the snapshot card was), render a single inline link only when `assessment.last_assessed_at` (or equivalent — check the actual field; fall back to `lastSavedAt`) exists:

```tsx
{lastSavedAt && (
  <a
    href="#sintese-da-avaliacao"
    onClick={(e) => {
      e.preventDefault();
      document.getElementById("sintese-da-avaliacao")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }}
    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
  >
    Última avaliação · {formatDate(lastSavedAt)} <ArrowRight className="h-3 w-3" />
  </a>
)}
```

Keep date format consistent with existing `pt-PT` formatter used elsewhere in the file.

---

## Step 5 — B1: replace 4 ScreenItems with 6 MovementPatternCards

Lines 1425-1428 currently render 4 `<ScreenItem>` (squat / overhead / hinge / single_leg). Replace with a grid of 6 `<MovementPatternCard>`:

```tsx
<div className="grid gap-3 lg:grid-cols-2">
  {PATTERN_IDS.map((p) => (
    <MovementPatternCard
      key={p}
      pattern={p}
      formCriteria={assessment[`${p}_form_criteria`] ?? {}}
      capacity={assessment[`${p}_capacity`] ?? {}}
      notAssessed={!!assessment.screen_not_assessed?.[p]}
      onFormCriteria={(next) =>
        setAssessment({ ...assessment, [`${p}_form_criteria`]: next })
      }
      onCapacity={(next) =>
        setAssessment({ ...assessment, [`${p}_capacity`]: next })
      }
      onNotAssessed={(v) =>
        setAssessment({
          ...assessment,
          screen_not_assessed: { ...(assessment.screen_not_assessed ?? {}), [p]: v },
        })
      }
    />
  ))}
</div>
```

Hydration (`mapRowToAssessment` near line 470): add for each pattern:
```ts
squat_form_criteria: a.squat_form_criteria ?? {},
squat_capacity: a.squat_capacity ?? {},
// ...repeat for hinge, push, pull, carry, lunge
screen_not_assessed: a.screen_not_assessed ?? {},
```

Defaults in the initial assessment state object (line ~376): same 13 fields, all `{}`.

`buildAssessmentPayload` (line 215): include the 13 new columns in the persisted payload; drop the legacy `*_score` / `*_note` writes (the columns stay in the DB; we just stop writing).

`PROV_SECTION_FIELDS.screen` (line 85+): replace the legacy entries with:
```ts
screen: [
  "squat_form_criteria","squat_capacity",
  "hinge_form_criteria","hinge_capacity",
  "push_form_criteria","push_capacity",
  "pull_form_criteria","pull_capacity",
  "carry_form_criteria","carry_capacity",
  "lunge_form_criteria","lunge_capacity",
  "screen_not_assessed",
],
```

Delete the now-unused `ScreenItem` component (function near line 2310) to keep the file lean.

`isSectionComplete("screen", ...)`: count a pattern as "covered" if either `screen_not_assessed[p] === true` OR `formScore(form_criteria[p]) >= 3`. Section complete when all 6 patterns are covered.

---

## Step 6 — B3: current_capacity_vs_pb slider in Setup + brief pill

Setup section is the `training` `<SectionBlock>` at line 1318. Above the experience/days grid, add:

```tsx
<div className="rounded-md border border-border bg-background/40 p-3">
  <div className="mb-2 flex items-center justify-between gap-2">
    <Label className="text-xs">Capacidade actual vs PB</Label>
    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
      {assessment.current_capacity_vs_pb ?? 5}/10
    </span>
  </div>
  <Slider
    min={1} max={10} step={1}
    value={[assessment.current_capacity_vs_pb ?? 5]}
    onValueChange={([v]) =>
      setAssessment({ ...assessment, current_capacity_vs_pb: v })
    }
  />
  <p className="mt-1.5 text-[11px] text-muted-foreground">
    1 = muito longe do PB (modo reconstrução) · 5 = a meio · 10 = no PB ou acima (modo progressão).
  </p>
</div>
```

Hydrate in `mapRowToAssessment`: `current_capacity_vs_pb: a.current_capacity_vs_pb ?? null,`. Default in initial state: `null`. Persist via `buildAssessmentPayload`.

Add `current_capacity_vs_pb` to `PROV_SECTION_FIELDS.training`.

`section-map.ts` already maps it (confirmed in earlier turn). No server change here.

`BriefEditor.tsx` "Schedule & emphasis" card: render an inline pill near the days/duration row:

```tsx
{typeof brief.current_capacity_vs_pb === "number" && (
  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
    Capacidade actual: {brief.current_capacity_vs_pb}/10 — {
      brief.current_capacity_vs_pb <= 3 ? "modo reconstrução" :
      brief.current_capacity_vs_pb >= 8 ? "modo progressão" : "modo manutenção"
    }
  </span>
)}
```

If `brief` doesn't currently expose this field, read it from the assessment payload that feeds the brief card (check `BriefEditor` props — likely needs to be threaded through from the parent).

---

## Step 7 — Validate before reporting

After typecheck passes:

1. Navigate to `/clients/bfc11030-9a47-40fb-94a7-68945c73789d`
2. Click "Expandir tudo"
3. Screenshot at 375, 414, 768, 1024, 1280
4. Confirm:
   - (a) Snapshot card gone; "Última avaliação · DD/MM/YYYY →" link present and scrolls
   - (d) 6 movement pattern cards render with checkboxes (no sliders)
   - (e) Capacity inputs visible below criteria
   - (f) `current_capacity_vs_pb` slider visible in Setup; pill renders in BriefEditor when value present
   - (h) Zero horizontal scroll at 375/414; PAR-Q Sim/Não tappable; header strip wraps cleanly
   - (i) Hamburger nav still works <768px

## Out of scope this turn

A2 (locale stale-detection + re-analyze loop), A3 (full pt-PT sweep), A4 (hide deterministic stub), A5 (BP inputs + crisis gate), B4 (radar rewrite). Queued for the next two turns: A5+B4 together, then A2+A3.

## Technical notes

- `Slider` and `Label` already imported in the file (verify before adding).
- `ArrowRight` from `lucide-react` likely already imported; if not, add to the existing lucide import.
- No new migrations: the 13 JSONB columns + `current_capacity_vs_pb` were added in the previous turn's migration.
- `PROV_SECTION_FIELDS` drives the `provenance` badges — not strictly required for B1 to function, but keeps the "user-edited" indicator working on the new fields.
- Do not touch `*_score` / `*_note` columns in DB; just stop reading/writing them from the client.
