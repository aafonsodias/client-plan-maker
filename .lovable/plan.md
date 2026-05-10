# Round C — SMART Goal: Bugs + Templates + Aspiration Builder

Tightly scoped to assessment §5 (SMART goal). Zero AI; all deterministic.

## Part 1 — Bug fixes

**1a. Chip affordance** (`SmartGoalSection.tsx`): selected = `bg-foreground/10 ring-1 ring-foreground/30 text-foreground font-medium`; deselected = `bg-muted/20 text-muted-foreground hover:bg-muted/40`. Apply to both category chips and duration chips.

**1b. Progress strip dynamic** (`clients_.$clientId.tsx` sticky header): replace static text with computed `Section ${idx+1}/${SECTIONS.length} · ${pct}% · ~${remainingMin} min`. `idx` from `activeId`; `pct = completeCount/total*100`; `remainingMin = Math.max(1, Math.round((total-completeCount)*0.5))`.

**1c. Stale "Goal logged" banner**: only render when `value.smart_specific` non-empty AND >2s since last template click. Track `lastTemplateClickAt` state; banner reads current `value.smart_specific` (no cached string).

**1d. Microcopy**: fix `goals.implications.horizon_*` keys (or wherever "12 semanas dá para 1 bloco" lives — likely `RxImplications` goal builder or `goal_block.complete_meaning`). Audit and correct: 6w≈1 short block, 8-10w≈2, 12-16w≈2-3, 20+w≈3-4. Apply in pt/en/es/hi.

## Part 2 — 26 curated templates

Rewrite `src/lib/goal-templates.ts`:
- Add `cardiovascular_health` to `GoalCategory` union
- Replace `GOAL_TEMPLATES` with 26 entries (3 cv, 4 str, 3 hyp, 3 comp, 3 end, 4 mob, 3 fn, 3 skill)
- Add `requires?: string[]` field on `GoalTemplate` (capacity/measurement slugs; future Round E hook)
- Append to `GOAL_CATEGORIES` array

PT canonical specific/measurable strings for all 26 in honest commitment-to-work framing. EN mirror. ES/HI fall back to PT via i18next.

## Part 3 — Custom skill aspiration builder

**3a.** New file `src/lib/skill-aspirations.ts` with `SkillAspiration` interface, `SKILL_ASPIRATIONS` array (12 entries: handstand, split, pullup, muscle_up, planche, front_lever, back_lever, bridge, pistol_squat, human_flag, single_leg_deadlift, first_pushup), and `matchAspiration(input)` substring matcher.

**3b.** Server fn + DB:
- Migration: `assessment_unmatched_aspirations` table with RLS (trainer manages own).
- New `src/lib/aspirations.functions.ts` with `logUnmatchedAspiration({ clientId, aspirationText })` using `requireSupabaseAuth`.

**3c.** UI in `SmartGoalSection.tsx`: collapsible section below template list — input + "Procurar" button → matched (shows scaffold preview + Apply button) or unmatched (honest message + logs to DB).

**3d.** Apply matched → `onChange` fills smart_specific/measurable/deadline (today + default_weeks*7), sets `primary_goal = "skill"`.

## Part 4 — i18n (~95 new keys)

In `pt/assessment.json` (canonical), `en/assessment.json` (mirror), `es/assessment.json` + `hi/assessment.json` (minimal — fall back to PT/EN):
- 2 new category labels
- 26 × specific + 26 × measurable
- 12 × specific + 12 × measurable + 12 × note
- ~11 builder UI strings

## Files touched

- `src/components/assessment/SmartGoalSection.tsx` (chip styles, banner debounce, custom builder UI)
- `src/routes/clients_.$clientId.tsx` (dynamic progress strip + microcopy audit)
- `src/lib/goal-templates.ts` (rewrite to 26)
- `src/lib/skill-aspirations.ts` (new)
- `src/lib/aspirations.functions.ts` (new server fn)
- `supabase/migrations/<ts>_assessment_unmatched_aspirations.sql` (new table)
- `src/i18n/locales/{pt,en,es,hi}/assessment.json`

## Verification

- `bun scripts/verify-capacity-i18n.ts` (must pass — capacity scope unchanged but sanity)
- Visual smoke at 375px and 1920px in light/medium/dark
- Screenshots → `.lovable/design/round-c-goal-builder/`
- Acceptance: 17 criteria from spec
