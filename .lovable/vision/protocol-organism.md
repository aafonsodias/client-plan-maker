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
11. **Assessment before prescription, no shortcuts.** Every plan flows from completed assessment. Speed comes from clarity at each stage, not from skipping stages. (See §4 — No quick-plans.)
12. **Clinical decisions auto, personal decisions manual.** Where evidence dictates a default (training frequency, intensity preset, programming tier), the system pre-selects with visible override. Where personal circumstance dictates (time available, environment), the user inputs without prefill.

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

### Assessment-organism (zoom-in)

The sensory layer of this organism — the only place where the outside world (the client) becomes legible to the inside world (the protocol) — has its own dedicated document: [`assessment-organism.md`](./assessment-organism.md). It defines the page-per-topic architecture, the Signal → Decision map, and the 3 decisions closed in May 2026 (D1: AI in goal selector, D2: MVP auto-decision scope, D3: drawings strategy).

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
- AI in goal selector = suggestion with visible rationale, never silent selection (D1, see `assessment-organism.md`).

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

### Modality library v1 (Round 74, May 2026)

The Modality Library is the set of structured interventions Protocol can prescribe alongside resistance training to develop capacities that pure resistance work doesn't reach (autonomic regulation, mobility through full ROM, awareness, cold/heat tolerance).

**v1 scope: 5 categories, ~15 protocols.**

| Category | v1 protocols | Capacity domains served |
|---|---|---|
| Breathwork | Diaphragmatic, Box (4-4-4-4), Slow (5.5 breaths/min), Alternate-nostril, Wim Hof tummo | autonomic_regulation, cardiorespiratory, cognitive_motor |
| Cold/heat exposure | Cold shower (30s-3min), Cold immersion (above 5°C), Sauna 80°C+ | autonomic_regulation, cardiorespiratory |
| Pelvic floor | Kegels, Reverse kegels | movement_quality, body_composition (intra-abdominal pressure management) |
| Mobility flows | CARs (controlled articular rotations), Cossack flow, McGill big-3 | flexibility, movement_quality |
| Awareness micro-practices | Body scan, Breath counting, Single-task focus drill | cognitive_motor |

**Inclusion criteria for v1:**
- Has ≥1 RCT or systematic review published
- Executable without special equipment OR with equipment the client already owns (bathtub, shower, yoga mat)
- Maps clearly to ≥1 of the 12 capacity domains
- Safe for most healthy adults without supervision

**Excluded from v1 (deferred to v2+):**
- Abdominal vacuum — weak evidence as isolated intervention
- Plant medicine, ayahuasca-style practices — outside clinical scope
- Advanced pranayama (sustained kapalabhati, bhastrika) — hyperventilation risk without instructor
- Cold immersion below 5°C — cardiovascular risk without prior assessment
- Prolonged breath holds without supervision

**Data model (specification, not yet built):**

```
interventions table:
  id, slug, category, name_key (i18n)
  evidence_tier: T1 (RCT-backed) / T2 (expert-consensus) / T3 (traditional-with-emerging)
  capacity_domains_served: text[] (refs capacity_domains.slug)
  prerequisites: text
  contraindications: text[]
  default_dose: jsonb (e.g. {duration_min: 5, frequency_per_week: 3})
  source_citation: text
  description_key, instructions_key (i18n)
```

Implementation pending. This decision locks the scope, not the timeline.

### No quick-plans (Round 74, May 2026)

The `/plans/quick` route (5-input fast lane) was deleted. It violated the foundational principle: "assessment before prescription." Protocol exists to give people without resources access to golden-standard assessment + defensible mesocycle prescription + iterative macrocycle building. A 5-input shortcut produces something Protocol's own founder would not buy as a PT.

This decision is enforced in code (route deleted, server functions removed, i18n keys cleaned) and documented at `mem://principles/no-quick-plans.md`.

Implication: the only path to a plan is through the assessment → brief → blueprint → microcycle → progressions pipeline. Onboarding speed comes from making each stage faster and clearer, not from skipping stages.

### Client cockpit consolidation (May 2026 sub-rounds)

The trainer's view of a single client moved to a denser, navigation-driven model:

- AI-generated client avatars when `photo_url` is null (`ClientAvatar` component, gender-based fallback)
- NextAction embedded in `ClientPlayerCard` as amber pill on hover (review / complete / generate / birthday); standalone `NextActionCard` removed; intake-link copy button removed (duplicate path)
- `ProtocolRail` densified: Stage 1 chip shows inline `11/14 · 79%`
- Stage 1 of cockpit slim: in-progress shows only CTA; complete shows active mesocycle + discrete "Reavaliar" link
- Clicking protocol stages navigates to `/clients/$clientId`; inline `stagePanel` accordion deleted

