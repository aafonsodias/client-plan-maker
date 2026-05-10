# Assessment-organism — the sensory layer

Companion document to `protocol-organism.md`. Where the protocol-organism describes the whole creature (cell → tissue → organism), this document zooms into one system: the **sensory layer** that captures signals from the client and feeds them to every downstream decision.

If `protocol-organism.md` is anatomy, this is neurology.

---

## 1. Metaphor — the assessment as a sensory system

The assessment is not "14 forms to fill". It is the organism's **nervous system**: the only place where the outside world (the client) becomes legible to the inside world (the protocol).

Each section maps to a sensory function:

| Section | Sensory analogue | What it perceives |
|---|---|---|
| §1 PARQ | nocicepção | red flags, contraindications |
| §2 Risk stratification | interocepção | systemic risk |
| §3 Training setup | propriocepção do contexto | what's possible this week |
| §4 Training history | memória | adaptive ceiling |
| §5 SMART goal | intenção | direction of force |
| §6 Medication | farmacologia interna | physiological constraints |
| §7 Anthropometry | propriocepção | body envelope |
| §8 Prochaska | metacognição | readiness for change |
| §9 Lifestyle | ritmo circadiano | recovery substrate |
| §10 Nutrition & hydration | trofismo | fuel and water |
| §11 Mobility | goniómetro interno | range envelope |
| §12 Posture | alinhamento estrutural | static asymmetry |
| §13 Movement screen | sinergia motora | dynamic competence |
| §14 Performance | telemetria cardiorrespiratória | engine state |

The output is **not a filled form**. It is a **vector of clinical signals** that decides programming variables automatically.

The inversion: the client does **not** decide volume, intensity, wave model, deload frequency, exercise blacklists, or split. The signals decide. The client provides **context and personal preferences only**.

---

## 2. Founding principles (10)

1. **Page-per-topic** — one concern per slide. Cognitive load low, completion rate high. A single section may span 5-15 slides.
2. **Clinical decisions auto, personal decisions manual** — Princípio 12 do organism, expandido aqui com mapa explícito (§4).
3. **Implicações per-section, collapsed, alive** — local signal → local analysis → local consequence. Never the giant pre-stage at the end.
4. **Skip-with-warning, never block** — completion is a gradient, not a boolean. PT can fill missing parts in person later.
5. **Educate before asking** — every non-obvious input is preceded by bite-sized education (drawing + 2-3 lines). RHR, BP, hydration, mobility tests.
6. **Drawings > words when possible** — visual instruction wins, especially in mobility, posture, and movement screens. Drawings are theme-adaptive line art.
7. **Submax + regression > 1RM** — never ask the client what the client likely doesn't know. Use Epley/Brzycki to back into 1RM from achievable reps.
8. **Equipment-agnostic naming** — "dinamómetro" not "Jamar"; "bioimpedância" not "Tanita". Brand names only when integrating brand software.
9. **Profile-aware defaults** — every field pre-filled with the best inference available (age + sex + experience + history). Override is allowed and logged.
10. **PDF synthesis as gift** — the assessment ends with a personalized "livro de bons costumes" PDF: hydration target, sleep hygiene, posture awareness, exercise rationale. The client leaves with something tangible even if they never train.

---

## 3. Target architecture (3 layers)

```text
┌─────────────────────────────────────────────┐
│  LAYER 1 — Capture (mobile-first sliders)   │
│  N small pages, swipe-friendly              │
│  Each page: 1 concept + 1 drawing           │
│  Partial save on every blur/change          │
└──────────────────┬──────────────────────────┘
                   │ debounced upsert
┌──────────────────▼──────────────────────────┐
│  LAYER 2 — Per-section analysis             │
│  When section completes: micro pre-stage    │
│  Writes assessment_implications[section]    │
│  Renders collapsed at end of that section   │
└──────────────────┬──────────────────────────┘
                   │ aggregate
┌──────────────────▼──────────────────────────┐
│  LAYER 3 — Synthesis + cockpit              │
│  Client gets: PDF "livro" (educational)     │
│  PT gets:    desktop cockpit + plan v0      │
│  Plan v0 already has technical defaults     │
└─────────────────────────────────────────────┘
```

