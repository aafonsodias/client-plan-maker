---
name: demo-year-lineage
description: Demo account ships with 13 chained mesocycle blocks (1 year) — Bloco 13 is AI-generated, Blocos 1–12 are SQL clones of it with mutated accessories and back-dated logbook
type: feature
---
- Onboarding seed pipeline (src/server/demo-oneshot.ts → runInstantPipelineForUser) calls seedDemoYearForPlan AFTER the AI plan finalises (only when no custom archetype, i.e. dashboard auto-seed, NOT founder Demo Lab).
- seedDemoYearForPlan in src/server/demo-year.functions.ts: clones root plan 12× into block_number 1..12 (status=archived, is_demo=true), wires prior_plan_id chain, mutates accessories per block, writes block_transition_summary derived from synthetic adherence/RPE drift.
- seedDemoSessions accepts endsWeeksAgo + loadMultiplier so each block's logbook anchors to the right calendar slot and older blocks look slightly lighter (0.78 → 1.00 ramp).
- Rotate +1 ano button on DemoClientBanner calls rotateDemoYear which fast-forwards every demo session_date by 365d, capped at today. profiles.demo_year_offset stamps that it ran.
- Zero AI cost for blocks 1–12. Quota trigger ignores is_demo=true.
