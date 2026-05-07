---
name: Exercise media implementation plan
description: Phased plan for shipping exercise media. Default Now = docs only; Next = identity wiring; media schema/provider/player are Later.
type: feature
---

# Exercise Media — Implementation Plan

Ranking criteria: value · cost · risk · dependency · timing.

## Phase 0 — Manual archive discipline · **Now**
- **Value:** unblocks every later phase; founder starts producing real assets.
- **Cost:** zero code.
- **Risk:** zero.
- **Dependency:** none.
- **Action:** founder names files per [file organisation spec](mem://specs/exercise-media-file-organisation.md), follows [production workflow](mem://specs/exercise-media-production-workflow.md), keeps notes in `metadata_notes/`.

## Phase 1 — Static media metadata spec · **Now (this round)**
- **Value:** locks vocabulary; prevents architectural drift.
- **Cost:** docs only.
- **Risk:** zero.
- **Dependency:** R74 taxonomy (done).
- **Action:** specs in this round.

## Phase 2 — Manual media references · **Later**
- **Value:** lets the app surface a small number of known clips.
- **Cost:** small static map; no schema.
- **Risk:** low if scope kept ≤ 30 entries.
- **Dependency:** Phase 0 produces real masters; provider chosen for at least the demo set.
- **Action:** static `Record<ExerciseKey, MediaRef>` consumed by exercise card placeholder. NOT this round.

## Phase 3 — Schema-backed `exercise_media` · **Later**
- **Value:** real library; handles versioning + reviews.
- **Cost:** migration, RLS, admin UI scaffolding.
- **Risk:** medium — re-keying on `exercise_key` requires Slice 2 wiring landed first.
- **Dependency:** Slice 2 identity wiring (`longitudinal.ts`, logbook continuity); chosen provider; ≥ 30 verified masters.
- **Action:** ship table per [data model spec](mem://specs/exercise-media-data-model.md).

## Phase 4 — App exercise card player · **Later**
- **Value:** clients/trainers actually see videos.
- **Cost:** player component + thumbnail UX.
- **Risk:** medium — player must abstract provider cleanly.
- **Dependency:** Phase 3.

## Phase 5 — Upload / admin media manager · **Later**
- **Value:** removes manual provider-console step.
- **Cost:** signed-upload endpoint, admin UI.
- **Risk:** medium.
- **Dependency:** Phase 4 + media volume justifies it.

## Phase 6 — Verified media review workflow · **Later**
- **Value:** moves from "founder dump" to "Protocol-verified library".
- **Cost:** review queue UI + status transitions.
- **Risk:** low once Phases 3–5 exist.
- **Dependency:** Phase 5.

## Phase 7 — Overlay / stickfigure / avatar · **Parked**
- **Value:** visual polish + standardisation.
- **Cost:** real R&D + content pipeline.
- **Risk:** high — easy to ship something embarrassing.
- **Dependency:** Phases 3–6 + a clear non-mascot visual direction. Per [AI visual pipeline](mem://specs/exercise-ai-visual-pipeline.md), defer until real video pipeline works.

## Phase 8 — Trainer custom media · **Parked**
- **Value:** trainer overrides with own demonstrators.
- **Cost:** RLS, ownership, storage limits.
- **Risk:** medium (PII / liability).
- **Dependency:** Phases 3–6 and a trainer-tier billing decision.

## Default recommendation

- **Now:** Phase 0 + Phase 1 (file discipline + this round's docs).
- **Next:** Slice 2 identity wiring (`longitudinal.ts`, logbook continuity) — **NOT** media implementation.
- **Later:** Phases 3–6 in order.
- **Parked:** Phases 7–8.
