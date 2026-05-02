
# Big fix pass — plan view, PDF, header controls, blueprint quality, bugs

This is a long list, so I've grouped it into 6 waves. Each wave can ship independently and is testable on its own. I'll execute them in order after approval.

---

## Wave 1 — The compact plan table (highest priority)

**Problem.** The "View training plan" page is a long vertical scroll: every exercise repeats its name, sets, reps, RPE, rest, notes per day. There's no big-picture view.

**Fix.** Replace the current "long form" plan view with a **two-tier presentation**:

1. **Compact matrix (default view)** — one horizontal table per week. Rows = exercises (deduplicated by name across the week). Columns = each session in the week. Cells show only the variables that change: `sets×reps @RPE / rest`. If the exercise doesn't appear that day, the cell is blank. Empty rest cell at the right is a logging slot (write-in for paper, will become input field later).
2. **Expand-on-click** — clicking an exercise row reveals the full row of cues, tempo, technique, notes, equipment, primary/secondary muscles. Defaults collapsed. The exercise name appears once.

Toggle at the top: `Compact` / `Detailed` (current full view kept as the secondary mode for users who prefer the "session by session" reading).

**Microcycle session label fix.** `DayCardEditable` line 136 currently renders `Day {idx} · {day.day_label}`, but `day_label` already contains "Day 1 - Lower (Squat Focus)" → produces "Day 1 - Day 1 - Lower". Switch to `Week {weekN} · Day {idx} — {focus}` and stop double-prefixing. Same fix applied in the microcycle route header.

**"Draft" never clearing in studio.** `plans.index.tsx` shows the chip from `derivePlanStatus()` — fix the status derivation so once Stage 5 (`bulkfill`) marks `generation_status = 'complete'`, the chip flips to `Ready`. (User said all plans show as Draft in their studio.) I'll re-check `lib/plan-status.ts` and `stage5-bulkfill.functions.ts` against actual DB rows for the user.

**Files touched.** New `src/components/PlanCompactTable.tsx`. Edit `src/routes/plans.$planId.tsx`, `src/routes/plans.$planId.microcycle.tsx`, `src/components/DayCardEditable.tsx`, `src/lib/plan-status.ts`, `src/routes/plans.index.tsx`.

---

## Wave 2 — PDF: dense, dark/light, mesocycle landscape

**Single-session PDF (portrait):**
- Compact table layout (same model as Wave 1) so a one-week plan fits on **1 cover + 1 page per session**.
- Drop redundant sentence "rationales" — keep one short coaching cue per exercise, max 1 line.
- Tighter margins (M=42pt instead of 54pt) and smaller header band.
- Dedupe exercise names if they recur in the same session (unlikely but possible after warm-ups).

**Theme picker on download.** When user clicks "Download PDF", show a small popover: `Light · Dark · Match logo (auto)`. Currently theme is auto-derived from logo luminance — keep that as default but let the user override.

**New: full-mesocycle landscape PDF.** New action "Download mesocycle (landscape)". One US-Letter landscape page per week:
- Rows = exercises (dedup by name).
- Columns = sessions (Day 1 → Day 6).
- Each cell: `sets×reps @RPE` on top, blank line for write-in load below.
- Right-most column = "Notes / progress".
- Designed to be printed and written on by hand.

**Files touched.** Heavy rewrite of `src/lib/pdf.ts` (extract two builders: `generateSessionPdf` and `generateMesocycleLandscapePdf`). Add a download menu component on `plans.$planId.tsx`.

---

## Wave 3 — Header controls everywhere; one icon family

**Currency switcher missing on landing page.** It's actually rendered on the landing header (line 43 of `index.tsx`), but with `className="hidden sm:inline-flex"` — so it disappears below `sm` breakpoint. At the user's current viewport (672px wide), `sm` (640px) just barely passes, but the layout still feels broken because there's no theme toggle on landing at all.

**Fix.**
- Always show currency symbol button (drop the `hidden sm:inline-flex` gate, just shrink it on mobile).
- Add `<ThemeToggle />` to the landing-page nav next to the currency button (currently only in `AppShell`, not on `/`).
- Replace the language flag icon with the globe icon **everywhere** so it's consistent. The mobile chip in `AppShell` already uses globe; the desktop trigger uses globe; `LanguageSwitcher` (used on landing) currently uses the locale code — change it to a globe with the active locale below as a tiny label, matching the currency button pattern.
- Floating language switcher bug: at the breakpoint where the landing nav collapses but the hamburger hasn't taken over, the language switcher floats centered. Reproducible at 672px. Fix by giving the landing nav a single flex row that wraps to right-aligned at all widths and dropping the `hidden sm:inline-flex` modifiers on the controls.

**Files touched.** `src/components/LanguageSwitcher.tsx`, `src/components/AppShell.tsx`, `src/routes/index.tsx`.

---

## Wave 4 — Blueprint quality: regeneration variation, beginner volume, edit exercises in microcycle

**Problem A — Regeneration repeats the same recipe.** Currently Stage 2 (blueprint) doesn't pass any "vary from previous" hint. When the user clicks Regenerate, the AI sees the same brief and produces the same archetypes.

**Fix.** When `regenerate=true`, pass the previous archetype IDs/foci to the AI as a "previously suggested — produce a meaningfully different valid alternative" instruction. Track regen count and rotate through different valid program shapes (e.g. push/pull/legs ↔ upper/lower ↔ full-body) as variation seeds.

**Problem B — Beginner with 8 exercises Day 1.** Stage 3 (microcycle) doesn't currently scale exercise count by training age. A 1-year trainee getting 8 exercises @ RPE 8 will be wrecked.

