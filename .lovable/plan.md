# Phase 2 — PDF rewrite + Log table

Two self-contained changes that hit the loudest current pain points: 17-page PDFs and the long card-based session log. No DB migrations, no schema changes, no new server functions.

---

## 1. Plan PDF — landscape A4 "training booklet"

**File:** `src/lib/pdf.ts` (rewrite `generatePlanPdf`; keep types and `renderAssessmentPdf` untouched)

### Page model

Switch from `letter` portrait (612×792 pt) to `a4` landscape (842×595 pt). Landscape gives ~70% more horizontal room, which is what the dense exercise table needs and is why current rows clip.

Target page budget for a 4-week × 2-day plan: **≤6 pages** (cover + 1 page per session + optional 1 cycle-overview page). Hard ceiling: 1 session = 1 page. If a session does not fit, drop the rationale lines and the second cue line before spilling.

### Cover page (1 page, was ~1.5)

- Header band 70 pt tall (was 110). Logo 40×40 (was 50×50). Brand + client on the same row.
- Title 22pt (was 28). Single-line summary, italic, capped at 2 lines via `splitTextToSize` then `slice(0, 2)`.
- KPI strip: 4 tiles, height 38 pt (was 50).
- "Plan at a glance" becomes a true table: columns = Day | Focus | #Ex | Volume estimate. One row per session across all weeks. This replaces the per-week sub-headers and saves vertical space.

### Session page (1 page each, was bleeding to 2)

Session header line (single row, 18 pt total height):
```
W2 · DAY 1            UPPER PUSH                                    8 ex · ~24 sets
```

Below that, 4 horizontal "rails" of content, each in its own band:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PREP   • Cat-cow 1×10 · • Band pull-apart 2×15 · • Scap push-up 2×8         │  <- warmup+activation+dyn merged into ONE shaded inline strip
├──────────────────────────────────────────────────────────────────────────────┤
│ #  EXERCISE                CUE                          SETS  REPS  REST RPE TEMPO  W2Δ  W3Δ  W4Δ │
│ 01 DB Bench Press          Drive feet, ribs down       4     8     90s  7   3-1-1   +reps +load -1set │
│ ┐  Incline DB Press        Pause 1s at chest           3     10    60s  7   2-0-1   +reps +load -1set │  <- superset bracket
│ ┘  Cable Fly               Squeeze, no shrug           3     12    60s  7   2-0-1   +1rep +1rep deload │
│ 02 Tricep Pushdown         Elbows pinned               3     12    60s  8   —       +reps +reps deload │
├──────────────────────────────────────────────────────────────────────────────┤
│ COOL  • Pec doorway stretch 30s × 2 · • Lat hang 30s                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

Concrete rules to enforce density:

- **Merge prep sections.** Render `warmup + activation + dynamic_stretches` as one shaded strip ("PREP"), comma-separated inline bullets (`• name dur · • name dur`), wrapped to 2 lines max. Same for `cooldown + finisher` ("COOL"). This removes 3 section headers per page.
- **Add 3 progression delta columns** (W2Δ, W3Δ, W4Δ). Read from `progression_plan.rows` (which `MesocycleTableView` already consumes). Falls back to `—` when no row exists. This is the primary value-add: trainers can hand a single page to the client showing all 4 weeks.
- **Fix superset clipping.** Today the `SUPERSET A` label is drawn at `y + 2` while the previous row's bottom hairline is at the same y, which is what cuts the top off. New approach: no banner row. Instead, draw a 2 pt amber bracket connecting the left edges of all rows in the superset (top-cap, vertical rule, bottom-cap, drawn AFTER the rows). Optionally prefix the row number with `┐ / │ / ┘`.
- **Row geometry.** Single-line rows by default (12 pt). Cue is rendered in the dedicated CUE column (truncated with ellipsis), NOT below the name. That alone removes ~10 pt per exercise × 8 exercises = 80 pt = a quarter of a page.
- **Tighten typography.** Body 9pt (was 10). Headers 6.5pt unchanged. `setLineHeightFactor(1.15)` on the table (was implicit 1.5).
- **Remove decoration.** Drop the per-row bottom hairline (use alternating `bgSubtle` zebra fill at 30% opacity instead — reads as a row separator without spending a pixel of height).
- **No empty sections.** Already done; verify the prep-merge respects this.
- **No standalone overview-per-week pages.** The cover's at-a-glance table covers it.

### Logo aspect ratio

Current code calls `doc.addImage(logoData, "PNG", M, 30, 50, 50)` — forces square. Decode width/height from the data URL via the `Image` we already create in `computeLogoLuminance`, cache the dims, then fit into a 40×40 box preserving aspect ratio (`min(40/w, 40/h)`).

### Filename

Keep current naming, no change.

### QA loop

After implementing, regenerate a known plan, render to JPEG with `pdftoppm -jpeg -r 150`, view every page. Hunt for: superset clipping (the original bug), overflowing exercise names, RPE column rendering "—" everywhere (means delta lookup failed), missing PREP strip on day-1, KPI tiles overlapping at long client names. Fix and re-render until clean.

### Acceptance

- 4-week × 2-day plan renders in ≤6 pages (was 17).
- Zero superset rows clipped on the top edge.
- Every session page shows W2/W3/W4 deltas next to the W1 prescription.
- Logo respects aspect ratio (no squishing for wide logos).

---

## 2. Client log view — table replaces cards

**File:** `src/routes/log.$token.tsx`

Currently the log renders one `<Card>` per exercise with stacked planned/actual fields. For a 10-exercise day this is ~3 screens of scroll. User explicitly asked for a table.

New layout (mobile: same cards because table doesn't fit < 640px; desktop: table):

```
EXERCISE                    PLANNED                    ACTUAL
                            sets reps rest             sets reps weight  notes
DB Bench Press              4    8    90s              [4]  [8]  [22.5]  [easier than W1]
Incline DB Press            3    10   60s              [_]  [_]  [_____] [_______________]
```

Implementation:

- Extract a new `<SessionLogTable>` component co-located in the route (no need for `src/components/` since it's only used here).
- Use `<table>` with `tabular-nums` on the inputs so numbers align.
- Keep the existing `entries`/`updateActual` state shape — the table is purely a presentation swap.
- `hidden md:table` for the table, `md:hidden` for the existing cards (kept as the mobile fallback).
- Inputs become `<input>` (not `<Input>` from shadcn) sized `w-12` for sets/reps, `w-16` for weight, `w-full` for notes. Use the same border/focus tokens as `<Input>` so theming holds.

### Acceptance

- A 10-exercise session fits in roughly one viewport on desktop (~700 px tall).
- Mobile experience unchanged (cards still render).
- All actuals still save through `saveClientSession`.

---

## What I'm explicitly NOT doing this turn

- Phase 3 PT Toolkit (Tanita upload, posture photos, senior testing). Next turn — they each need a storage bucket + UI + likely a migration.
- Inline PDF editing or "copy to clipboard" of the PDF table (the on-screen `MesocycleTableView` already has TSV/Markdown copy from last turn).
- Landing page rewrite. Should follow toolkit features so the new copy can name them.

Reply "approve" and I'll ship both. Reply with edits to the scope if you want to drop or add anything (e.g. "skip the log table, just do the PDF" is a valid trim).
