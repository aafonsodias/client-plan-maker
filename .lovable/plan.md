## Goal

Address the four concrete issues from the screenshots and finish the tier-system work that's already wired up but not yet visible to the trainer.

```text
1. Table view  → no W2/W3/W4 progression visible + overflows on tight screens
2. Log view    → cards too long; trainer wants a compact table for logging
3. PDF         → too long, lots of empty space, weak hierarchy
4. Tier system → classifier exists but no UI chip, no override, no validation visibility
```

---

## 1. Mesocycle table — make progressions actually show

**Root cause**: `MesocycleTableView` reads `plan.weeks`. For phased plans, weeks 2-4 only exist after Stage 5 bulkfill runs. When it does run, the rows are near-identical to W1 because the progression deltas (sets/reps/rest) get applied silently — the table currently shows the *resolved* numbers in every column, so the eye sees "3×8-10 · 3×8-10 · 3×8-10" and reads it as no progression.

Fixes:
- **Diff highlighting**: in `MesocycleTableView.tsx`, compare each week's cell to W1. If sets/reps/RPE/rest changed, render the changed token in `text-foreground` + a small ▲/▼ glyph; unchanged tokens stay muted. Makes progression visible at a glance even when the underlying numbers move only slightly.
- **Show RPE explicitly** as its own column slice (`@RPE`) plus a `Δ` chip when intensity climbs week-over-week.
- **Mark Week 4 deload reliably**: tag from `progression_plan.weeks[i].deload === true` (already in schema) instead of "max week number". Falls back to current heuristic if missing.
- **Hide exercise descriptions toggle**: add a "Compact / Detailed" pill above the table. Compact = name only (no cue, no log row). Default = Compact, since the user asked for a sleeker view.
- **Toggle the "log:" write-in row** off when in Compact mode — it's the main contributor to vertical bloat.
- **Overflow fix** (screenshot 2): the sticky exercise column was set to `min-w-[720px]` which pushes off-screen on tight desktops. Switch to `min-w-full` + `table-fixed` with explicit column widths (exercise: 38%, weeks share remainder), and make exercise text `break-words` so multi-line wraps instead of clipping. Add `max-w-[18ch]` truncation on cue text only.
- **Add a "Volume / Intensity" mini header strip** above the table: per-week totals (sets×reps summed, mean RPE), so trainers see W1→W4 trend at a glance.

## 2. Log view — table format

The trainer specifically said: cards in Log are too tall. Add a Log table mode.

- Create `src/components/SessionLogTable.tsx`. One row per exercise of the selected day; columns = Set 1, Set 2, Set 3, Notes. Cells are inline `<input>` elements that update the same workout_session entries that the existing card form writes to.
- Add `Cards | Table` toggle inside Log mode, mirroring the View-mode toggle. Persist preference to `localStorage` per user.
- Show planned target (e.g. `8-10 @ RPE 5`) as muted placeholder text in each input so the trainer knows what to aim for without leaving the row.
- Keep the date picker + history button at the top (reused from current SessionDayView).

## 3. PDF redesign — compact + denser

`src/lib/pdf.ts` currently renders one full page per session with large hero typography and only one table. Switch to a true booklet layout:

- **Letter → A4 landscape** for the main work table; cover stays portrait. Landscape gives room for week columns side by side.
- **Cover (1 page)**: keep KPIs + "Plan at a glance" — already good — but tighten vertical spacing (remove the 50pt KPI height → 36pt; drop top padding by 12pt) so a 4-week / 3-day plan fits cover + 4 session pages instead of 7+.
- **Session pages → mesocycle table pages**: instead of one page per (week,day), output one **landscape page per archetype** (e.g. "Day 1 — Upper") with the full W1-W4 matrix. This collapses 12 pages into 3 for a typical 3-day plan.
- **Remove**: the per-exercise rationale block (saves ~40% vertical space), the second pass of "intent" paragraphs, the empty cooldown spacing on short days.
- **Add**: a footer legend — "▲ = volume up, ◆ = deload, RPE column = intensity target" so the dense table is readable.
- **Print-safe colors**: drop the dark theme branch from PDF (always use light cream); dark PDFs waste ink and read poorly when printed.

## 4. Tier system — make it visible + correctable

Backend logic is wired (`programming-tier.server.ts` is called from Stage 2 + 3). Surface it:

- **Tier chip** on `/plans/$planId/blueprint` and on the plan header in `/plans/$planId`. Use existing `status-tone.ts` palette: Remedial = info/blue, Conservative = warn/amber, Advanced = success/emerald.
- **Tier explainer**: small accordion under the chip — shows the trigger ("3 red flags + sleep < 6h → conservative"), forbidden-exercise list, and target frequency band. Helps the trainer understand *why* the AI capped at 4 days.
- **Override**: button "Force advanced" (or downgrade) that writes `tier_override` into `generation_meta`. Stage 2 + 3 already read `meta.tier`; add a 1-line check that prefers `tier_override` when present. Confirmation dialog warns about recovery capacity.
- **Validation report**: when blueprint validation fails (sessions outside band, forbidden exercise leaked through), surface the error in the existing `ValidationReport` component instead of silently retrying. Trainer sees "AI tried 6×/wk for conservative tier — auto-corrected to 4×/wk".

## 5. Status & i18n cleanup (carry-over)

- Add tier strings to `pt/plan.json` + `en/plan.json` (`tier.remedial/conservative/advanced`, `tier.label`, `tier.override_confirm`, `tier.explainer.*`).
- Microcycle progress strip: localize "A gerar microciclo" / "restantes" via `t()` (currently hard-coded PT — visible in screenshot 1 as PT-only on EN locale).

---

## Files

**Edit**
- `src/components/MesocycleTableView.tsx` — diff highlighting, deload from progression_plan, compact toggle, layout fix, volume/intensity header
- `src/lib/pdf.ts` — landscape mesocycle pages, tighter cover, drop dark theme, remove rationale blocks
- `src/routes/plans.$planId.tsx` — tier chip in header, Cards|Table toggle for Log mode, mount SessionLogTable
- `src/routes/plans.$planId.blueprint.tsx` — tier chip + explainer + override button
- `src/routes/plans.$planId.microcycle.tsx` — i18n the progress strip
- `src/server/phased/stage2-blueprint.functions.ts` — read `tier_override` from generation_meta; surface validation failures in meta
- `src/server/phased/stage3-microcycle.functions.ts` — same override read
- `src/components/ValidationReport.tsx` — render tier-validation entries
- `src/i18n/locales/{en,pt}/plan.json` — tier + progress strings

**Create**
- `src/components/SessionLogTable.tsx` — compact per-day log table
- `src/components/TierChip.tsx` — chip + popover explainer (reused in 2+ routes)

No DB migrations — `tier` and `tier_override` live in `generation_meta` JSONB which already exists.

## Out of scope (call out so we don't drift)

- Dropping concurrency further or moving Stage 3 to a queue — current 5-wide concurrency + per-day progress is enough; revisit if real plans still take > 3 min after this batch.
- Reworking the SMART goals templates — already shipped last turn.
- Cloud / Stripe / auth changes — none.

Reply **approve** to start, or tell me which sections to skip / reorder.
