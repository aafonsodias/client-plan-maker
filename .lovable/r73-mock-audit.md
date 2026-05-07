# R73 — Mock / display rotation audit

Audit only. No code edits this round. Each surface gets one of:
- `OK` — varied enough, honest, no action needed
- `needs-rotation` — locks onto one fictional client/exercise/number
- `needs-realism-pass` — values are plausible-looking but unverified, or section coverage is too narrow

## Landing surfaces

| Surface | Location | Hardcoded items | Flag |
|---|---|---|---|
| `HeroHeadlineRotator` | `src/routes/index.tsx` (inline) | rotates ≥2 PT headlines | OK |
| `HeroPlanMockup` | `src/routes/index.tsx` (inline) | single fictional client name + 1 strength session | needs-rotation, needs-realism-pass |
| `WorkbenchMockup` | `src/components/landing/WorkbenchMockup.tsx` | hardcoded archetype labels + lift names | needs-realism-pass |
| `LogbookInsightsMockup` | `src/components/landing/LogbookInsightsMockup.tsx` | one fixed RPE/weight grid | needs-rotation |
| `landing.hero.bullets` | i18n `plan.json` | static bullets | OK |
| FAQ block | `src/routes/index.tsx` | 5 entries | OK |
| Footer brand | `src/routes/index.tsx` | single BrandMark close-out | OK |

## Section coverage gap (warm-up / cool-down / cardio)

The visible "what a Protocol plan looks like" mocks all open with a barbell main lift and end with accessories. Coverage gap:

| Mock | Warm-up shown? | Activation shown? | Cool-down shown? | Cardio/finisher shown? | Action |
|---|---|---|---|---|---|
| `HeroPlanMockup` | no | no | no | no | needs at least one mobility-led variant |
| `WorkbenchMockup` | no | no | no | no | needs one conditioning-led variant |
| `LogbookInsightsMockup` | n/a (logbook) | n/a | n/a | n/a | OK |
| `public/example-plan.pdf` | unknown — re-render to confirm | — | — | — | check next round |
| Demo seeder output (`src/server/demo-seed.functions.ts`) | partial | partial | partial | rare | needs explicit cool-down/cardio in at least one demo persona |

## Why this matters

Protocol is sold as a *whole-session* coaching tool (warm-up → main → cool-down → conditioning), but the marketing surfaces only show the strength middle. Risk: the prospect perceives Protocol as a "barbell programmer" and discounts the mobility/conditioning value.

## Action for the next round (NOT this round)

- Add a second `HeroPlanMockup` variant that opens with a mobility/activation block and closes with a 6-min Z2 finisher, alternating with the strength variant on a 12s rotator.
- Refresh `LogbookInsightsMockup` to rotate through 3 different exercises so the screenshot doesn't read as "one user, forever".
- Re-render `public/example-plan.pdf` from a demo persona that includes warm-up + cool-down + cardio so the downloadable example reflects the full prescription.

No code, schema, or copy changes ship in R73.