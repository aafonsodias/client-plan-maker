# Plano — Reconectar avaliação, plano e logging (com RPE/volume e concorrente)

Objectivo: garantir que a avaliação de cada cliente passa a *governar* o plano (RPE inicial, volume inicial, modalidades concorrentes), que a regeneração funciona sem timeout, e que as 5 secções do app trabalham como um protocolo único.

## Fase 0 — Diagnóstico (sem editar código)

Antes de tocar em nada, faço um mapa real (escrito em `.lovable/audits/protocol-wiring-2026-05.md`) com 5 verificações:

1. **Trace "RPE 6.5" pedido pelo utilizador**
   - Lê `stage1-brief` → `stage2-blueprint` → `stage3-microcycle` → `stage4-progressions` e identifica onde `rpe_ceiling` / `rpe_floor` é definido, sobreposto, ou ignorado.
   - Verifica se `programming_variables.rpe_ceiling` do Cockpit chega ao prompt do Stage 3 e ao wave-builder do Stage 4.
   - Hipótese a confirmar: o feedback "regen com RPE 6.5" é tratado como texto livre mas o cockpit não é actualizado, por isso o wave-builder volta a impor 7-8.

2. **Trace "volume baixo / iniciante"**
   - Avaliação → `pre-stage` → `programming-tier.server.ts` → escolha de tier (advanced/conservative/remedial) → `prescribe-volume.ts` / volume landmarks.
   - Confirma que `training_age`, `red_flags`, `injuries` e níveis funcionais da avaliação reduzem MEV/MRV no Stage 3.
   - Hipótese: o tier remedial/conservador existe mas o Stage 3 ignora-o no número de séries por padrão de movimento.

3. **Trace "treino concorrente"**
   - O brief tem `goals` com agility/balance/coordination, mas `section-map.ts` e Stage 3 só geram secções de força/hipertrofia + cardio agregado.
   - Hipótese: falta um arquetipo "concurrent_day" que combine 1 bloco de força curto + bloco de balance/agility/dual-task + bloco cardio, e o brief não o pede explicitamente quando a avaliação tem défices nessas dimensões.

4. **Timeout na regeneração** (screenshot "upstream request timeout")
   - `microcycle-edit.functions.ts` provavelmente re-roda Stage 3 inteiro com modelo Pro sem streaming. Cloudflare Worker = ~30s hard limit.
   - Hipótese: precisa partir em (a) aplicar feedback ao cockpit/brief, (b) re-correr só Stage 3 com `gemini-3-flash-preview`, (c) Stage 4 determinístico já existe.

5. **Mapa avaliação → PDF → plano**
   - Confirma que o mesmo `assessment_snapshot` que entra no PDF de avaliação alimenta o brief. Hoje há duas fontes (snapshot + reload do cliente) e podem divergir.

Entregável da Fase 0: tabela "campo da avaliação → onde é lido → onde é aplicado no plano → estado (OK / perdido / sobrescrito)".

## Fase 1 — Correcções de ligação (sem mudar UX)

Só depois do mapa, e em PRs pequenos:

1. **RPE honrado end-to-end**
   - Stage 3 prompt recebe `rpe_ceiling`/`rpe_floor` como *hard constraint* (não sugestão).
   - Wave-builder do Stage 4 ancora em `rpe_floor` da Semana 1, nunca acima de `rpe_ceiling`.
   - Feedback livre "começa em RPE 6.5" no diálogo de regen actualiza `programming_variables.rpe_ceiling/floor` antes de re-correr Stage 3 (parser determinístico simples para "rpe X" / "rpe X-Y").

2. **Volume inicial governado pela avaliação**
   - `prescribe-volume.ts` lê `training_age`, `red_flags`, `recovery_capacity` da avaliação.
   - Iniciante / red-flag amber → começa em MEV (não MAV). Documentar no `generation_log`.
   - Stage 3 prompt recebe range "min-max séries por padrão" derivado, em vez de número livre.

3. **Treino concorrente como arquétipo**
   - Adicionar `concurrent_day` ao `section-map.ts`: blocos `strength_short` (15-20 min) + `motor_skills` (balance/agility/coord/dual-task, 10-15 min) + `cardio_zone2_or_intervals` (15-25 min).
   - Stage 1 brief activa `concurrent_day` quando a avaliação tem défice em ≥1 dimensão motora OU goal contém endurance + força.
   - Stage 3 prompt para esse dia usa biblioteca curta de drills (handstand-wall, single-leg-balance, ladder, dual-task walk-and-count, etc.).

4. **Regeneração que não dá timeout**
   - Partir `microcycle-edit` em duas server-fns: `applyFeedbackToBrief` (rápido) + `regenerateMicrocycle` (Stage 3 só, flash).
   - UI do diálogo mostra 2 passos com indicador no `DemoRunsContext` (já existe).
   - Fallback: se Stage 3 falhar/timeout, mantém plano antigo e mostra erro accionável.

5. **Avaliação ↔ PDF ↔ plano = uma única fonte**
   - Snapshot canónico em `assessment_snapshot` JSONB. PDF e brief lêem dali. Garantir que regenerar plano não usa dados frescos do cliente sem snapshot novo (ou cria snapshot novo automaticamente).

## Fase 2 — Visualização de dados (5 secções actuais)

As 5 secções (View / Edit / Log / Resultados / Progresso) ficam como estão estruturalmente, mas:

- **Resultados**: garantir que mostra adesão real, RPE prescrito vs RPE actual, e volume por padrão semana-a-semana (não só "% sessões feitas").
- **Progresso**: gráfico longitudinal de e1RM por padrão + capacidade motora (balance hold, agility test) quando há dia concorrente.
- Reusar `<CapacityGainCard/>` e `computeCapacityGain` que já existem.

Sem novas secções nesta ronda — o user disse "as 5 que temos chegam".

## O que NÃO entra nesta ronda

- Refazer UI das secções (a queixa é de ligação, não de UI).
- Reescrever Stages 1-2-4-5 do zero — só *patching* cirúrgico nos pontos onde a auditoria mostrar quebra.
- Notificações push, novos modelos de AI, novas tabelas (a menos que a Fase 0 prove que falta uma).

## Verificação no fim

1. Cliente novo com avaliação iniciante + red-flag amber + goal "endurance + força" → plano gerado começa em RPE 6-7, MEV, e tem 1 `concurrent_day` por semana com balance+agility+cardio.
2. Botão "Regenerar com feedback: começa RPE 6.5" → Cockpit actualiza para 6.5, Stage 3 re-corre em <25s, sem timeout, plano novo respeita 6.5.
3. PDF de avaliação e PDF do plano partilham os mesmos números (training_age, MEV inicial, foco motor).
4. Após 1 semana logada, `programNextWeek` ajusta carga conforme `autoreg_strictness` (já existe — só validar end-to-end).
5. Smoke 375×812 nas 5 secções continua limpo.

## Pergunta de scoping antes de começar

Quero confirmar a ordem: faço **Fase 0 (auditoria escrita) primeiro e mostro-te o mapa** antes de mexer em código? Ou queres que avance directo para Fase 1 nos pontos onde já tenho hipótese forte (RPE honrado + timeout da regen)?
