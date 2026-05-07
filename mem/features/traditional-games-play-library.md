---
name: Traditional games and playful movement library
description: Future Play / Games umbrella under exercise library — taxonomy, fields, cultural respect rules. Spec only.
type: feature
---

# Play / Games Library

Play brings people back. The future library should preserve and use traditional games and playful movement that develop physical qualities — for group classes, condominiums, outdoor training, youth, older adults, and general population.

## Why it matters

- Adherence (people return for play)
- Develops coordination, agility, balance, reaction, endurance, cooperation
- Preserves cultural movement traditions
- Bridges between training and life

## Categories

`agility · balance · coordination · reaction · throwing_catching · carrying_pulling_pushing · running_chasing · jumping · team_cooperation · rhythm · outdoor_play · low_impact_play · traditional_games`

## Record shape

```
game_id, name_pt, name_en, local_name, country_or_region, cultural_origin_notes,
activity_type, physical_qualities[], group_size, age_range, equipment, space_required,
intensity, duration, rules_summary, setup, progressions, regressions, safety_notes,
coaching_notes, contraindication_flags[], adaptations_for_older_adults,
adaptations_for_children, adaptations_for_low_fitness, competitive_or_cooperative,
fun_factor_notes, measurable_outcomes, video_url, source_notes, review_status
```

## Cultural respect rules

- Record origin (region, language, source) explicitly
- Do not romanticise or appropriate; cite when known
- Use safe adaptations for the population
- **No medical / clinical claims** without evidence
- When origin is unclear, mark `cultural_origin_notes: "unknown — needs research"` instead of guessing

## Seed list to investigate

Jogo da malha · jogo do lenço · corrida de sacos · tração à corda · jogo da macaca · apanhada / tag variations · skipping rope games · medicine ball games · balance challenges · partner reaction games

## Out of scope for R72

No table, no UI, no seeding. This file is the spec only; integration plan lives in [priority audit](mem://audits/exercise-library-priority.md).
