---
name: regional-names
description: Region-weighted mixture-model name generator used by landing mocks and demo seed
type: feature
---
Module: `src/lib/names/regional-names.ts`. Pure, deterministic (FNV-1a → mulberry32). Exports `generateName`, `generateRoster`, `detectRegionFromLocale`, `initialsFor`.

Each `Region` is a probability distribution over sub-pools (e.g. brazil = 55% luso_brazilian + 20% afro_brazilian + 15% italian_german_diaspora + 10% global_anglo). Surnames are paired within the SAME sub-pool so we never produce implausible mixes ("Wei Schmidt"). Pools are common, recognizable names — never stereotypes/slurs/jokes.

Used by:
- `src/routes/index.tsx` `CoachWorkbenchMockup` — roster derived from `i18n.language` (seeded so it stays stable per language).
- `src/server/demo-client.functions.ts` `createDemoClient` — accepts `locale` arg; PT trainers keep the original PT `name_pool` (non-breaking), everyone else gets a region-aware name. Locale flows: `DemoRunsContext.startRun` → `startDemoClientFull` → `runInstantPipelineForUser` → `createDemoClient`.

Rules: always pass `sex` (avatar pool needs it). Never hardcode display names on the landing or in demo seeds — always go through this module.