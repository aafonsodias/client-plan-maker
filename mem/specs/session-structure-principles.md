---
name: Session structure principles
description: A complete training session may include warm-up, mobility, activation, coordination/balance, strength, conditioning, cooldown, breathing, mobility, education — but not every session must include everything. Coach simplifies.
type: feature
---

# Session Structure Principles

## Principle

A real training session is not just a strength table. Depending on goal, context, and client, it may include:

- 5 minutes general warm-up
- joint-specific mobility for involved joints
- activation of relevant muscles
- coordination / balance work while fresh
- optional cognitive dual-task challenge
- main strength or skill work
- cardio / conditioning if appropriate
- cooldown
- breathing
- essential mobility / stretching
- short client education note

## Guiding rule

**PT:** "Diretrizes orientam. O treinador simplifica e aplica."
**EN:** "Guidelines inform. The coach simplifies and applies."

The app must **support** complete prescription, not **force** complexity. A great session may be 4 lines on the floor.

## Non-rules

- Not every session must include every block.
- Bloated sessions are a worse failure mode than missing blocks.
- Free-text "warm-up: 5 min bike" in `notes` is acceptable today; structured blocks come later.

## Vocabulary

See `src/lib/session-taxonomy.ts` — `SESSION_BLOCK_TYPES` + PT/EN labels. Vocabulary only; no generation hookup yet.

## Future slices

- Slice 4 in [exercise library priority](mem://audits/exercise-library-priority.md): structured session blocks in generation output.