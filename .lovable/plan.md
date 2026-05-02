# Consolidação 2026-05-02

Phase B fechada. Turno foi de **simplificação**, não de novas features.

## Cortes aplicados

- `src/routes/plans.$planId.tsx`: 1801 → 1526 linhas (-275, -15%).
  - Removido o fallback `!isPhasedComplete` (cards-edit) e as 4 funções suporte (`WeekBlock`, `DayBlock`, `SectionEditor`, `ExerciseRow`, `FieldStack`) — código morto desde que o phased generator se tornou o único caminho de criação. Confirmado no DB: 0 planos legacy.
  - Removidos helpers `addWeek`/`updateWeek`/`removeWeek` no `PlanEditor` (só serviam o fallback).
  - Removido import não usado `SectionItem`.
  - `ViewMode` + `DayQuickMark` preservados (estavam no meio do bloco apagado, recuperados via git).

## Turno seguinte (#5 fechado)

- `/manual` agora tem 3 modos (Manual, FAQ, Contacto) numa só rota. Decisão deliberada para evitar 3 rotas separadas com 3 head() para manter. FAQ é accordion estático em i18n. Contacto usa `mailto:` — zero backend novo, zero captcha, zero rate-limit a inventar.

## Próximo turno

1. Phase C continua: #1 landing revamp, #9 assessment fade-section, #6 + #11 synthesis enrichment, #14 speed.
2. Refactors invisíveis (pdf.ts em módulos, sessions.functions.ts split) só fazem sentido quando o trabalho user-facing tiver acalmado.
