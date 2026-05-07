---
name: Founder demo limitations
description: What the Demo Lab + R71 simulator do NOT prove. Read before using demo data to judge the product.
type: constraint
---

# Founder demo — what it does NOT prove

The founder Demo Lab and the R71 mesocycle simulator (`src/server/demo-sessions.functions.ts`) generate deterministic structural data so the app can be judged with a populated history. They are a **smoke test**, not a UX-under-stress validation.

## What demo data does NOT include

- **Real adherence variance.** Simulator targets ~85% completion with hardcoded "hard / skip / deload" weeks. Real clients miss for life reasons (illness, work, kids, weather, motivation collapse). None of that is modelled.
- **Real RPE drift psychology.** Simulated RPE drift is a deterministic curve. Real clients under-report when proud and over-report when tired; that bias is not modelled.
- **Injury events.** No simulated tweaks, flares, or pain-driven substitutions. The product's response to mid-block injury is untested by demo data.
- **Schedule conflicts.** No simulated rescheduling, no "client double-booked", no late cancellations.
- **Payment / churn.** No subscription expiry, dunning, refund, or downgrade events fire from the simulator.
- **Inter-personal friction.** No messaging volume spikes, no client ghosting, no trainer-client disagreement on programming.
- **Multi-trainer effects.** Simulator runs against one trainer/client pair. Studio-mode contention (60 active clients, 4 trainers) is not exercised.
- **Onboarding friction.** Demo client is created with intake already filled. The intake-to-first-plan funnel is not stressed.

## What demo data DOES prove

- The data model can hold N weeks of bookings + sessions + measurements.
- Volume math, capacity-gain, rotation audit, and PDF rendering survive a populated history.
- Multi-block lineage (`prior_plan_id`, `block_number`) renders correctly when there is something to render.
- Pack accounting (`bump_pack_sessions_used`) stays consistent under bulk inserts.

## Rule

Before claiming "the product handles X" based on demo data, ask: **does X depend on any of the listed unmodelled behaviours?** If yes, it needs a real (consenting) trainer or a stress-test script before it counts as validated.