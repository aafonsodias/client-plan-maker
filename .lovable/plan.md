## Round A — Self-Intake / Assessment stabilisation

Goal: one canonical data flow `assessment → completion → implications → summary → PDF`, no duplicated truths, no broken keys, no silent "incomplete" toasts. Smallest safe patches only — no design overhaul, no AI calls, no migrations.

### What is broken today (verified)

1. **Two competing implication engines**: `RxImplications` (rich, in UI, only PT, hard-coded copy) lives at the bottom of `src/routes/clients_.$clientId.tsx`. The PDF uses a *separate* `buildAssessmentImplications` in `src/lib/assessment-implications.ts` (leaner, EN/PT). They drift.
2. **Injuries completion bug**: `isSectionCompleteForPhase("injuries", a)` checks `a.injuries`, `a.pain_areas`, `a.no_injuries`. The body map writes to a separate table (`assessment_injuries` via `InjuriesBodyMapBlock`). Adding 2 injuries on the map does **not** flip the section to complete.
3. **Meds completion bug**: requires `hasVal(a.medications) || a.med_flags.length > 0`. A client who takes nothing has no toggle to declare it → can't complete.
4. **Movement Screen bug**: requires `formScore(fc) >= 3` for every pattern unless `screen_not_assessed[p] === true`. Trainers fill `*_capacity` thinking that's enough; it isn't. Also no per-pattern explanation of what is missing.
5. **Conclude UX**: only a `toast.error("Self intake incomplete")`. No structured list. Sidebar checkmarks rely on the same validator but feedback is invisible.
6. **`risk_block.bmi_use_auto`**: key exists in PT only; EN/ES/HI fall back to the raw key on screen. Visual styling is also a bare `<button class="underline">`.
7. **Bioimpedance button**: hard-coded PT string `"Importar bioimpedância"`, outline button, no helper text, looks unfinished.
8. **Mobility 1–5**: `ScoreRow` shows a number scale with no per-test rubric.

### Files to touch (scoped)

- New: `src/lib/assessment-completion.ts` — canonical validator (extends `assessment-phase.ts`, returns missing items).
- New: `src/components/assessment/MissingItemsPanel.tsx` — Conclude-failure panel.
- Edit: `src/lib/assessment-phase.ts` — fix `injuries`, `meds`, `screen` rules; accept extra `injuriesCount` arg.
- Edit: `src/routes/clients_.$clientId.tsx` — wire injuries count into validator, add "no medications" toggle, render MissingItemsPanel on Conclude, fix BMI override, polish BIA button, mobility rubric, replace inline `RxImplications` builders with shared module (Round A scope: keep PT cards in UI but source from new module).
- New: `src/lib/assessment-implications.ts` — extend with the rich PT/EN rules currently in `RxImplications`. Single source for UI + PDF.
- Edit: `src/lib/pdf-assessment-summary.ts` — already consumes `buildAssessmentImplications`; verify all sections appear, add BMI-muscular note, meds-none line, injuries summary from `assessment_injuries`.
- Edit: `src/i18n/locales/{en,pt,es,hi}/assessment.json` + `common.json` — add missing keys (`bmi_use_auto`, `bmi_athletic_*`, `meds_block.none_toggle`, `mobility.rubric_*`, `bia_*`, `assessment_gate.missing_*`).
- Edit: `src/server/injuries.functions.ts` — expose lightweight `countInjuries({ assessmentId })` already covered by `listInjuries`; pass count up via `useQuery` in client page.

### Implementation outline

**A. Unified validator** (`src/lib/assessment-completion.ts`)
```ts
type MissingItem = {
  sectionId: AssessmentSectionId;
  sectionLabelKey: string;     // "sections.injuries.title"
  reason: string;              // human PT/EN
  required: boolean;
  scrollAnchor: string;        // section DOM id
};
type CompletionReport = {
  overall: AssessmentPhase;
  perSection: Record<AssessmentSectionId, { complete: boolean; missing: MissingItem[] }>;
  missingRequired: MissingItem[];
  recommended: MissingItem[];
};
buildCompletionReport(a, ctx: { injuriesCount: number }): CompletionReport
```
Sidebar reads `perSection[id].complete`; Conclude reads `missingRequired`. Same source.

**B. Bug fixes inside `isSectionCompleteForPhase`**
- `injuries`: complete if `a.no_injuries === true` **or** `injuriesCount > 0` (passed via ctx) **or** legacy `a.injuries` text. Severity validation (each row has `severity` + `body_zone`) already enforced server-side.
- `meds`: complete if `a.no_meds === true` **or** `med_flags.length > 0` **or** `hasVal(a.medications)`.
- `screen`: keep `formScore(fc) >= 3` rule but, if a pattern has *partial* form data, surface it in `missing` with the specific pattern name; do not auto-pass on capacity alone.

