# Protocol — Aesthetic System

The app's working-tool aesthetic, derived from the same philosophical principles as the landing page (balance, proportion, harmony, minimalism, intentionality) but executed for a different cognitive context: a trainer planning sessions, not a reader making a trust decision.

This document is the reference for any aesthetic-related decision in the app. Diverging from these principles requires explicit justification.

## The 7 principles

### 1. Golden-ratio proportion across layout
Apply φ ≈ 1.618 to: card widths, panel ratios (sidebar:main = 1:1.618), section spacing, type scale steps. The whole app breathes on the same mathematical scale as the landing.

### 2. Hierarchical density, not flat density
Working tools have dense data — yes. But the *important* elements get whitespace. If everything is dense, nothing matters. Per surface: 1-2 elements with generous whitespace (primary action, key data); the rest compresses.

### 3. Deliberate typography pairing
Fraunces serif for surface titles (h1, h2, surface-level cards). Inter Tight for everything that's data, label, control. Same golden-ratio type scale as the landing.

### 4. Amber as severe punctuation, not brand color
Amber appears 2-3 times per page maximum, only where action deserves attention. Everything else: warm neutrals + status colors (sage = success, copper = warn, teal = info).

### 5. Asymmetric layout in large panels
Content aligned to one side, whitespace the other. Creates visual rhythm even in dense panels. Apply to Capacity Map, Brief panel, Pipeline. Centered layouts are reserved for hero/empty states.

### 6. Tonal separation over borders
Replace 1px borders + box-shadows with subtle background shifts: `var(--bg)` to `var(--surface)` to `var(--surface-2)`. Cleaner. Less card-soup.

### 7. Editorial microcopy
The app speaks like an instrument manual. Concise, factual, no marketing tone. Numbers and units are precise. Buttons describe action plainly. No exclamation marks. No "let's", "simply", "easily".

## Type pairing usage

| Context | Class | Family | Size |
|---|---|---|---|
| Page title | `t-1` | Fraunces | --text-4xl-v2 |
| Section header | `t-2` | Fraunces | --text-3xl-v2 |
| Card title | `t-3` | Inter Tight | --text-xl-v2 |
| Sub-card title | `t-4` | Inter Tight | --text-lg-v2 |
| Eyebrow | `eyebrow` | Inter Tight (small caps) | --text-2xs-v2 |
| Body data | `body-data` | Inter Tight (tabular nums) | --text-base-v2 |
| Body prose | `body-prose` | Inter Tight | --text-base-v2 |
| Form label | `label-caps` | Inter Tight (small caps) | --text-sm-v2 |

## What stays (no change)

- Three themes: light, medium, dark
- Color palette: warm neutrals + amber accent + sage/copper/teal status
- Token system: `var(--bg)`, `var(--surface)`, `var(--text-*)`, etc.
- Status tone module (`status-tone.ts`)
- Programming tier colors (emerald advanced, amber conservative, blue remedial)

## What Round B will change (in /clients/$id)

- Apply `t-1`, `t-2`, etc. to existing headers
- Reduce amber usage to 2-3 moments per page
- Replace borders with tonal background shifts where appropriate
- Introduce asymmetric layout in 2-3 large panels
- Tighten microcopy in 5-10 highest-traffic strings

## Notes

- Type scale variables are suffixed `-v2` (e.g. `--text-4xl-v2`) to coexist with the legacy `--text-*` tokens already consumed by Tailwind utilities. Round B may consolidate.
- Font family canonical names: `--font-display-v2` (Fraunces) and `--font-body` (Inter Tight). Legacy `--font-display` / `--font-grotesk` aliases remain wired until Round B migration.

## Naming note (Round B fix)

Original Round A used `.h-1`–`.h-4`. These collided with Tailwind's
`h-N` height utilities (e.g. `h-2 = height: 0.5rem`), collapsing real
titles to 8px-tall flex children. Round B renamed them to `.t-1`–`.t-4`
(`t` for "type"). Same scale, same intent, no collision.

— Last updated: 2026-05-09