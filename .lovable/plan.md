
# Round 7 — Logbook como história, volume com realidade, ano com blocos

Foco P1 do backlog (#5, #6, #7, #8). Princípio: útil > funcional > bonito > divertido. Sem features novas — só fechar o que está escrito.

## 1. Logbook timeline na página do plano (#5)

Novo componente `src/components/plan/LogbookTimeline.tsx`:
- Recebe `sessions: SessionRow[]` e agrupa por `week_number`.
- Cada semana é um `<details>` colapsável:
  - Header: "Semana N · X/Y sessões · adesão Z% · RPE médio R" com chips tonais (`status-tone.ts`).
  - Sessões em linha: data, dia, status (chip emerald/amber/muted), RPE médio, badge Sparkles "PR" se algum exercício bateu e1RM máximo histórico do cliente.
  - Click numa sessão → expande `SessionDayView` inline (reaproveitar componente).
- Detecção de PR: percorre todas as sessões do plano, calcula e1RM por exercício (Epley, já em `capacity-gain.ts` — exporto `epley`), marca a sessão onde cada exercício atingiu o seu máximo.

Substitui o bloco "Sessões registadas" actual em modo `view`/`results` em `src/routes/plans.$planId.tsx` (procurar `SessionDayView` solto e a lista plana).

## 2. Volume realizado vs prescrito (#6, #8)

Nova lib `src/lib/volume-actual.ts`:
- `computeWeeklyActualVolume(sessions, exercises)` → mesma forma que `computeWeeklyVolume` mas conta apenas sets com `actual.sets > 0`.

Em `src/components/volume/VolumeSection.tsx`:
- Aceita prop opcional `sessions?: SessionRow[]`.
- Se `sessions` presente, `VolumeStatusTable` ganha coluna "Realizado" (sets contados) ao lado de "Prescrito"; barras emerald se ≥80% prescrito, amber 50-79%, red <50%.
- Adiciona pequeno gráfico stack-bar (recharts) por semana: barra prescrito (muted) + barra realizado (emerald), linha pontilhada MEV/MAV. ~140px alto.

Em `src/routes/plans.$planId.tsx` passa `sessions` para `VolumeSection` em modos `view`, `log`, `results`.

## 3. YearView — blocos como cards com micro-CapacityGain (#7)

Em `src/components/YearView.tsx`:
- Nova secção "Blocos" no topo: lista cards horizontais (1 por bloco) com:
  - "Bloco N · Mmm-Mmm" 
  - Δ% capacidade vs bloco anterior (chip tonal grande, reaproveita `computeCapacityGain`)
  - 3 mini-stats: adesão %, RPE médio, sessões logged
  - Click → navega para `/plans/{blockPlanId}` em modo results
- Buscar via `workout_plans` filtrado por `client_id` ordenado por `block_number`, com sessões correspondentes carregadas em batch.

## 4. Backlog refresh

Atualizar `.lovable/backlog.md`: marcar #5-8 como ✅ Round 7. Promover #9 (Dashboard "evolução último bloco") e #10 (pós-validação rotação) para P0/Round 8. Adicionar 2 novos P1 descobertos:
- "Logbook PR celebration: confetti suave quando se loga um set que bate e1RM (uma vez por sessão)."
- "Plan page: secção 'Próximo bloco' sugerida (deload/progressão) baseada no transition_summary, com botão direto para arquivar+gerar."

## Ficheiros

**Criar**: `src/components/plan/LogbookTimeline.tsx`, `src/lib/volume-actual.ts`.
**Editar**: `src/lib/capacity-gain.ts` (exportar `epley`), `src/components/volume/VolumeSection.tsx`, `src/components/volume/VolumeStatusTable.tsx`, `src/components/YearView.tsx`, `src/routes/plans.$planId.tsx`, `.lovable/backlog.md`.

Tudo PT-PT (você), tonal via `status-tone.ts`. Sem novas dependências.

Aprovas para executar?
