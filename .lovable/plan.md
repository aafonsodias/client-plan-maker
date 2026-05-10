# Fase B — Unificar regen e honrar Cockpit/RPE

## Problema concreto a fechar
Hoje o botão "Regenerar com feedback" chama `generatePlanDraft` (single-shot, ~12k tokens, todas as semanas). Resultado:
- **Timeout** em planos de 4+ semanas (Worker corta a ~30s).
- **Cockpit ignorado**: `programming_variables.rpe_ceiling` nem sequer é passado ao handler. O prompt só vê `experience_level` + safety counts.
- **Feedback livre é dump verbatim**: "começa em rpe 6.5" é texto solto na prompt — o modelo decide se honra.

## O que vai mudar (3 PRs encadeados, mesmo round)

### B1 — Parser determinístico do feedback `(novo helper, zero risco)`
- Criar `src/lib/feedback-parser.ts` com `parseRpeOverrideFromFeedback(text)`.
- Reconhece (case-insensitive, PT+EN):
  - `rpe 6.5`, `rpe 6-7`, `rpe até 7`, `começa em rpe 6.5`, `start at rpe 6.5`, `cap rpe at 7.5`, `tecto 7`.
- Devolve `{ rpe_ceiling?: number, rpe_floor?: number }` ou `null`.
- Testes inline (vitest) para cobrir as 8 frases-tipo.

### B2 — `generatePlanWeek` aceita `programming_variables` e injecta no prompt como HARD CONSTRAINT
- Adicionar `programming_variables: ProgrammingVariablesSchema.partial().nullable().optional()` ao `WeekInputSchema` em `src/server/plan.functions.ts`.
- No prompt builder (`buildClientContextBlock` ou novo `buildCockpitConstraintBlock`):
  - Quando `pv.rpe_ceiling` definido: linha "RPE CEILING (HARD): main lift RPE ≤ X. Accessories ≤ X−1. Carries ≤ X−2."
  - Quando `pv.wave_model`/`deload_frequency` definidos: passar para o brief textual.
- Sem mudança de schema DB; é só plumbing.

### B3 — `RegenerateWithFeedbackDialog` muda de single-shot para fan-out
Em `src/components/PlanEditorSurface.tsx`:
1. Carrega `programming_variables` do `workout_plans` (já existe na select).
2. Aplica `parseRpeOverrideFromFeedback(feedback)` por cima do `pv` carregado (override prevalece sobre o stored).
3. `Promise.all` de `generatePlanWeek` × `duration_weeks`, cada call recebe `pv` resolvido. Concorrência limitada a 3 (Promise pool simples) para não bater em rate-limit do gateway.
4. Merge: title/summary vêm da Semana 1; weeks ordenados por `week_number`.
5. Persistência idêntica à actual (`plan_data_version` bump, mesmo update).
6. UX: progress mostra `Semana X/N` em vez de `idle/context/ai/saving`. Sticky cancel button.
7. Se 1 semana falhar → toast "Semana X falhou — tenta de novo só essa semana?" + botão de retry isolado (versão simples: oferece reabrir o dialog).

## Verificação (manual, mesmo cliente)
1. Abrir plano de 4 semanas → editar Cockpit para `rpe_ceiling=7.5` → guardar → "Regenerar com feedback" sem texto.
   - **Esperado**: 4 calls em paralelo, conclusão <25s, todas as semanas com main RPE ≤ 7.5.
2. Cockpit ceiling=8.5, feedback = "começa em rpe 6.5".
   - **Esperado**: parser detecta, override pisa o stored, plano sai com main RPE 6–7.
3. Plano de 6 semanas, intencionalmente apertado (`max_tokens=8000` por semana, suficiente).
   - **Esperado**: zero timeout. Logs mostram 6 entradas em `generation_log` com stage=`regen:weekN`.
4. Feedback contraditório ("rpe 9 mas cap em 7") → parser usa o último número como ceiling. Documentado no helper.

## O que NÃO entra (intencional)
- Refactor para **phased pipeline** no regen. O caminho legacy fica, mas passa a ser honesto sobre o Cockpit. A unificação total (regen → re-correr Stage 1+3+4) precisa do seu próprio round porque o brief regenerado pode invalidar approvals de stage anteriores.
- Bloco concorrente (Fase C — `motorCapacityNeeds`/`buildConcurrentTrainingBlock`). Fica para o round seguinte para podermos verificar B isoladamente.
- Mudar copy/i18n de UI fora do dialog do regen.

## Ficheiros tocados (esperado)
- `src/lib/feedback-parser.ts` *(novo)*
- `src/lib/feedback-parser.test.ts` *(novo, vitest)*
- `src/server/plan.functions.ts` — `WeekInputSchema` + handler de `generatePlanWeek` lê pv.
- `src/server/plan.server.ts` — `buildCockpitConstraintBlock(pv)` novo, chamado por `buildClientContextBlock`.
- `src/components/PlanEditorSurface.tsx` — `RegenerateWithFeedbackDialog` reescrito (mesmo prop signature).
- `mem://index.md` — actualizar a entrada R70 com Fase B.

## Pergunta antes de implementar
**Concorrência por defeito**: 3 calls em paralelo é o sweet-spot que tenho visto noutros sítios do projecto (`programNextWeek`). Confirmas, ou queres 2 (mais conservador, +5–8s em planos de 6 semanas) ou 6 (sem pool, máximo paralelo, risco de 429)?
