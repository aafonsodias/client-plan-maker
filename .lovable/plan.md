# Intake → Plano: garantir que arranca por baixo e que o regen é suficiente

## Resposta directa à pergunta operacional
**Não precisas de criar uma pessoa nova de cada vez.** O regen já existe e re-corre a pipeline com o mesmo `assessment_snapshot` — o problema é que hoje há **dois caminhos de regen** e só um deles respeita o Cockpit/RPE. Vamos unificar para que **editar a avaliação + clicar "Regenerar"** seja sempre suficiente. Cliente novo só para validar o "primeiro disparo".

## O que o audit de Maio já provou
- **Pipeline phased (1→5)** lê `programming_variables.rpe_ceiling` e `training_age_band` correctamente. Stage 4 wave honra o tecto.
- **Pipeline legacy (`generatePlanDraft`)** — usado pelo botão "Regenerar com feedback" — **ignora o Cockpit** e estoura timeout em 12k tokens single-shot.
- Sinais motores (`single_leg_balance_score≤2`, `cardio_capacity` baixo, `secondary_goals: balance/agility/coordination`) chegam ao prompt mas **não geram bloco concorrente** — são apenas dump de contexto.
- `experience_level` é o único driver real do "começar baixo". Se vier vazio, anchor cai em intermediate (RPE 7) em vez de beginner (RPE 5.5).

## Plano de 3 fases (pequenas, verificáveis)

### Fase A — Fechar o gap "começar por baixo" (deterministic, sem AI)
1. **`deriveStartingFloor(assessment)`** novo helper em `src/server/phased/programming-defaults.ts`:
   - Lê `experience_level`, `years_training`, `med_flags`, `injuries`, `parq_passed`, `acsm_risk_category`, `single_leg_balance_score`, `recovery_capacity`.
   - Retorna `{ rpe_floor, rpe_ceiling, volume_tier: "MEV"|"MAV"|"MRV", weeks_to_progress: 2|3|4 }`.
   - Regra: qualquer 1 de {iniciante, red_flag amber, lesão activa, balance≤2, recovery="poor"} → MEV + RPE 5.5–7 + 3 semanas antes de subir volume.
2. **Stage 1 (brief)** passa a popular `programming_variables.rpe_ceiling/floor` com este resultado, em vez de usar só a tabela `age → ceiling`.
3. **Stage 3 (microcycle)** já tem `rpe_floor_applied`; passa a receber `volume_tier` e instruir o modelo "máximo N séries por padrão na Semana 1" (lookup `prescribeWeek(tier)`).
4. **Stage 4 (wave)** anchor = `rpe_floor` da Semana 1 (já existe a infra; falta o input correcto).

### Fase B — Unificar regen (matar o legacy path)
1. **`RegenerateWithFeedbackDialog`** deixa de chamar `generatePlanDraft`.
2. Passa a chamar `regenerateMicrocycle(planId, { feedback, overrides })`:
   - Reaplica `parseRpeOverrideFromFeedback` (já existe).
   - Re-corre **só Stage 3 + Stage 4** (Stage 1/2 só re-corre se a avaliação mudou desde a última geração — comparar `updated_at`).
   - Fan-out per-week com `generatePlanWeek` → sem timeout.
3. **UX**: o botão passa a chamar-se "Regenerar com a avaliação actual" + linha pequena "última avaliação: há 2 dias". Se editaste a avaliação depois do plano, mostra chip amber "avaliação alterada — rebrief vai correr".

### Fase C — Bloco concorrente quando o intake o pede
1. `motorCapacityNeeds(assessment)` + `buildConcurrentTrainingBlock(needs)` (já desenhado no audit) entram em Stage 2 (blueprint) — adiciona `concurrent_day` archetype quando há sinais.
2. Stage 3 recebe instruções explícitas de drills (single-leg, agility ladder, dual-task walk-and-count, Z2 8–12min) com volume cap.
3. Visível no PDF e na Casa do cliente.

## Workflow de teste que vais usar
1. **Cliente demo seedado** (não precisas criar) → abre avaliação → muda `experience_level=beginner`, `single_leg_balance_score=2`, `recovery_capacity=poor` → **Guarda**.
2. Clica "Regenerar com a avaliação actual" no plano existente.
3. Verifica em <25s: Semana 1 RPE 5.5–7, MEV séries, 1 dia com bloco motor/concorrente.
4. Repete sem mudar nada → resultado idêntico (determinístico onde deve ser).

## O que NÃO entra
- Refactor visual da avaliação ou do PDF.
- Novas tabelas (tudo cabe em `assessments` + `programming_variables`).
- Tocar no `program-next-week` (já funciona com base nas sessões logged — fora deste round).

## Detalhe técnico (ficheiros tocados)
- `src/server/phased/programming-defaults.ts` — `deriveStartingFloor()`, expor `volume_tier`.
- `src/server/phased/stage1-brief.functions.ts` — popular pv via helper acima.
- `src/server/phased/stage3-microcycle.functions.ts` — passar `volume_tier` ao prompt + cap de séries.
- `src/server/phased/stage2-blueprint.functions.ts` — injectar `concurrent_day` quando `motorCapacityNeeds` ≠ ∅.
- `src/server/phased/microcycle-edit.functions.ts` — novo `regenerateMicrocycle` que decide se re-corre Stage 1/2.
- `src/components/plan/RegenerateWithFeedbackDialog.tsx` — apontar para o novo handler + copy.
- `src/lib/prescribe-volume.ts` — confirmar lookup MEV/MAV/MRV por padrão de movimento.

## Pergunta para ti antes de implementar
Queres que eu **arranque pela Fase A sozinha** (maior impacto no "começar baixo", risco baixo, ~1 ronda) e só depois ataque a Fase B (unificar regen, médio risco), ou as duas no mesmo PR?
