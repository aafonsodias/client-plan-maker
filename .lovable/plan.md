# R73 — Light follow-up pass (no engine, no schema, no library code)

Eight small, isolated touch-ups before Slice 1 (`src/lib/exercise-taxonomy.ts`) is even considered. No DB work, no AI calls, no new routes, no dependencies, no engine/PKL changes.

## 1. Landing duplicate brand block

`src/routes/index.tsx` shows the BrandMark twice in close vertical proximity: once in the sticky nav (lines 63–65, mark + wordmark) and again as the first element of the hero (lines 171–176, large mark + wordmark in 0.3em tracking). On a 1338px viewport both are visible at once → the brand reads twice in 200px.

Fix: drop the hero lockup. Keep nav lockup as the only brand surface above the headline. `HeroHeadlineRotator` becomes the first hero element. Also audit lines 440–460 (footer BrandMark) — keep that one, it closes the page.

## 2. Mock / display rotation audit

Goal: confirm every mock surface (landing `WorkbenchMockup`, `LogbookInsightsMockup`, `HeroPlanMockup`, demo lab previews, PDF examples, `landing.hero.bullets`) doesn't lock onto one fictional client/plan/exercise. Produce `.lovable/r73-mock-audit.md` listing each mock surface, the hardcoded names/numbers, and a flag per surface: `OK / needs-rotation / needs-realism-pass`. No code edits this round — audit only.

## 3. Warm-up / cool-down / cardio mock variants

Today the visible plan mocks (HeroPlanMockup, example PDF, demo seeder output) emphasise the strength block. Audit which mocks render warm-up / activation / cool-down / cardio sections at all, and note in the same `.lovable/r73-mock-audit.md` which need at least one variant that opens with mobility or finishes with conditioning so the product doesn't read as "strength-only". No engine changes — only marking which mock JSON or rotator slide needs new copy in a later round.

## 4. Exercise media production notes

Add `mem/specs/exercise-media-production.md`: a short, practical note on filming (phone height, two angles, 6–12s, neutral background, clothing contrast, no music, slate at start with exercise key + date + version). References `mem://specs/exercise-media-quality.md` for status taxonomy. Pure documentation; no media table, no upload UI.

## 5. Founder demo limitations

Add `mem/features/founder-demo-limitations.md`: explicit list of what the founder Demo Lab + R71 simulator do NOT prove (no real adherence variance, no real RPE drift psychology, no injury events, no schedule conflicts, no payment churn, deterministic adherence ≈85%). Purpose: when judging the product through demo data, remember it's a structural smoke test, not validation of UX-under-stress.

## 6. Traditional games / play source discipline

Update `mem/features/traditional-games-play-library.md` with a "Source discipline" subsection: every play entry must cite a named region/community + at least one verifiable source (book, ethnographic record, named informant). No invented "ancient" provenance. Forbid LLM-generated origin stories. Include rejection criteria.

## 7. Client education PDF note

Add `mem/features/client-education-pdf.md`: short note that the future client-facing PDF should ship a one-page glossary appendix (RPE, tempo notation, %1RM, deload, MEV/MAV/MRV in plain language). Spec only — no `pdf.ts` changes. References `mem://features/client-education-layer.md`.

## 8. Trainer study / evidence source ethics

Add `mem/principles/evidence-source-ethics.md`: rules for citing studies inside the app (StudiesFeed, plan rationale, knowledge route). Required: full citation, year, sample size, effect size if known, conflict-of-interest flag. Forbidden: paraphrased "studies show…" without a real reference, vendor-funded studies cited as independent, n<10 pilot work cited as evidence. References existing `StudiesFeed.tsx` as the surface this binds.

## Deliverables

- 1 code edit: `src/routes/index.tsx` removes the hero brand lockup (item 1)
- 5 new memory/spec files: items 4, 5, 6, 7, 8
- 1 new audit file: `.lovable/r73-mock-audit.md` (items 2 + 3)
- `mem/index.md` updated with the new memory references
- `.lovable/plan.md` appended with R73 entry

## Confirmation

- no schema changes
- no migrations
- no new routes
- no new dependencies
- no AI/model calls
- no real clients touched
- no billing/payment changes
- no engine/generation/PKL changes
- no exercise-library code (Slice 1 deferred)

## Smallest next improvement after this

Slice 1: `src/lib/exercise-taxonomy.ts` — static enums (umbrella, movement_pattern, equipment, level, contraindication_flags, media_quality_status) + alias map reusing `volume-landmarks.ts`. No schema, no UI, no AI prompt changes yet.