**Contrast with current architecture**: today the entire pre-stage runs once at the very end. It is slow (the user waits), heavy (one big LLM call), blind to partial input (cannot guide the user mid-flow), and fragile (one failure = whole assessment opaque). The target inverts all four properties.

---

## 4. Signal → Technical decision map

The most valuable artifact of this document. For every captured signal, which programming variable it auto-decides.

| Signal | Origin (section) | Auto-decides |
|---|---|---|
| `years_training` (faixa) + recent pattern | §3, §4 | `experience_level`, `volume_tolerance` |
| `days_per_week` × `session_duration` | §3 | `weekly_volume_budget`, `split_archetype` |
| `injuries[]` + `mobility_limitations[]` | §3, §11 | `exercise_blacklist`, `regression_required` |
| `equipment[]` | §3 | `exercise_pool` (Stage 3 catalog filter) |
| `goal_category` | §5 | `wave_model`, `intensity_volume_tradeoff` (Cockpit preset) |
| `target_window_weeks` | §5 | `mesocycle_count`, `deload_frequency` |
| `red_flags[]` (PARQ + risk + meds) | §1, §2, §6 | `intensity_ceiling`, `medical_clearance_required` |
| `WHR + composition` | §7 | `goal_recomp_priority` |
| `prochaska_stage` | §8 | `coaching_tone`, `adherence_safety_buffer` |
| `sleep_hours` + `stress` | §9 | `autoreg_strictness`, `recovery_buffer` |
| `hydration_target_l` | §10 | educational PDF + reminder cadence |
| `mobility_ratings[]` | §11 | warm-up block selection |
| `posture_findings[]` | §12 | corrective block, single-side bias |
| `movement_screen[]` | §13 | regression/progression per pattern |
| `RHR + VO2max + BP` | §14 | cardio FITT prescription, intensity ceiling |
| `medication_doses[]` | §6 | HR-response adjustment, BP-response flag |

**Personal-manual decisions** (the client owns these):
- Goal name and wording
- Style preferences (circuits, supersets, paired training, time challenges)
- Nicknames, photo, free notes
- Preferred training days/times
- Music/podcast tolerance, gym social preferences

**Everything else = auto, with visible override.** Override writes to `generation_log` so the system learns where its defaults are wrong.

---

## 5. Data model — direction (no migration yet)

Sketch of what the target architecture will need. **Do not create now**; this is design intent for future rounds.

- `assessment_section_state` — `(client_id, section_key, status, last_saved_at, completion_pct)`. Drives per-section completion UI and live Implicações refresh.
- `assessment_implications` — `(client_id, section_key, body jsonb, generated_at)`. Replaces today's monolithic pre-stage output.
- `assessment_signals` — `(client_id, key, value jsonb, confidence)`. The canonical signal vector that feeds Stage 1 Brief. Decoupled from raw form fields so the schema can evolve without breaking the brief.
- `client_belt` — enum `(white, blue, purple, coral, red)`. Derived from `years_training`. **Never reference jiu-jitsu in code, copy, or commits.** UI shows a small color dot on client card and profile, nothing more.
- `client_education_artifacts` — `(client_id, kind, file_url, generated_at)`. Stores the PDF "livro" and any future profile-aware educational outputs.

---

## 6. Roadmap, re-articulated as organism maturation

The walkthrough rounds (D done, E–I pending) re-told with the organism vocabulary. Same scope, clearer narrative.

- **Round D — Reflexes (done).** Skip-button, Rockport wizard, live Implicações stub, partial save. The organism stops choking on its own input.
- **Round E — Nervous coherence.** CC1+CC2+CC9+CC10. Implicações standardized, collapsed, per-section, alive. Aesthetic sweep so every sensory organ looks like it belongs to the same body.
- **Round F — Sensory differentiation.** CC4 page-per-topic restructure. Hydration becomes its own page, then nutrition, mobility limitations, equipment, preferences. Each gets its drawing. Sensory organs separate cleanly.
- **Round G — Auto-decision wiring.** Signal → Decision map (§4) actually wires up. Stage 1 Brief reads from `assessment_signals` instead of raw fields. Smart defaults appear with rationale.
- **Round H — Educational synthesis.** PDF "livro" generation. Profile-aware nutrition/hydration/sleep/posture chapters. The client leaves with a tangible artifact.
- **Round I — Cockpit handoff.** Desktop dashboard for the PT: central plan table, side controls (sets/reps/RPE per micro/session/exercise), paint-bucket setting copy. The handoff from sensory to motor is complete.

