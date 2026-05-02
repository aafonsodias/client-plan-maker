# Plan — Forge: progression fix, UX polish, PDF rewrite, PT toolkit scoping

You raised ~12 distinct issues. Some are 5-minute polish, some are multi-day feature builds. I'm grouping them into 4 phases so you get fast wins on the broken stuff first, and we don't blow the next turn on half-finished features.

---

## Phase 1 — Critical fixes (ship this turn)

These are bugs or one-line UX wins. No new surface area.

### 1.1 RPE / sets / reps don't progress W1→W4 (the real bug)

This is the headline issue. Stage 4 (`proposeProgressions`) asks for deltas and Stage 5 (`stage5-bulkfill`) applies them — but the table still looks identical across weeks. Two confirmed root causes after re-reading the code:

- The Stage 4 prompt tells the model "Skip exercises that are already at target intensity" and "Most exercises only need 1 row." On a conservative/remedial plan the model takes that as licence to return mostly empty deltas — so weeks 2-4 inherit week 1 verbatim.
- Even when deltas exist, the table only shows `sets/reps/rpe/rest`. Load deltas (`+2.5kg`) live in `notes` and were invisible until the load-chip work last turn — but the prompt rarely emits reps/sets/rpe deltas at all.

Fix:

- Rewrite the Stage 4 system prompt to **require** at least one delta per exercise across W2-W4, and to bias toward reps and RPE for machine/remedial work (where load is auto-regulated) and toward load for free-weight compounds. Cap RPE at the tier ceiling (Remedial 7, Conservative 7.5, Advanced 8.5).
- Add a **post-validation pass**: after Stage 4 returns, count exercises with zero non-empty deltas across W2-W4. If ≥30% are empty, retry once with a stricter user message ("Your previous output left X exercises flat. Add a reps or RPE delta for each."). If still empty after retry, surface the warning banner the table already supports.
- Backfill helper: a "Re-run progressions" button on the table banner already links to `/progressions` — verify it triggers a regeneration, not just a re-fetch.

### 1.2 Mesocycle table — RPE column always visible, even when blank

Already partially landed last turn. Audit `MesocycleTableView` to confirm RPE renders as `@—` (dim) when missing instead of disappearing, and that the load chip from `notes` shows up in every week's cell, not just W2+.

### 1.3 Button stacking on `/plans/$planId`

"Approve microcycle" and "← Phased plan" overlap on narrow viewports. Switch the header to `flex-wrap gap-2` and let the back link drop to its own row under 720px.

### 1.4 Brief auto-collapse after Approve

Right now the brief stays expanded after approval. After `approveBrief` succeeds, set the brief card to the highlighted "Stage 1 — Brief approved" collapsed state (the chevron-right pill in your screenshot) and scroll to Stage 2. Pure client-side state change.

### 1.5 Mixed PT/EN strings

"Pedir à IA" / "Regenerate" / "Approve" / "Approve → Day 1" sit side by side. Move all of these to `i18n/locales/{en,pt}/plan.json` under a single `plan.actions.*` namespace and replace the hard-coded strings. Includes the microcycle progress strip strings still hard-coded in PT.

---

## Phase 2 — PDF rewrite (next turn after Phase 1)

The PDF is the single biggest quality complaint. 17 pages for a 4×2 plan is indefensible. Current `src/lib/pdf.ts` is 931 lines of portrait-A4 jsPDF with one-day-per-page padding. Strategy:

### 2.1 Layout

- **Switch to A4 landscape** for the body; keep portrait only for the cover.
- **One page per archetype**, not per day. Each page = a matrix: rows are exercises, columns are W1/W2/W3/W4 with sets×reps @RPE +load delta. This mirrors the `MesocycleTableView` we already ship in-app.
- **Cover page**: logo (fix aspect ratio — currently stretched vertically; use `getImageProperties` and scale width to fit a max-height box preserving ratio), client name + plan title with **proper spacing** (the "Training program" label glued to the name today is just a missing margin), one-paragraph summary, optional client profile photo as a small circular crop top-right.
- **At a Glance** becomes a real one-page summary table: archetype × week with set count, total reps, mean RPE, deload flag. Replaces the current broken list that prints "Day 1 - Week 1" four times.
- **Warmup / activation / cooldown**: collapse to a single shaded strip per archetype page ("Warmup 8 min: …; Activation 4 min: …; Cooldown 5 min: …"). No more dedicated sub-pages.
- **Supersets**: render as a bracket on the left margin spanning the grouped rows, instead of trying to draw a full-width separator that gets clipped.

### 2.2 Typography

- Tighten letter-spacing and reduce font size for body rows from current ~10pt to 9pt.
- Cap row height; truncate technique cues to ~80 chars with ellipsis (full cue stays in-app).
- Target: ≤ 6 pages for a 4-week / 2-archetype plan (cover + at-a-glance + 2 archetype matrices + warmup/cooldown reference + notes). Down from 17.

### 2.3 Branding fixes

- Logo aspect-ratio preservation (the streched-up logo is a `doc.addImage(w, h)` bug — we pass fixed h without checking source ratio).
- Add optional client profile photo from `clients.profile_photo_url` (new column — see Phase 3) with a remove toggle in the export dialog.

---

## Phase 3 — PT toolkit feature scoping (needs your go-ahead per item)

These are **net-new feature areas**. I'm not building any of these blind — each is a 1-3 day chunk. Tell me which to greenlight and in what order. I'll write a focused plan per item.

### 3.1 Tanita / InBody report upload