Reflects principle §2.10 ("simple by default, depth by choice"): cockpit shows one priority action; depth lives in destination routes.

### Re-measurement cadence (May 2026)

Each capacity has a default re-measurement interval based on evidence (signal vs. noise):

| Capacity domain | Default cadence | Rationale |
|---|---|---|
| cardiorespiratory | 4 weeks | Submax tests show meaningful change at 3-4 weeks of consistent training |
| muscular_strength | 4 weeks | 1RM/5RM signal exceeds noise at ~4 weeks; testing more often = neural fatigue confound |
| muscular_endurance | 3 weeks | Faster adaptation than strength, less neural cost |
| flexibility | 2 weeks | ROM responds quickly to consistent intervention |
| body_composition | 4 weeks | Below this, water/glycogen noise dominates lean/fat signal |
| power | 4 weeks | Same neural-fatigue logic as strength |
| balance | 2 weeks | Especially relevant for older adults; faster adaptation, lower fatigue cost |
| coordination | 3 weeks | Skill acquisition timeline |
| agility | 3 weeks | Combined cognitive-motor; tracks with coordination |
| cognitive_motor | 3 weeks | Dual-task adaptation timeline |
| movement_quality | 4 weeks | Pattern integrity changes slowly with consistent practice |
| autonomic_regulation | 2 weeks | RHR/HRV/BP respond quickly to training and recovery state |

PT can override per mesocycle (global) or per capacity per client (granular). Reminder appears in cockpit when interval has elapsed since latest snapshot for that capacity.

Implementation: stored in `client_measurement_cadence` per (client_id, domain_slug). Reads default from `capacity_domains.default_cadence_days` if no override exists.

### Walkthrough triage (10 May 2026)

After end-to-end assessment usage, founder + AI triaged ~50 surfaced items into 5 mini-rounds + parking lot. Captured in `.lovable/feedback/assessment-walkthrough-may-2026.md`. Four foundational decisions made:

**AI in goal selector:** AI may *filter and order* existing curated templates based on assessment data, but never generates new content. Existing templates remain canonical truth; AI adds intelligence without hallucination risk.

**Auto-decide technical choices (selective scope):** Following pattern "clinical basis → auto with visible override; personal circumstance → manual":

- **Auto with override:** training days/week, plan duration, intensity preset, programming tier (beginner/intermediate/advanced inferred from years_training + recent pattern + metrics)

- **Manual:** session duration (depends on personal time availability, no clinical formula)

**Round F splittable:** Page-per-topic restructure breaks into 3 sub-rounds (1 area per round) instead of single 30-50c round. Reduces risk of half-built state.

**SVG drawings hybrid:** Lovable inline SVG for MVP. Commissioned external art deferred until product-market validation. Acceptable visible quality compromise during pre-revenue phase.

---

## 5. Threads of thought (the founder's pending raciocínios)

Each thread is something the founder has voiced as part of the vision but is not yet fully built. State is one of: 🌱 not started · 🌿 partial · 🌳 done · ❄️ paused.