**C. Medications "none" toggle**
Add a checkbox at the top of `meds` block: PT *"Não tomo medicamentos nem suplementos"* / EN equivalent. Toggling clears `med_flags`/`medications`/`others`; adding any med auto-unsets it. Persisted on `assessment.no_meds` (jsonb-stored under `extended.no_meds` to avoid migration — or new boolean if a column already exists; checked: not present, will use `extended.no_meds`).

**D. Conclude UX** (`MissingItemsPanel`)
Replaces the current `toast.error` path. Inline expandable card under the Conclude CTA listing each missing item with a "Ir para secção" button (calls `setActiveSection(id)` + scroll). Keep the toast for screen-reader announce.

**E. Standardised implication cards**
Promote the 10 `buildRxItems_*` functions from the route file into `src/lib/assessment-implications.ts` with a shared `RxItem` type:
```ts
type RxItem = { key, severity, titleKey, whyKey, prescriptionKey, nextActionKey, sourceSection, includeInPdf }
```
Render in UI via a single `<RxImplicationsCard items={...}>` component (extracted to `src/components/assessment/RxImplicationsCard.tsx`). PDF iterates the same list.

**F. PDF integration**
`pdf-assessment-summary.ts` already calls `buildAssessmentImplications`. After E, that function returns the unified set (with `includeInPdf` filter). Add:
- Meds line: "Medicação/suplementos: nenhum declarado." when `no_meds`.
- BMI line: append "(interpretação atlética/muscular aplicada)" when `risk.bmi_category === "muscular"`.
- Injuries summary: query `assessment_injuries` by `assessmentId` in the existing PDF data fetch path.
- Draft watermark: when `overall !== "complete"`, header reads "RASCUNHO".

**G. Mobility rubric**
Extend `ScoreRow` (already accepts `hint`) to optionally render a 1-line-per-score rubric below the slider. Per-test rubric strings added to i18n: shoulder/hip/ankle/thoracic/wrist/knee. No layout change beyond a `<details>` "Critérios".

**H. BMI muscular override**
- Add missing keys to `en/es/hi`. Rename PT `bmi_use_auto` → keep key, add `bmi_athletic_label`, `bmi_athletic_help`.
- Replace text-link toggle with a small segmented chip (Auto / Atlético) styled like the rest of the assessment chips. State drives `risk.bmi_category`.

**I. Bioimpedance button**
- Move "Importar bioimpedância" button into the existing "Avançado · requer equipamento" `<details>` block (it already houses BF method).
- Style as a card-style action with subtitle "Opcional — melhora a interpretação da composição corporal" / EN equivalent. i18n keys added.

**J. Slides parity audit**
- One read-pass diff `src/i18n/locales/{en,pt}/intake.json` and `assessment.json`. Output a short `mem://audits/slides-parity-2026-05.md` listing keys where one locale is materially shorter/weaker. **No copy is overwritten in this round** — audit deliverable only, plus a follow-up backlog entry.

**K. No regressions**
- Keep all existing keys; only add. Keep `isSectionCompleteForPhase` signature backward-compatible (extra arg optional, defaults to no injuries count → falls back to legacy fields).
- No migrations. New `no_meds` lives in `assessment.extended` jsonb; new `bmi_athletic_explicit` likewise.

### Non-goals (explicit)

- No new AI calls.
- No new DB migrations.
- No redesign of the assessment page chrome.
- No changes to plan generation pipeline.
- No replacement of stronger PT slide copy (audit only).

### Manual QA checklist (post-implementation)

1. Client adds 2 injuries via body map → Injuries flips to complete; Conclude proceeds.
2. Client toggles "Não tomo medicamentos" → Meds complete; PDF prints "nenhum declarado".
3. Movement Screen with all 6 patterns at form-score ≥3 → complete; with one missing → MissingItemsPanel names that pattern.
4. Conclude on incomplete intake → structured panel with "Ir para secção" buttons (375px viewport).
5. Sidebar checkmark count == validator's `done` count, always.
6. BMI muscular toggle is a labelled chip, no raw `risk_block.bmi_use_auto` visible in any locale.
7. BIA button has subtitle, sits inside Avançado, doesn't look orphaned.
8. Mobility rubric expandable per test.
9. PDF includes: implications, BMI w/ override note, meds-none line, injuries summary; if intake incomplete, header shows RASCUNHO.

### Final report (after implementation)

Will list: files changed, bugs fixed, validator behaviour, missing-field UX, implication standardisation, PDF wiring, mobility rubric, BMI/BIA polish, slides audit deliverable, remaining manual-QA items.