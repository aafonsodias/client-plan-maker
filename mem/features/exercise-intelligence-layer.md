---
name: Exercise intelligence layer — deferred scope
description: Future structured exercise database with muscle/pattern/equipment/pain mapping. Do NOT patch in piecemeal.
type: feature
---
Future direction (not for current MVP):
- structured exercise database (canonical names, aliases)
- primary + secondary muscles per exercise
- movement pattern (squat/hinge/push/pull/carry/lunge/rotate/anti-rotate)
- progression/regression ladders
- equipment variants (barbell/dumbbell/machine/cable/bodyweight)
- pain-aware substitutions (low-back, knee, shoulder)
- McGill-inspired low-back overlay
- volume calculation by muscle/pattern (replaces current pattern-only)
- clearer exercise taxonomy (categories: main lift, accessory, isolation, conditioning)
- better MEV/MAV/MRV mapping per muscle
- exercise names standardised across plans/logs/PDF (no more "OHP" vs "Overhead Press" drift)

Open question for future:
Is current pattern-based volume good enough for MVP, or do we need structured exercise→muscle map before scaling past Studio tier?

Do not implement until at least one of:
- a paying user complains about volume accuracy
- we add programming for an injured/recovering client
- we ship multi-language exercise libraries
