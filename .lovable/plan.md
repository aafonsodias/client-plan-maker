## Round 15 — i18n EN sweep: YearView + ExerciseTrendChart

Closes backlog #26. Both surfaces still have hardcoded PT strings (chart titles, axis names, legends, table headers, empty states, "PR Bloco N", tonelagem labels, etc.). Sweep them through `useTranslation`.

### Locale keys to add (`src/i18n/locales/{pt,en}/common.json`)

- `year.title`, `year.subtitle` (uses `{{blocks}}`, `{{weeks}}`, `{{sessions}}`)
- `year.overall_adherence`
- `year.loading`, `year.empty`
- `year.blocks.heading`, `year.blocks.subtitle`
- `year.blocks.no_data`, `year.blocks.initial_block`, `year.blocks.delta_capacity` (`{{pct}}`)
- `year.blocks.adherence_short`, `year.blocks.rpe_short`, `year.blocks.sessions_short`
- `year.adherence.title`, `year.adherence.subtitle`, `year.adherence.bar`, `year.adherence.line_rpe`
- `year.tonnage.title`, `year.tonnage.subtitle`, `year.tonnage.bar`
- `year.strength.title`, `year.strength.subtitle`, `year.strength.empty`
- `year.map.title`, `year.map.subtitle`, plus column keys: `block`, `weeks`, `sessions`, `adherence`, `avg_rpe`, `tonnage`, `adaptation`
- `trend.empty_html` (with `<bold>` placeholder for the import button name) + `trend.import_button`
- `trend.delta_one`, `trend.delta_other` (`{{delta}}`, `{{count}}`), `trend.weeks_one`, `trend.weeks_other`
- `trend.pr_block` (`{{n}}`)
- `trend.legend.kg`, `trend.legend.rpe`
- `trend.week_short` (for `S{week}`; EN `W{{week}}`)

### Component edits

- **`src/components/YearView.tsx`**:
  - `useTranslation('common')`.
  - Replace every hardcoded string above. Header subtitle uses interpolation; `BlocksStrip` chip uses `t('year.blocks.delta_capacity', { pct })` with sign prefix preserved.
  - Stat cards (`Adesão global`, `Adesão`, `RPE`, `Sess.`) localized.
  - Table headers + `kg` suffix kept (kg is universal).
- **`src/components/ExerciseTrendChart.tsx`**:
  - `useTranslation('common')`.
  - Empty state via `<Trans i18nKey="trend.empty_html" components={{ bold: <b className="text-foreground" /> }} />`.
  - Subtitle uses `t('trend.delta_one'|'trend.delta_other', { count, delta })` and `t('trend.weeks_*', { count })`.
  - PR badge: `t('trend.pr_block', { n: blockNumber })`.
  - X axis tickFormatter uses `t('trend.week_short', { week: v })`.
  - Legend names via `name={t('trend.legend.kg')}` / `t('trend.legend.rpe')`.

## Round 16 — Hardcoded-PT audit on shipped surfaces

Quick smoke pass to catch any remaining literal Portuguese in core routes after Rounds 13–15. Read-only scan first (`rg "[À-ÿ]" src/routes src/components | rg -v 'i18n|locales|\\.json'`), then localize the leftovers found in:

- `src/routes/plans.$planId.tsx` (any non-i18n labels still in PT)
- `src/components/NextBlockCard.tsx` edge strings
- `src/components/CapacityGainCard.tsx` tooltip copy
- `src/components/volume/VolumeSection.tsx` headers if missed

Cap at ~6 leftover strings; if more surface, log as backlog #27 instead of expanding the round.

## Deploy

After Rounds 15–16 land, publish the frontend so the EN audience gets the sweep live. Mention to the user that backend (edge fns/migrations) auto-deploys but the frontend update needs the Publish dialog click.

## Backlog updates (`.lovable/backlog.md`)

- Mark #26 ✅ Round 15.
- Add #27 (P2, i18n) only if Round 16 audit overflows.
- Bump "Atualizado" header to Round 16.

### Files touched

- `src/i18n/locales/pt/common.json`
- `src/i18n/locales/en/common.json`
- `src/components/YearView.tsx`
- `src/components/ExerciseTrendChart.tsx`
- (Round 16) any leftover route/component files surfaced by the rg pass
- `.lovable/backlog.md`

Avanço?
