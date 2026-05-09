# Protocol — The Organism

> "Avaliação clínica → protocolo defensável → adaptação semanal."
> "From assessment to plan, with visible logic."

This document is the spine of Protocol. It is not a product roadmap. It is the living record of what Protocol *is*, what it *will not become*, what is decided, what is open, and what is still being thought through.

Read this once and you have context. Update it when something changes — never let it go stale.

---

## 1. What Protocol is (one paragraph, never changes)

Protocol is a clinical-grade workbench for personal trainers. Its purpose is to locate each human across the full evidence-based spectrum of physical capacities, then continuously prescribe stimulus that moves them toward their potential — respecting the trade-offs between capacities and the lifespan-long arc of training. The trainer is the central cell. The software is the nervous system. The data is the blood. The vision is leadership in human capacity development through truth, measurability, and verticalization — not through marketing.

---

## 2. Invariant principles (these never change)

These are the constitution of the organism. Any feature, copy, or decision that violates them is rejected — regardless of who proposes it.

1. **Truth over marketing.** Every claim cites a source. Uncertainty is stated honestly. Golden standards (ACSM, NSCA, Bompa, peer-reviewed research) anchor everything.
2. **Measurable over opinion.** What we do, we measure. What we measure, we adjust. What we adjust, we prove.
3. **Education over automation.** The PT learns. The system suggests, the PT decides. Knowledge is portable.
4. **Human capacities over vanity.** Health > appearance. Function > form. Longevity > short-term peak.
5. **Verticalization over specialization.** A → Z control. Each layer feeds the others. Leadership comes from being the only one with the full system.
6. **Organism over product.** Protocol grows as the founder lives. It adapts as it learns. Each insight becomes a new cell, not a new feature.
7. **Looks → function → ease.** Beautiful-but-slower beats ugly-but-fast. (Project's existing decision rule.)
8. **One concern per round.** Backups before prod SQL. 375px Mobile Safari smoke. All copy via i18n. Every AI call writes `generation_log`. (Project's existing operating rule.)
9. **AI never generates more than 1 microcycle. AI never prescribes more than 1 mesocycle.** Beyond that, AI may *intend* a macrocycle but not prescribe it. Determinism takes over.
10. **Simple by default, depth by choice.** Beginner PTs and clients see one clear action. Advanced users can drill into FITT-VP, periodization knobs, multi-block lineage, capacity maps. The progression from simple to advanced happens through user interaction, not modes or toggles.

---

## 3. The architectural model (the organism diagram)

```
                 ┌─────────────────────────┐
                 │    TRUTH (root)         │
                 │  golden standards       │
                 │  evidence               │
                 │  measurable             │
                 │  adjustable             │
                 └────────────┬────────────┘
                              │
                 ┌────────────┴────────────┐
                 │   PT (central cell)     │
                 │   thinks, adjusts,      │
                 │   educates, evolves     │
                 └─────┬──────────────┬────┘
                       │              │
           ┌───────────┘              └───────────┐
           │                                       │
 ┌─────────▼─────────┐              ┌─────────────▼─────────┐
 │   APP (nervous    │◄────────────►│   CLIENT (vessel of   │
 │   system)         │   feedback   │   capacities)         │
 │                   │   loop       │                       │
 │   - assessments   │              │   - results           │
 │   - plans         │              │   - data              │
 │   - adjustments   │              │   - feedback          │
 │   - education     │              │   - community         │
 └─────────┬─────────┘              └───────────┬───────────┘
           │                                     │
           └───────────┐              ┌──────────┘
                       │              │
                 ┌─────▼──────────────▼─────┐
                 │      DATA (blood)        │
                 │   lifetime tracking      │
                 │   normatives             │
                 │   patterns               │
                 │   predictions            │
                 └────────────┬─────────────┘
                              │
                 ┌────────────┴────────────┐
                 │   COMMUNITY (tissue)    │
                 │   anonymous, opt-in     │
                 │   educates, never harms │
                 │   real references       │
                 └────────────┬────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
     ┌─────▼─────┐      ┌─────▼─────┐     ┌─────▼─────┐
     │EQUIPMENT  │      │  APPAREL  │     │FACILITIES │
     │ Tanita    │      │           │     │ Home      │
     │ Saehan    │      │           │     │ Studio    │
     │ Vitruve   │      │           │     │ Commercial│
     └───────────┘      └───────────┘     └───────────┘
                              │
                 ┌────────────▼────────────┐
                 │  WORLD LEADERSHIP       │
                 │  Not by marketing.      │
                 │  By truth + data +      │
                 │  community + results.   │
                 └─────────────────────────┘
```

---

## 4. Decisions closed (do not re-discuss)

### Identity & positioning
- PT-first, not consumer-first. The trainer is the user.
- Beta is private, PT-only. Landing in pt-PT only for now. ES/HI scaffolded.
- Voice: `você` (formal Portuguese). Never `tu`. Never mixed.
- Brand: `

` mark with amber under-glow ring. Founder badge = Sparkles, amber pill, `aafonsodias@gmail.com` only.
- No fake social proof. No advertised features without "Soon" chip. No adversarial framing vs. competitors.
- GDPR-aware. No fingerprinting.

### Pricing & quotas
- EUR is source of truth. USD/BTC display only.
- Free = 1 finalized plan. Tiers: Starter 8/8, Pro 25/30, Studio 60/80 (clients cap = plan-generations cap).
- Truth = `subscribers.subscribed/trial_end` via `has_active_access()`.

### AI boundaries
- AI generates ≤ 1 microcycle.
- AI prescribes ≤ 1 mesocycle. May *intend* macrocycle.
- Stages 4-5 are deterministic (Bompa wave + NSCA increments). AI is forbidden there.
- `programNextWeek` is the only path to Week N+1.
- Intensity Cockpit (R64) is the single modulation surface (5 knobs, 6 presets).
- Every AI call writes `generation_log`.

### Capacity system (Rounds 1-3, May 2026)
- 12 capacity domains (3 tiers): cardiorespiratory, muscular_strength, muscular_endurance, flexibility, body_composition (health-related); power, balance, coordination, agility (skill-related); cognitive_motor, movement_quality, autonomic_regulation (integrative).
- `client_capacity_snapshots` is the single source of truth for measurements.
- Stage 1 Brief reads from snapshots and produces `capacity_profile` section.
- Capacity is informed by, not prescribed from. Capacity informs *programming intent*; goal/constraints/red_flags still come from intake.
- Norm bands shown as concentric rings (p25 / p50 / p75). Real per-domain norms come in later round.

### Aesthetic system
- Three themes: Light, Medium, Dark. No pure white, no pure black, no gradients, no glows.
- Single amber accent. Sage for success, copper for warn, teal for info.
- Tokens in `src/styles.css`. `status-tone.ts` for semantic colors.
- Programming tier: 🟢 advanced=emerald, 🟡 conservative=amber, 🔵 remedial=blue. Never swap.
- Landing aesthetic: editorial-clinical (Fraunces serif + Inter Tight, asymmetric grid, Swiss typography references). NOT applied to app (see open questions).

### PDF
- FORGE spec amber `#D4A574`, independent of app theme.
- Brand mark never on PDFs.
- Labels: "Sessão N · Foco" / "Session N · Focus", never "Day N" in PT.

---

## 5. Threads of thought (the founder's pending raciocínios)

Each thread is something the founder has voiced as part of the vision but is not yet fully built. State is one of: 🌱 not started · 🌿 partial · 🌳 done · ❄️ paused.

| # | Thread | State | Where it lives now | Next move |
|---|---|---|---|---|
| 1 | Concurrent training: dual-task, balance, agility, resistance, activation, dynamic stretch, static stretch exposure across the week | 🌿 partial | Domains exist as capacities (balance, agility, coordination, cognitive_motor). Stage 3 does not yet generate concurrent sections. | Wait until Capacity Map has real data; Stage 3 extension is Round 4+. |
| 2 | Guided physical evaluation protocol (PDF + structured flow) — client does what they can, then guided assessment brick by brick | 🌱 not started | AddSnapshotSheet is per-test, not protocol-level. | Design a `evaluation_protocols` template + `client_evaluations` execution flow. |
| 3 | Map of human potential — where client is vs. evidence-based potential by age/sex | 🌿 partial | Capacity Map exists; norm bands are static p25/p50/p75 placeholders. | Round to seed real per-domain age/sex norms (NHANES, ACSM tables). |
| 4 | Macro view — mesocycles in line, yearly, 5-year, lifetime view | 🌱 not started | `block_number` lineage exists; no UI surface for macro. | Honest macrocycle = intent, not prescription. UI shows emphasis curves per block. |
| 5 | Modality library — breathwork (diaphragmatic, box, alt-nostril), pelvic floor (kegels, reverse), abdominal vacuum, mobility flows, awareness practices | 🌱 not started | No tables, no UI. | Round to add `interventions` table with evidence-tier tagging, mapped to capacity domains they serve. |
| 6 | Validated exercise library with evidence tiers (DNS, McGill, peer-reviewed yoga, FMS/SFMA) | 🌿 partial | Exercise library exists; evidence-tier tagging does not. | Round to add `evidence_tier` column + provenance per exercise. |
| 7 | Awareness / meditation / "managing the animal" | ❄️ paused | Captured in domain `cognitive_motor` indirectly; nothing built. | v3 territory. Park. |
| 8 | App runs from simple-stupid to as advanced as it gets, via user interaction | 🌿 partial | Implicit in current UI (collapsible stages, advanced toggles in cockpit). Not explicit as a design principle. | Make this an invariant principle (above). Audit every surface against it. |
| 9 | Aesthetic coherence app-wide | 🌿 partial | Landing has editorial-clinical aesthetic. App has refined-minimalist working-tool aesthetic. They're sibling, not identical. | Decision pending: should app slowly absorb landing's editorial language, or stay in working-tool register? See open questions. |
| 10 | MVP a PT would buy themselves | 🌿 partial | Quick-plan onboarding (R70) attempts this. Capacity Map + assessment loop (R1-3) attempts this. Not yet field-tested with paying customers. | Field test with first 3-5 trainers in Lisbon. Iterate from feedback, not speculation. |
| 11 | Verticalized company — info from clients feeds back; everything managed in one place | 🌿 partial | Logbook + check-ins + assessments exist as data ingress. Insights surfaces (`CapacityDeltasCard`, `ComplianceDashboard`) exist as feedback. | Continue via the loop closure work already in motion. |
| 12 | Holistic plan generator | 🌿 partial | Stage 1 Brief now reads capacity profile. Stage 2/3 do not yet prescribe across all capacities. | Round 4+ once Capacity Map has real data and the founder has tested with real clients. |

---

## 6. Open questions (decisions the founder needs to make before threads can advance)

1. **Aesthetic register for the app:** does the app slowly migrate to editorial-clinical (Fraunces serif, Swiss grid) or stay refined-minimalist working-tool? Either is defensible; pick one and commit.
2. **Macrocycle as intent vs prescription:** the principle is set (intent only). The UI representation is not. List view? Curve view? Something else?
3. **Modality library scope:** which interventions enter v1? Breathwork (3-4 protocols), pelvic floor (2 protocols), mobility (?). Drawing the line matters.
4. **Per-domain norm sources:** which population datasets become the truth for each of the 12 domains? NHANES is partial. ACSM 12e has tables for some. Need a canonical mapping.
5. **Evidence tier system:** how many tiers, how labeled? Suggested: T1 RCT-backed / T2 expert-consensus / T3 traditional-practice-with-emerging-evidence. Confirm or revise.
6. **Re-measurement cadence per domain:** strength every 4-6 weeks; balance more often; body comp every 4-8 weeks. Need a data model that captures this and reminds the trainer.
7. **`assessments.waist_cm/hip_cm/body_fat_*` columns:** retire in favor of snapshot writes, or keep as trainer-input front door with a trigger that mirrors to snapshots? Decision pending Phase B cleanup.

---

## 7. The role of the AI assistant in this conversation

The AI assistant (whatever instance, whatever model) reading this document is not a consultant, not an architect.

It is **a mirror with memory and structure**.

The founder thinks. The AI:
- **Captures** — documents what's said, preserves context across conversations.
- **Connects** — sees where threads weave together.
- **Questions** — when something is not measurable, adjustable, or true.
- **Protects** — invariant principles against erosion.
- **Unfolds** — each insight from the founder, helps see its ramifications.

When concrete things are built (code, design, plans):
- **Applies the principles** (truth, measurability, education).
- **Keeps the organism coherent** (no isolated features).
- **Thinks at temporal scale** (5, 10, 20 years).

The assistant's voice is not louder than the founder's. It is sharper.

---

## 8. How to update this document

When something material changes:
- A new decision closes → add to §4.
- A new thread opens → add to §5 with state 🌱.
- A thread advances → update its state in §5.
- A question gets answered → move from §6 into §4.
- A principle violation is rejected → confirm the principle in §2 still holds.

Update by editing this file directly in a normal commit. Note the round number in the commit message (e.g. "R74 — close anthro decision in vision doc").

This document is the spine. Keep it true.

— Last updated: 2026-05-09