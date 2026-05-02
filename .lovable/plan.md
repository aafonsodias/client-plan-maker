
## Goals (max impact, min surface)

Five small, surgical fixes — no new features, no schema changes.

---

### 1. Edit on a finalized plan = unlock the table inline (no re-approval)

**Problem (img 1 + img 2):** clicking *Edit* on a completed plan kicks the trainer back to the Microcycle stage where Day 1 is the gate — all other days are hidden, you have to re-Approve Day 1, then re-Approve the microcycle, even though the plan is already finalized.

**Fix in `src/routes/plans.$planId.tsx` (Edit tab handler, ~line 375-387):**
- Drop the `if (isPhasedComplete) navigate(/microcycle)` redirect.
- For phased-complete plans, set `mode = "edit"` and render `MesocycleTableView` (already imported, already used in View) with `editable={true}`. That component already supports inline editing of every day across every week — exactly what the user expects.
- Keep the legacy non-phased branch (`WeekBlock` editor) for old plans only.

**Fix in `src/routes/plans.$planId.microcycle.tsx`:**
- When `plan.status === "finalized"` (already-printed plan), short-circuit the gate UI: hide the green "Approve microcycle" CTA and the "Approve Day 1" gate, render every day already, and replace both buttons with a single subtle "Save changes" pill that only lights up (emerald) when the trainer actually edits a value (`dirty` state). Untouched = neutral, no glow, no pulse. This kills the "two buttons for the same thing" confusion (green top + black "Approve Day 1").

---

### 2. Progression sparkline: lines, not isolated dots

**Problem (img 3):** Leg Press shows three isolated black dots instead of a green polyline.

**Root cause in `src/components/ProgressionExerciseCard.tsx` (Sparkline):** when all three deltas are `0`, `range = 0 → 1`, and all four points collapse to the same `y` — the polyline renders as a zero-length path that some browsers paint as nothing, leaving only the dots. Color also falls back to `TREND_FLAT` (muted grey, looks black on light bg).

**Fix:**
- When `cum` values are all equal, draw the polyline as a horizontal centered line (force a visible stroke) and use a soft amber for the "hold/deload" case so it never reads as broken.
- Always stroke the line in the trend color (emerald up, rose down, amber flat) — never grey on grey.
- Reduce circle radius to `1.2` so the line dominates visually.

**Add rationale per delta:** the schema row already carries `r.rationale` (rendered once at the bottom). Surface a 1-line `r.tuneup_reason` (or fall back to `rationale`) under the W2/W3/W4 inputs, italic muted, so the trainer sees *why* this week was tuned up/down. If the field doesn't exist on the schema yet, show the existing `rationale` per row (already wired) — this is a UI-only change.

---

### 3. Landing mockup → 2-week microcycle table + personalisation hint

**Problem:** the current "Monday — Lower Body Strength" card shows a single session and a linearly progressing back-squat history that looks fake. The user wants a tighter mockup: a small **2-week microcycle table** (Day 1 / Day 2 across W1 + W2) with realistic week-over-week deltas (not pure linear), plus a hint chip "Personalised from the assessment".

**Fix in `src/routes/index.tsx`:**
- Replace the single `SessionMockup` card with a compact `MicrocycleTableMockup`: a 3-column grid (Exercise · W1 · W2) for Day 1 (4 rows) and Day 2 (3 rows), styled like the real `MesocycleTableView` (border/divide, tabular-nums, amber Δ chips like `+5kg`, `+1rep`, one `-5%` deload to show it isn't naively linear).
- Add a Forge-aesthetic flourish on the back-squat history strip: a sparkline that climbs *then dips* (deload week 4) instead of marching straight up, mirroring the in-app sparkline language. Keep the amber `BrandMark` glow treatment.
- Add a small chip above the table: `<InfoHint>` + "Personalizado a partir do teu assessment / Personalised from your assessment" using existing `landing.mockups.personalized_for` plus a new `personalized_hint` key.

All new strings added to both `en/plan.json` and `pt/plan.json` under `landing.mockups`.

---

### 4. Pricing copy: softer free-try framing, drop "Founder" public mention

**Problem (PT/EN):** current copy says "Para continuar: ou és Founder, ou aderes ao Pro" — but Founder = the user himself, not a tier offered to others. Also reads too transactional.

**Fix in `landing.pricing` (both `en/plan.json` and `pt/plan.json`):**

Beta card →
- PT title: **"Experimenta — sem cartão"**, EN: **"Try it — no card"**
- PT period: **"durante o teu primeiro plano"**, EN: **"for your first plan"**
- Features (4 lines, value-led, not transactional):
  1. PT: "Faz a avaliação completa, slide a slide" / EN: "Walk through the full assessment, slide by slide"
  2. PT: "Recebe o teu primeiro plano em PDF com a tua marca" / EN: "Get your first plan as a branded PDF"
  3. PT: "Uma semana de logbook para sentires o ciclo de feedback" / EN: "One week of logbook to feel the feedback loop"
  4. PT: "Continuas a usar enquanto fizer sentido para ti" / EN: "Keep using it as long as it earns its place"
- CTA: PT **"Começar agora"**, EN **"Start now"**

Pro card →
- Keep "Coming soon" badge.
- Drop the "ou és Founder" line entirely.
- Reframe features around the *loop value* (not feature parity): unlimited plans, weekly AI nudges from logged sessions, custom-domain PDFs, priority support.
- CTA unchanged ("Notify me" / "Avisa-me").

The "Founder" tier disappears from public copy; the badge in the AppShell stays as the user's personal marker (already private).

---

### 5. Visible-when-logged-in landing — already shipped earlier turn

No change needed; `index.tsx` already renders the full landing for both states. Skipping unless you spot regressions.

---

## Files touched

```text
src/routes/plans.$planId.tsx                  (Edit tab routing for phased-complete)
src/routes/plans.$planId.microcycle.tsx       (hide gate when finalized; dirty-only CTA)
src/components/ProgressionExerciseCard.tsx    (sparkline always-visible line + tone; per-row rationale)
src/routes/index.tsx                          (replace session mockup with 2-week microcycle table)
src/i18n/locales/en/plan.json                 (mockups + pricing copy)
src/i18n/locales/pt/plan.json                 (mockups + pricing copy)
```

No DB migrations, no new dependencies, no schema changes.

---

## Out of scope (flagged for later)

- Trial mechanics (1 free month for friends/family, paywall placement after PDF) — needs separate billing/quota plan.
- "Tuneup reason" as a first-class schema field on progression rows — current plan reuses existing `rationale`; promoting it to its own AI-generated field is a Stage 4 prompt change.

Reply **go** to execute.