**Fix.** Add a hard cap on exercises per session by training age:
- Beginner (<1y): 4–5 exercises, RPE cap 7
- Intermediate (1–3y): 5–7 exercises
- Advanced (3y+): 6–9 exercises

Cap enforced in `programming-defaults.ts` and validated in the Stage 3 schema. If AI returns more, we trim trailing optional/accessory work.

**Problem C — Can't add/remove exercises in microcycle.** `DayCardEditable` only edits sets/reps/etc. for existing exercises.

**Fix.** Add three actions per session:
- `+ Add exercise` (opens search/picker; pulls from a small starter library + free-text name)
- Trash icon per exercise to remove
- Drag handle to reorder

Search input above the exercise list; collapsible to keep screen tight.

**Files touched.** `src/server/phased/stage2-blueprint.functions.ts`, `src/server/phased/programming-defaults.ts`, `src/server/phased/schemas.ts`, `src/components/DayCardEditable.tsx`, new `src/components/ExerciseSearchPicker.tsx` with a small built-in catalog (~100 common movements grouped by pattern).

---

## Wave 5 — Concurrent training, daily steps, brief polish

**Concurrent training as a split.** Add `Concorrente` to the split-type dropdown. The implication for log/microcycle: each week pairs strength sessions with conditioning sessions on separate days (not stacked). Stage 2 will treat `Concorrente` as a directive to interleave at least 1 conditioning session every 2 strength sessions.

**Drop-down readability fix.** The split-type select in the screenshot has unreadable disabled options on dark theme. Fix `<option>` color so non-active items are still legible (currently `text-muted-foreground` on `bg-popover` falls below contrast). Apply the same fix everywhere `<select>` is used (BriefEditor, archetype picker).

**Steps/day recommendation.** Add a new field to the brief: `daily_steps_target` (default derived from goal: fat-loss 10–12k, recomp 8–10k, performance 7–9k, recovery 6–8k). Render in Brief Context Rail, repeat in PDF as part of the "Lifestyle / NEAT" line.

**Brief layout overlap (image 5).** The accommodations section `<select>` overlaps the flag text at narrow widths. The current `flex-col gap-2 sm:flex-row` doesn't actually stack cleanly because `min-w-0 flex-1` on the `<p>` fights with `shrink-0 sm:w-44` on the select. Fix: use `grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3 items-start` so columns are predictable and never overlap.

**Brief summary too thin / wrong.** "15 anos experiência treino. Competência técnica excelente" is wrong — the prompt currently flattens self-rated movement competency into "excelente". Adjust the brief generator prompt to:
- Quote training age numerically.
- Describe movement competency from the assessment (per-pattern: squat/hinge/push/pull/lunge/carry), not a single global rating.
- Surface red flags inline.
- Mention goal + constraints + frequency.
Target 3–5 sentences, not 1.

**Phased deltas readability.** The current "phased deltas" panel reads as a dense paragraph. Fix:
- Group by stage with a 2-line max summary per stage.
- Use icon + colored chip per delta type (added/changed/removed).
- Empty stages are intentional (they didn't change) — show a muted "Sem alterações nesta fase" instead of leaving blank.

**Files touched.** `src/components/BriefEditor.tsx`, `src/components/BriefContextRail.tsx`, `src/server/phased/stage1-brief.functions.ts`, `src/server/phased/programming-defaults.ts`, `src/i18n/locales/{en,pt}/{common,plan}.json`. DB migration to add `daily_steps_target` to the briefs/plans table (1 column, INTEGER nullable).

---

## Wave 6 — Landing logbook section: stop repeating the same mocks

The "After the PDF" section currently uses `<SetLogMockup />` and `<ProgressionMockup />` — the **same components** also used right above in the "Logging" section. That's why it looks duplicated.

**Fix.** Replace with two new dedicated mocks:
- `<LogbookHistoryMockup />` — a multi-week history table (week 1–6 of Back Squat top sets), showing weight progression with checkmarks on hit reps.
- `<TrendChartMockup />` — a clean SVG line chart of e1RM trend, with the existing `Soon` chip kept on the AI advice card below.

Same dark theme, same amber accents, but visually distinct from the upper "Logging" section.

**Files touched.** Add 2 components in `src/routes/index.tsx` (or extract to `src/components/landing/`), update i18n captions.

---

## Progression-model drawings — your question

Quick answer: the SVGs in `ProgressionModelPicker` are **directionally right but oversimplified**:
- **Linear** is shown as a gentle steady upward line — correct.
- **Undulating** is shown as a low-amplitude zigzag — should have larger weekly swings (heavy / moderate / light / heavy) to actually look "undulating" rather than noisy.
- **Block** is shown as a single bump — should be a stepped pattern: accumulation rising → intensification rising higher → realization peak → deload drop.

I'll redraw all three with cleaner amber polylines that match the description text. Folded into Wave 4.

---

## Out-of-scope for this round (logged for later)

- Uploading hand-written PDF logs back into the app via OCR.
- Trends, AI prompt-driven adjustments, coach AI advice (already on the "Soon" roadmap on the landing page).
- Full exercise library (Wave 4 ships a starter catalog of ~100; a curated full library is a later effort).

---

## Order of execution

1. Wave 1 — compact plan table + microcycle label fix + draft chip fix (biggest user-visible win)
2. Wave 3 — header controls (small, unblocks all viewports)
3. Wave 5 — brief overlaps, summary, deltas, steps target, concurrent split (medium)
4. Wave 4 — blueprint variation, beginner volume cap, exercise add/remove, progression SVGs (medium-large)
5. Wave 2 — PDF rewrite + landscape mesocycle + theme picker (largest)
6. Wave 6 — landing logbook mocks (small polish)

Reply **approve** to start, or pick specific waves to skip / reorder.
