# Consolidação 2026-05-02

Phase B fechada. Turno foi de **simplificação**, não de novas features.

## Cortes aplicados

- `src/routes/plans.$planId.tsx`: 1801 → 1526 linhas (-275, -15%).
  - Removido o fallback `!isPhasedComplete` (cards-edit) e as 4 funções suporte (`WeekBlock`, `DayBlock`, `SectionEditor`, `ExerciseRow`, `FieldStack`) — código morto desde que o phased generator se tornou o único caminho de criação. Confirmado no DB: 0 planos legacy.
  - Removidos helpers `addWeek`/`updateWeek`/`removeWeek` no `PlanEditor` (só serviam o fallback).
  - Removido import não usado `SectionItem`.
  - `ViewMode` + `DayQuickMark` preservados (estavam no meio do bloco apagado, recuperados via git).

## Próximo turno

Antes de adicionar features novas, considerar:

1. `src/lib/pdf.ts` (1244 linhas) — provavelmente partir em módulos por secção (header, mesocycle table, day sheet, footer) sem alterar comportamento.
2. `src/server/sessions.functions.ts` (437 linhas) — auditar se draft/save/restore/streak podiam viver em ficheiros mais pequenos.
3. Phase C continua disponível: #1 landing revamp, #5 /manual + /faq + /contacto, #9 assessment fade-section, #6 + #11 synthesis enrichment, #14 speed.
