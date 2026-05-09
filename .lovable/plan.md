## Round X — Visual inputs in assessment

This round is large (7 chip groups, 7 measurement diagrams, status dots, goal selector, i18n × 4 langs). To avoid half-finishing all parts, I'll ship in priority order from the spec and stop before token-budget risk forces a half-edit.

### Stage A — Foundations (always shipped)

1. **`src/components/ui/visual-chip-group.tsx`** — `<VisualChipGroup>` per spec. Uses `currentColor` + design tokens (no hard-coded grid-cols-N to avoid Tailwind purge surprise — use a switch).
2. **`src/components/assessment/svg/`** — new folder for inline SVG icon components. All use `currentColor`, 1.5px body strokes, amber dashed lines (`stroke-dasharray="4 2"`) where applicable. One file per icon, named exports.
3. **`src/components/assessment/MeasureGuide.tsx`** — popover wrapper that takes `field: "waist"|"hip"|...` and renders `<svg/>` + i18n instructions. Reuses existing `HelpPopover` shell.
4. **i18n** — new keys added to `en/assessment.json` + mirrored in `pt/es/hi`. ES/HI fall back to EN for new keys per project convention; I'll write proper PT and EN, and leave ES/HI = EN copies (translation pass deferred).

### Stage B — Chip groups (priority order from spec)

Apply `<VisualChipGroup>` with inline SVG icons to:

1. **Biological sex** (Anthropometry, top of section) — 2-col, head/shoulders silhouettes
2. **Body fat method** (Anthropometry, advanced) — 3-col mobile / 5-col desktop, calipers/BIA/DEXA/BodPod/eye
3. **Training location** (Training setup) — 2-col mobile / 4-col desktop, house/dumbbell/tree/split
4. **Job type** (Lifestyle) — 2-col / 4-col, sitting/standing/lifting/mixed
5. **Smoking status** (Risk) — 3-col, never/former/current cigarette variants

### Stage C — Measure guides

Convert anthropometric `MeasureField` instances to use `<MeasureGuide field="...">`:
- waist, hip, chest, arm, thigh, calf, height — each with body silhouette + amber dashed line at correct anatomical position.

### Stage D — Status dots on auto-calc badges (BMI/WHR/FFMI)

Small colored `<span class="size-1.5 rounded-full">` beside the value:
- sage = ok/normal, copper = elevated, red = high

### Stage E — Goal selector visual chips

Replace primary_goal text/select with 7 visual chips (strength/hypertrophy/health/performance/recomposition/mobility/function), 2-col mobile / 4-col desktop. SVG line icons, not emoji.

### Stage F — Skipped (per spec, "out of scope" or "if quick")

- Body type / somatotype → backlog (`.lovable/backlog.md` entry)
- Movement screen visualizations → separate round
- Public intake `/intake/$token` → follow-up round
- Before/after screenshot capture → I'll skip the file save under `.lovable/design/...` since I can't ergonomically trigger headed screenshots from sandbox at all 3 themes; will instead verify via session replay / preview check.

### Order of execution and stopping rules

A → B (in order 1→5) → C → D → E.

If I'm running low on cycles after Stage B, I'll stop, ship what's done, and report which stages remain so you can dispatch a second round. No half-applied chip groups (each one ships fully wired or not at all).

### Acceptance check at end

- `bun run` (build) clean (ignore pre-existing warnings)
- 375px viewport visual check via preview screenshot
- i18n verifier script if it exists in `scripts/`

### Technical notes (skip if not interested)

- Tailwind grid-cols are JIT — `grid-cols-${n}` template strings get purged. The component will use a `cols → className` map.
- All SVGs use `viewBox="0 0 48 48"` for chip icons, `viewBox="0 0 80 120"` for measure-guide silhouettes.
- Amber dashed lines use `text-amber-500` wrapped via `text-[hsl(var(--warn-fg))]` if that token exists; otherwise inline `stroke="hsl(45 90% 55%)"` matching FORGE PDF amber.
- No DB / data shape changes. All values stored to existing fields.

Confirm and I start at Stage A. If you want me to drop or reorder anything (e.g. skip the goal chips, or do measure guides before chip groups), say so before I begin.
