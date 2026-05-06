
# Phase 4C — Stabilization, Explainability, UX Hardening

Presentation-only round. No engine, generation, schema, migration, or persistence changes.

## Objectives

1. Eliminate React hook-instability risk in recently touched components.
2. Unify rationale/control language across PT-PT and EN.
3. Make `RationaleChip` resilient to missing data (legacy plans).
4. Surface `inferLogbookModeFromDayFocus` as a display-only chip on session pages.
5. Mobile 375px hardening pass on the surfaces touched.

## Files to touch

- `src/components/ux/RationaleChip.tsx` — defensive guards + i18n fallback already partial; tighten.
- `src/components/BriefEditor.tsx` — move IIFE-based chip rendering out of JSX into top-level computed values to keep render order stable across `mode`/`brief` changes; safe fallbacks for missing `brief.sessions_per_week`, `brief.red_flags`.
- `src/components/plan/IntensityCockpit.tsx` — already top-level hooks; verify no conditional hooks; tighten `manualEnvelope` typing; ensure `mode === "lab"` path doesn't reorder hooks.
- `src/routes/knowledge.tsx` — wrap rationale builders in try/catch (already done for `diffCount`, extend to top-level builders); rename `editLabel` key (see i18n below).
- `src/routes/log.$token.tsx` — add display-only `RationaleChip` driven by `inferLogbookModeFromDayFocus(day.focus)` next to the session header. Render nothing if `focus` is empty. No persistence, no log payload changes.
- `src/routes/plans.$planId.tsx` — audit only; add no new hooks. Confirm chip rendering paths handle missing brief/PV.
- `src/lib/auto-infer.ts` — already pure; no changes expected.
- `src/i18n/locales/pt/common.json` + `en/common.json` — new/renamed keys (see below).

## i18n changes (additive + 1 rename)

Rename existing key (preserve callers in knowledge.tsx by updating call sites in same patch):
- `ux.rationale.labels.override_default` → `ux.rationale.labels.customize_rule`

New keys under `ux.rationale.labels` (PT / EN):
- `validated` — "Validado" / "Validated"
- `within_range` — "Dentro do intervalo" / "Within range"
- `recovery_compatible` — "Compatível com recuperação" / "Recovery-compatible"
- `profile_based` — "Baseado no perfil" / "Profile-based"
- `auto_adjusted` — "Auto-ajustado" / "Auto-adjusted"
- `manually_adjusted` — "Ajustado manualmente" / "Manually adjusted"
- `goal_compatible` — "Compatível com o objetivo" / "Goal-compatible"
- `constraints_respected` — "Restrições respeitadas" / "Constraints respected"
- `controlled_progression` — "Progressão controlada" / "Controlled progression"
- `evidence_aligned` — "Evidence-aligned" / "Evidence-aligned"

New keys under `ux.rationale.reasons` for logbook mode chip:
- `logbook_mode_from_focus` — "Inferido do foco da sessão: {{focus}}" / "Inferred from session focus: {{focus}}"
- `logbook_mode_default` — "Sem foco definido — modo misto" / "No focus set — mixed mode"

(The `auto-infer.ts` reason_keys already match these; these strings just need to land in `common.json` if missing.)

ES/HI fall back to EN per project rule.

## React stability rules applied

For every touched component:
- All `useState`/`useEffect`/`useTranslation`/`useServerFn` calls live at the top of the component body.
- No hooks after early returns.
- IIFE chip blocks in JSX (BriefEditor lines 145–158, 340–382) replaced with values computed at the top of the component, then rendered conditionally — eliminates re-evaluation order risk when `mode` or `brief.sessions_per_week` flips.
- Inputs to inference helpers wrapped in nullish-safe accessors (`brief.red_flags ?? []`, `brief.sessions_per_week?.recommended ?? 0`).
- `RationaleChip` already returns `null` for null/undefined inference; verify the `try/catch` around `t(...)` for `reason_key` does not throw on missing `reason_params`.

## Risk areas

- Renaming `override_default` → `customize_rule`: 4 call sites in `knowledge.tsx`. Updated in same patch. Other locales contain the key too; rename in PT + EN simultaneously; ES/HI inherit via fallback.
- `log.$token.tsx` is a heavy public route — adding a chip must not introduce hooks. Will use the existing render scope and a pure helper call. If the file's structure makes a clean injection risky, the chip lands on the trainer-side session view (`SessionDayView` or equivalent) instead and `log.$token.tsx` is left untouched. Decision made after re-reading the file.
- IntensityCockpit already passes a hand-built `manualEnvelope as any` for non-inferred knobs. Tightening the type to `Inference<"manual">` so we drop the `as any` — pure type fix, no behavior change.

## Smoke strategy

- Desktop 1280px: `/dashboard`, `/knowledge`, `/plans/$id` (legacy plan + new plan), `/log/$token`, settings.
- Mobile 375px (preview viewport switch): same routes — confirm chip wrapping, popover collision padding, no horizontal scroll.
- Legacy data: open a plan with no `programming_variables` and no `red_flags` → BriefEditor and Cockpit must render without crashing.
- i18n: switch to EN → all new chip strings render; switch to ES/HI → strings fall back cleanly.

## Non-goals (explicitly out)

- Quick Path / Lab Mode flow changes
- Schema/migration/persistence
- Engine, progression, deload, PKL, programNextWeek logic
- New auto-approval, new modals, new sliders, per-knob confidence dots
- Logbook persistence
- PDF, generation prompts, payloads

## Acceptance

- No "Rendered more hooks than during the previous render" warnings on any touched route.
- Every chip surface uses unified PT-PT / EN vocabulary.
- Logbook chip appears on session pages when `day.focus` is set, vanishes silently otherwise.
- 375px viewport: no overflow, no clipped popovers, all chips wrap.
- Legacy plans (no brief / no PV) render without errors.
