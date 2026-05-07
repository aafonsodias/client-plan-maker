---
name: Exercise library taxonomy
description: Umbrella sections, movement-pattern subcategories, filters, search tokens, and exercise detail page sections. Spec only.
type: feature
---

# Exercise Library Taxonomy

## Umbrella sections (top-level)

1. **Strength** — load-bearing resistance work
2. **Mobility** — joint range, controlled articular movement
3. **Cardio / Conditioning** — sustained aerobic + anaerobic work
4. **Balance / Coordination** — postural control, proprioception
5. **Power / Speed** — rate of force development
6. **Skill / Motor Control** — learning-dominant drills
7. **Recovery / Preparation** — warm-up, breathing, soft tissue, cooldown
8. **Play / Games** — traditional + playful movement (see [play library](mem://features/traditional-games-play-library.md))

## Subcategories (movement pattern)

`squat · hinge · lunge_split · push_horizontal · push_vertical · pull_horizontal · pull_vertical · carry · core_anti_extension · core_anti_rotation · core_lateral_stability · hip_extension · hip_abduction · knee_flexion · calf_ankle · thoracic_mobility · hip_mobility · shoulder_scap_control`

## Filters

- equipment (multi)
- level (`beginner | intermediate | advanced`)
- body region
- movement pattern
- primary muscle (canonical from `volume-landmarks.ts`)
- secondary muscle
- goal (hypertrophy / strength / endurance / power / mobility / rehab / general)
- modality (strength / cardio / mobility / play / skill)
- contraindication flag (low_back / knee / shoulder / pregnancy / hypertension / etc.)
- environment (home / gym / condo / outdoor / pool)
- low_impact (bool)
- beginner_friendly (bool)
- measurable (bool — has a testable metric)
- video_available (bool)
- source (`protocol_default | trainer_custom`)

## Search bar tokens

Free-text search ranks across, in order:
1. canonical name (PT or EN, current locale first)
2. aliases (PT + EN)
3. equipment
4. primary muscle
5. movement pattern
6. cue keyword (matches `key_cues`)

## Exercise detail page sections

- Header: name (locale), aliases, pattern chip, level chip, source badge (Protocol / your override)
- Hero media slot (frontal + lateral video, or fallback thumbnail with quality status)
- Quick facts: primary muscles · secondary muscles · equipment · level · contraindications
- Setup / Execution / Breathing / Tempo / ROM notes
- Key cues (bulleted)
- Common mistakes
- Regressions ladder
- Progressions ladder
- Substitutions (same pattern / different equipment / lower contraindication load)
- Volume counting notes
- Measurable metric (if any)
- Provenance: source · evidence · review_status · version · last updated
- Actions: "Fork to my version" · "Suggest improvement" · "Use in current plan"