Parking lot (P3): reassessment cadence, photo capture for posture, custom exercise library per client, live cockpit logbook view, mobile cockpit.

---

## 7. Anti-patterns (never do)

- **Pre-stage only at the end** → kills responsiveness, blinds the flow, single point of failure.
- **Two names for the same thing** ("Análise" + "Implicações") → choose one. Chosen: **Implicações para a prescrição**.
- **AI selecting goal silently** → breaks trust. AI may suggest with rationale; selection is always explicit.
- **Asking 1RM directly** → noise > signal. Use submax + Epley.
- **Drawings with sex features or childlike art** → off-brand. Line art, neutral silhouettes, `currentColor`.
- **Faixas referencing jiu-jitsu in any string, comment, or commit message** → only the founder knows the inspiration. Strings say "experience belt" / "faixa de experiência".
- **Blocking "Concluir"** → assessment is a gradient. Warn on incomplete; never block.
- **Brand names where generic terms exist** → "Jamar" → "dinamómetro"; "Tanita" → "bioimpedância". Exception: actual brand integration.
- **Pre-stage running on every keystroke** → debounce (per-section) and only on section completion or explicit blur.

---

## 8. Decisions closed in this round (3)

### D1 — AI in goal selector: relax the veto

Round C established "no AI in goal section" because the founder rejected an early attempt that auto-selected goals without rationale. The walkthrough surfaced a different need: many clients (especially leigos) cannot pick a goal at all without guidance.

**Decision**: AI **suggests** with visible rationale and source data. Suggestion is rendered as a card with: suggested goal, why (which assessment signals informed it), confidence, and a clear "Choose another" affordance. AI **never** selects in silence. The user's confirmation is always an explicit click.

Implementation lands in **Round G** (auto-decision wiring), not before. Resolves §5.7.

### D2 — Scope of "clinical decisions auto" (MVP cut)

Principle 12 ("clinical auto, personal manual") in protocol-organism.md is correct in spirit but maximalist in scope. Wiring every clinical signal at once is a multi-round refactor.

**Decision** — MVP auto scope:
- `experience_level`
- `weekly_volume_budget`
- `split_archetype`
- `wave_model` (Cockpit preset)
- `deload_frequency`
- `intensity_ceiling`
- `exercise_blacklist`
- `regression_required` (per movement pattern)

Everything else stays manual with **inline suggestion + rationale**. This lets Round G ship value without rewriting half the codebase. Remaining auto-wirings move to Round G.1, G.2, etc., one signal class at a time.

### D3 — Drawings (CC3, CC6)

The walkthrough demands drawings everywhere. Commissioning a real artist before validating with 10 PTs is premature optimization.

**Decision**:
- Drawings live as **inline SVG** in the repo, in `src/components/assessment/illustrations/`.
- Generated by LLM with **canonical prompts** kept in `.lovable/vision/drawing-prompts.md` (created in Round F, not now).
- Style: line art, single stroke (1.5px), `stroke="currentColor"`, no fill, no primary color, no sex features, no childlike proportions. Theme-adaptive by virtue of `currentColor`.
- One drawing per concept, never decorative duplicates.
- Validation gate before commissioning a real artist: **10 active PT users + ≥30 finished assessments**.

---

## 9. Open questions (for future rounds, not blocking)

- How to compute `weekly_volume_budget` from `days_per_week × session_duration` while respecting `experience_level` cap and `recovery_buffer`? Needs a small model + literature review.
- What confidence score does `assessment_signals` carry? Boolean? 0-1? Tier (low/med/high)? Affects how the brief weighs them.
- Reassessment: which signals expire? Mobility every 4-6 weeks? Anthropometry every 8? PARQ annually?
- The "livro de bons costumes" PDF — share design vocabulary with FORGE PDFs or a new system?
- Mobile vs desktop split for the post-assessment cockpit. Founder's vision is desktop-heavy; mobile experience for PT in-gym needs design.

---

_Last updated: 2026-05-10. Companion to `protocol-organism.md`._