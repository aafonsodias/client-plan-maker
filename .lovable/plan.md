# Phase 4C — MVP Lock-In

Presentation-only round. No engine, schema, generation, or persistence changes. Most of the prompt pack is already implemented in the codebase — this plan closes the remaining gaps.

## What's already done (verified)
- `customize_rule` key + `/knowledge` call sites — done.
- `inferLogbookModeFromDayFocus` chip in `/log/$token` (lines 311–318), already gated on `day.focus`.
- `RationaleChip` already has try/catch + `defaultValue` fallback for missing keys.
- `IntensityCockpit` already uses `defaultValue` on manual-control labels.

## Remaining gaps to close

### Round A — Hook stability + null-safety
**`src/components/BriefEditor.tsx`**
- Extract the two JSX IIFEs into top-level `const`s computed once per render:
  - lines 145–158 → `const tierInference = inferTier({...})` above the return.
  - lines 340–382 → `const splitInference`, `splitMatches`, `splitChipInf`, `splitLabels` above the return.
- Replace `brief.sessions_per_week.recommended` direct reads with `brief.sessions_per_week?.recommended ?? 0` for legacy plans missing PV.
- Use `brief.red_flags ?? []` consistently (already used at 147, audit other call sites).

**`src/components/plan/IntensityCockpit.tsx`**
- Hook-order audit: confirm no hooks after early returns. Type-cleanup pass on `manualEnvelope` only.

**`src/routes/plans.$planId.tsx`** + **`src/routes/knowledge.tsx`**
- Render-guard audit only; add `?? []` / `?? null` fallbacks where loader data may be undefined for legacy plans. No new hooks.

### Round B — i18n appendix sync
**`src/i18n/locales/en/common.json`** and **`src/i18n/locales/pt/common.json`**

Add new keys under `ux.rationale.labels`:
| key | EN | PT |
|---|---|---|
| validated | Validated | Validado |
| within_range | Within range | Dentro do intervalo |
| recovery_compatible | Recovery-compatible | Compatível com recuperação |
| profile_based | Profile-based | Baseado no perfil |
| auto_adjusted | Auto-adjusted | Auto-ajustado |
| manually_adjusted | Manually adjusted | Ajustado manualmente |
| goal_compatible | Goal-compatible | Compatível com o objetivo |
| constraints_respected | Constraints respected | Restrições respeitadas |
| controlled_progression | Controlled progression | Progressão controlada |
| evidence_aligned | Evidence-aligned | Alinhado com a evidência |

Align existing `ux.rationale.reasons.logbook_mode_*` to the appendix wording:
- EN `logbook_mode_from_focus`: "Inferred from session focus: {{focus}}"
- PT `logbook_mode_from_focus`: "Inferido do foco da sessão: {{focus}}"
- EN `logbook_mode_default`: "No focus set — mixed mode"
- PT `logbook_mode_default`: "Sem foco definido — modo misto"

(Keys are additive; no callers removed.)

### Round C — Mobile 375 hardening
**`src/components/ux/RationaleChip.tsx`**
- PopoverContent already uses `max-w-[calc(100vw-2rem)]` and `collisionPadding={12}` — confirm OK at 375.
- Add `max-w-full break-words` to the trigger button so long inferred labels wrap instead of overflowing.

**`src/routes/log.$token.tsx`** (line 311 chip row)
- Wrap the focus row in `min-w-0` and ensure `flex-wrap` is honoured (already present).

## Smoke plan
- Desktop + 375px: `/dashboard`, `/knowledge`, `/plans/$id` (with + without PV), `/log/$token` (with + without `day.focus`), `/settings`.
- Console: zero hook-order warnings on BriefEditor mode toggles.
- i18n: PT and EN render new wording; missing-key fallback shows EN, not raw key.

## Non-goals (explicit)
- No engine, schema, persistence, or payload changes.
- No new RationaleChip variants, no provenance dot palette (deferred to next round).
- No "Today" ribbon, no diff cards, no OCR promotion (audit Rounds A/B/C deferred).

## Acceptance
- `react-hooks/rules-of-hooks` clean on all touched files.
- `RationaleChip` returns null for null inference and never throws on missing key/params.
- `BriefEditor` renders cleanly on legacy plans (missing `sessions_per_week`, missing `red_flags`).
- Logbook focus chip visible only when `day.focus` exists; chip wraps cleanly at 375px.
- All new PT/EN strings present and consistent.