| # | Thread | State | Where it lives now | Next move |
|---|---|---|---|---|
| 1 | Concurrent training: dual-task, balance, agility, resistance, activation, dynamic stretch, static stretch exposure across the week | 🌿 partial | Domains exist as capacities (balance, agility, coordination, cognitive_motor). Stage 3 does not yet generate concurrent sections. | Wait until Capacity Map has real data; Stage 3 extension is Round 4+. |
| 2 | Guided physical evaluation protocol (PDF + structured flow) — client does what they can, then guided assessment brick by brick | 🌱 not started | AddSnapshotSheet is per-test, not protocol-level. | Design a `evaluation_protocols` template + `client_evaluations` execution flow. |
| 3 | Map of human potential — where client is vs. evidence-based potential by age/sex | 🌿 partial | Capacity Map exists; norm bands are static p25/p50/p75 placeholders. | Round to seed real per-domain age/sex norms (NHANES, ACSM tables). |
| 4 | Macro view — mesocycles in line, yearly, 5-year, lifetime view | 🌱 not started | `block_number` lineage exists; no UI surface for macro. | Honest macrocycle = intent, not prescription. UI shows emphasis curves per block. |
| 5 | Modality library — breathwork, cold/heat, pelvic floor, mobility flows, awareness practices | 🌿 partial (scope locked) | Scope decided in §4 (Modality library v1). No tables, no UI yet. | Round to add `interventions` table per spec. Wait until first 3-5 trainers field-test the existing capacity loop before building. |
| 6 | Validated exercise library with evidence tiers (DNS, McGill, peer-reviewed yoga, FMS/SFMA) | 🌿 partial | Exercise library exists; evidence-tier tagging does not. | Round to add `evidence_tier` column + provenance per exercise. |
| 7 | Awareness / meditation / "managing the animal" | ❄️ paused | Captured in domain `cognitive_motor` indirectly; nothing built. | v3 territory. Park. |
| 8 | App runs from simple-stupid to as advanced as it gets, via user interaction | 🌿 partial | Implicit in current UI (collapsible stages, advanced toggles in cockpit). Not explicit as a design principle. | Make this an invariant principle (above). Audit every surface against it. |
| 9 | Aesthetic coherence app-wide | 🌿 advancing | Round A foundations landed (May 9). Round B applied to top regions of /clients/$id (May 9). R101/R102 applied 7 principles to /dashboard + CoachCockpit (golden-ratio grid, tonal separation, amber reduced to 3 moments, font-display in headers). Round B.2 pending to complete /clients/$id. | After B.2 lands, Round C replicates to /me, /intake, /log, /plans/$id. |
| 10 | MVP a PT would buy themselves | 🌿 partial | Capacity Map + assessment loop (R1-3) and aesthetic-coherent dashboard (R101-102) approach this. Quick-plan rejected (R74) as inconsistent with the principle. Not yet field-tested with paying customers. | Field test with first 3-5 trainers in Lisbon. Iterate from feedback, not speculation. |
| 11 | Verticalized company | 🌿 advancing | Cockpit consolidated (May 2026). Logbook + check-ins + assessments as ingress. CapacityDeltasCard + ComplianceDashboard as feedback. | Continue loop closure. Re-measurement cadence decision: see §4. |
| 12 | Holistic plan generator | 🌿 partial | Stage 1 Brief now reads capacity profile. Stage 2/3 do not yet prescribe across all capacities. | Round 4+ once Capacity Map has real data and the founder has tested with real clients. |

---

## 6. Open questions (decisions the founder needs to make before threads can advance)

1. **Aesthetic register for the app:** does the app slowly migrate to editorial-clinical (Fraunces serif, Swiss grid) or stay refined-minimalist working-tool? Either is defensible; pick one and commit.
2. **Macrocycle as intent vs prescription:** the principle is set (intent only). The UI representation is not. List view? Curve view? Something else?
3. **Per-domain norm sources:** which population datasets become the truth for each of the 12 domains? NHANES is partial. ACSM 12e has tables for some. Need a canonical mapping.
4. **Evidence tier system:** how many tiers, how labeled? Suggested: T1 RCT-backed / T2 expert-consensus / T3 traditional-practice-with-emerging-evidence. Confirm or revise.
5. **`assessments.waist_cm/hip_cm/body_fat_*` columns:** retire in favor of snapshot writes, or keep as trainer-input front door with a trigger that mirrors to snapshots? Decision pending Phase B cleanup.

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

## 8. Working agreement between founder and AI

The founder is the maximum responsible. He works at his own pace, on his own threads, sometimes ahead of plans the AI proposed. This is correct and expected.

The AI's job is not to gate the founder's progress. The AI's job is:

- **Receive updates after the fact** when the founder iterated solo, integrate them into this document, and adjust upcoming plans accordingly.

- **Surface inconsistencies** when solo work conflicts with invariant principles (§2) or closed decisions (§4) — not to block, but to make the conflict visible.

- **Prepare prompts when asked**, tight enough that Lovable executes in one shot.

- **Conserve credits** by writing prompts that don't waste, and pushing back on dopamine-driven scope creep.

When the founder reports solo work:

- Capture what was done in §4 if it closed a decision, in §5 if it advanced a thread, in §6 if it answered an open question.

- Never relitigate work already shipped unless it broke an invariant.

This document is the spine. The founder writes muscle. The AI maintains skeleton.

### Checkpoint discipline

If a Lovable round lands with problems: try ONE corrective prompt. If the issue persists after that prompt and ~5 credits, restore the Lovable checkpoint and re-approach with a fresh prompt informed by what failed. Don't keep patching.

### Diagnose with Chat mode before Agent prompts

When app behavior is unexpected or ambiguous: open Lovable's Chat mode (read-only, credit-light), ask it to diagnose by reading files/inspecting DB. Then write a tight Agent prompt based on the diagnosis. Don't jump into Agent mode with "fix this thing" — that burns credits guessing.

---

## 9. How to update this document

When something material changes:
- A new decision closes → add to §4.
- A new thread opens → add to §5 with state 🌱.
- A thread advances → update its state in §5.
- A question gets answered → move from §6 into §4.
- A principle violation is rejected → confirm the principle in §2 still holds.

Update by editing this file directly in a normal commit. Note the round number in the commit message (e.g. "R74 — close anthro decision in vision doc").

This document is the spine. Keep it true.

— Last updated: 2026-05-10