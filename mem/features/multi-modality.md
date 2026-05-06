---
name: multi-modality
description: training_modalities is a list on Brief; modality cues feed Stage 3 prompt; VDOT/HR/strength ranges live in src/lib/training-zones.ts
type: feature
---
R72.2 baseline shipped:
- Brief.training_modalities: TrainingModalityEnum[] (gym/running/climbing/calisthenics/mobility/sport_skill), default ["gym"]. Brief.modality_targets optional (running.distance_km/target_time_min, climbing.grade/style, sport_skill.sport).
- Inference: inferTrainingModalities() in src/server/phased/stage1-brief.functions.ts runs after synthesizeBrief; regex on goal section + notes; always keeps "gym" as safety net.
- Stage 3 prompt: modalityBlock surfaces modalities + targets; for now expressed inside cardio[] notes / exercises[] notes (no structured intervals/climb_blocks fields yet — that's R72.2b).
- Training zones: src/lib/training-zones.ts (runZones Karvonen, strengthRanges ACSM 12e Tbl 5.7, vdotPaces from 5K time). Paraphrased only, never verbatim.
- NOT yet done: Stage 3.5 microcycle approval gate UI (server fn approveMicrocycle already exists), Stage 2 modality-aware archetypes, structured intervals[]/climb_blocks[] schema, brief editor UI for modality multi-select. Open as R72.2b.
