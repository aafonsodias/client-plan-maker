# Plan: SMART goal templates, training-block injury awareness, safety-gate uses phased flow

Three small, surgical fixes — all in scope, no scope creep.

---

## 1. SMART goal templates (drop-down picker)

**Problem.** The "Objetivo SMART" section is three blank fields and a placeholder. Trainers stare at it. We need a curated picker that fills the SMART fields with one click, then the trainer tweaks numbers.

**Approach.**
- Add a new file `src/lib/smart-goal-templates.ts` exporting ~10 curated templates, each one a small object:
  ```ts
  { id, category, label, specific, measurable_template, default_weeks }
  ```
  Categories: Strength, Hypertrophy, Body composition, Endurance, Mobility, Skill, Health.
  Examples (i18n-keyed, EN + PT):
  - Strength · Squat 1.5×BW for 5 reps · "120 kg @ BW80kg" · 16 wk
  - Hypertrophy · Add 3 cm to arm circumference · "from 36 → 39 cm" · 12 wk
  - Body comp · Drop 5 kg fat mass keeping LBM · "from 22% → 17% BF" · 16 wk
  - Endurance · Run 5 km under 25:00 · "5 km · 24:59" · 10 wk
  - Endurance · Cooper 12 min ≥ 2400 m · "2400 m" · 8 wk
  - Mobility · Touch toes pain-free · "fingertips to floor" · 6 wk
  - Mobility · Full overhead reach (arms vertical against wall) · "wall test pass" · 8 wk
  - Skill · First strict pull-up · "1 × strict" · 12 wk
  - Skill · 60-sec freestanding handstand · "60 s hold" · 16 wk
  - Health · Resting HR < 60 bpm · "current 72 → 58 bpm" · 12 wk
  - Health · Walk 8 000 steps daily · "8 000 / day, 5 days/wk" · 8 wk

- In `src/routes/clients_.$clientId.tsx` goal SectionBlock, add a small `<Select>` above the three Fields: "Choose a template…". On select, fill `smart_specific`, `smart_measurable`, and set `smart_deadline` to today + (weeks × 7). Trainer edits afterwards.
- Show the picker as a subtle `text-xs` chip row "Sugestões: Força · Hipertrofia · …" filterable by category to keep the UI clean. (Use a single Select with grouped options to avoid bloating the layout — we're already on a 672px viewport.)
- i18n keys under `assessment.json → goal_block.templates.{strength_squat_bw, hypertrophy_arms, …}`. EN owns all; PT translated.

**Acceptance.** Open assessment → SMART section shows a "Sugestões" select. Pick "Força · Squat 1.5×PC" → all three SMART fields populate; trainer can override.

---

## 2. Training-block analysis missed "injuries"

**Problem.** Trainer wrote injuries in the Training block; the per-section analysis didn't surface anything because `analyseSection("training", …)` doesn't include `injuries` or `medical_conditions` in the payload sent to the model.

**Approach.**
- `src/server/phased/section-map.ts`, the `case "training":` branch — extend the returned object with `injuries: a.injuries` and `medical_conditions: a.medical_conditions`.
- That alone makes the section analyser see them and call them out in the rolling synthesis, the brief generator, and the safety gate.
- (Sanity-check: `parq` and `risk` already drive their own gates — this only widens what the *training* synthesis sees, which is correct: equipment + injuries + experience belong together.)

**Acceptance.** Edit a client, write "knee pain on squats" in Lesões → save → the training section's analysis chip now references the injury.

---

## 3. Safety-gate falls back to legacy generator (the bug in the screenshot)

**Problem.** When PAR-Q+ is flagged or ACSM risk is High, the generate button becomes "Revisão de segurança". Confirming the dialog calls **`generate()`** — the legacy single-shot generator — bypassing the new 5-stage phased flow (brief → blueprint → microcycle → progressions). The screenshot shows the old "A gerar com Claude Haiku 4.5 (por dia)" progress panel because of this.

The branch is in `src/routes/clients_.$clientId.tsx` around line 1755:
```tsx
onClick={() => { setSafetyDialogOpen(false); void generate(); }}
```

**Approach.**
- Replace that handler so that, when `phasedEnabled` is true (which it is — that's the new path), the safety confirmation triggers the **same** `startPhasedPlanFn` flow used in the unblocked branch (lines 1801–1873). Extract the existing inline `onClick` into a local `runPhasedStart()` function declared once above the JSX, then both the unblocked Button and the safety AlertDialogAction call it.
- When `phasedEnabled` is false (legacy mode only), keep calling `generate()`.
- The phased flow already respects safety internally: PAR-Q flags + ACSM risk feed into the brief synthesis prompt and red-flag accommodations, so the override is honoured without losing the new pipeline.
- No schema or DB changes.

**Acceptance.** Trigger safety gate → confirm override → see the new "Synthesizing brief…" toast → land on the inline brief preview, **not** the old day-by-day progress panel.

---

## Files touched

- `src/lib/smart-goal-templates.ts` (new, ~80 lines)
- `src/routes/clients_.$clientId.tsx` (goal SectionBlock + extract `runPhasedStart` + safety AlertDialogAction)
- `src/server/phased/section-map.ts` (add 2 fields to training case)
- `src/i18n/locales/en/assessment.json` + `src/i18n/locales/pt/assessment.json` (template labels + "Sugestões" UI strings)

No DB migration. No edge-function deploy. Pure client + one server-fn payload widening.

---

## Out of scope (call out so we don't drift)

- Compact plan table (Wave 1), PDF overhaul (Wave 2), beginner volume caps + exercise editing (Wave 4), `Concorrente` split type, daily steps DB column, richer brief summary prompt — all still queued from earlier waves. Pick one next turn.