A file-upload zone on the assessment screen that accepts PDF/JPG of bioimpedance receipts. Two storage paths:

- **Cheap path**: store as a file attachment on the assessment, render thumbnail + download. No parsing.
- **Smart path**: OCR + LLM extraction into structured fields (body fat %, segmental lean mass, visceral fat, water %). Auto-populates `body_fat_pct` and `body_fat_method` and stores the raw extraction in `assessments.extended.bia`.

I recommend cheap path first, smart path as a follow-up.

### 3.2 Postural assessment photos (front/side/back)

Upload + side-by-side viewer + an optional "AI critique" pass that flags obvious deviations (forward head, anterior pelvic tilt, etc.) into `assessments.standing_posture_notes`. Same cheap-then-smart split.

### 3.3 Senior fitness testing module (≥60 yo)

When `client.date_of_birth` puts age ≥ 60, a new collapsible appears in the assessment with:

- Senior Fitness Test battery: chair stand, arm curl, 2-min step, chair sit-and-reach, back scratch, 8-foot up-and-go, 6-min walk.
- Norm tables (Rikli & Jones) by age band and sex.
- Each input gets a percentile + a one-line interpretation that feeds Stage 1 brief context.

This is the highest-effort item and the most impactful for differentiation.

### 3.4 Nutrition mini-booklets

A short Q&A flow ("primary nutrition goal: tone / lose / gain / maintain", "main barrier", "meals per day", "cooks at home?") that picks one of ~6 pre-authored PDF booklets (plate model, fat-loss starter, lean-gain starter, habits, hydration, eating out). Templates live in `/public/nutrition/` and are stamped with the trainer's branding at export time.

### 3.5 Adaptive assessment ("AI asks the next question")

Big one. The idea: instead of one giant form, the AI drives the questionnaire — when a beginner picks "lose weight" we skip 1RM / max-lift questions; when they tick "previous shoulder surgery" we expand the upper-body screening. Implementation sketch:

- Keep the current form as the storage layer (no schema break).
- Add a "Guided" toggle that hands the form to a controller component which calls a new server fn `assessment.nextQuestion({ assessmentId, answeredKeys })` returning `{ nextField, why, optional }`.
- The controller hides un-asked fields and shows them in order. "Show all fields" button always available so you keep manual control.
- Risk: this can feel slow if every field triggers a round-trip. Mitigate by batching — the AI returns the next 3-5 questions at a time, not 1.

This one I'd want to prototype on a single section (medical history) before rolling out plan-wide.

### 3.6 Progression deltas — fast-edit controls

Today you click each row. Add at the top of the progressions screen:

- Tier-bias preset buttons: "Conservative bump (+1 rep W2-3, deload W4)", "Linear load (+2.5kg /week)", "Hypertrophy block (+1 set W3, deload W4)" — one click rewrites all empty deltas of that pattern.
- Bulk "apply this row's delta to all exercises in pattern X" inline action.

Keeps individual editing intact.

### 3.7 Client profile photo + opt-in PDF inclusion

New column `clients.profile_photo_url`, upload control on the client page, checkbox in PDF export dialog. Trivial — bundle with Phase 2.

---

## Phase 4 — Landing page rewrite

You're right that "90 seconds" is wrong if a real plan takes 10-20 minutes of trainer time. Reframe the value prop:

- **Headline shift** from "fast" to "thorough but guided". Something like "The deeper you go, the better the plan — Forge guides you stage by stage so nothing important is skipped."
- Replace the 90-second number with a stage-time breakdown: "Brief 2 min · Blueprint 3 min · Microcycle 5 min · Progressions 2 min — review and ship in under 15." This sets honest expectations and *promotes* the depth.
- Add a "what good data buys you" section: each input you give → what the AI can do with it. (Drives users to fill out assessment fully.)
- Keep the 5-stage journey graphic — it already maps to the app. Add an honest "and here's what we don't do yet" footer with the Soon chips.

Copy work + a single hero swap. No new components.

---

## What I want you to decide before I start coding

Reply with any subset:

1. **Phase 1 — ship now?** (yes/no — default yes)
2. **Phase 2 PDF rewrite — same turn or next?** (I recommend next turn so Phase 1 lands cleanly first)
3. **Phase 3 — pick 1-3 items to greenlight first.** My recommended order: 3.7 (profile photo, trivial) → 3.6 (delta presets) → 3.1 cheap path (Tanita upload) → 3.3 (senior testing) → 3.4 (nutrition booklets) → 3.2 (posture photos) → 3.5 (adaptive assessment, last because it's the biggest).
4. **Phase 4 — rewrite landing copy now or after the toolkit ships?** (I'd hold until after 3.1 + 3.3 land so the new copy can advertise them.)

If you just say "approve" I'll do **Phase 1 only** and come back with Phase 2 as a second plan.

---

## Technical surface (for the record)

Phase 1 touches:
- `src/server/phased/stage4-progressions.functions.ts` — prompt rewrite, post-validation retry.
- `src/components/MesocycleTableView.tsx` — RPE always-visible audit, load chip in W1.
- `src/routes/plans.$planId.tsx` — header `flex-wrap`.
- `src/routes/plans.$planId.brief.tsx` — collapse-on-approve state + scroll.
- `src/i18n/locales/{en,pt}/plan.json` — `plan.actions.*` namespace.

Phase 2 rewrites `src/lib/pdf.ts` end-to-end (landscape + matrix). High blast radius — keeping it isolated to one turn.

Phases 3 and 4 each get their own plan when greenlit.
