# Ronda 8 — Dashboard evolution + Motor hardening + Polish

Princípio: útil > funcional > bonito > divertido. Cada item passa nos 4.

## P0 — Motor & Dashboard

### 1. Rotation post-validation retry (`stage3-microcycle.functions.ts`)
- Após gerar microcycle do bloco N+1, calcular `accessoryRotationPct` vs `prior_exercise_pool`.
- Se < 40%, fazer **1 retry** com prompt reforçado listando exercícios proibidos (top-12 do bloco anterior) e exigindo substitutos do mesmo padrão.
- Logar resultado em `generation_meta.rotation_audit { firstPct, finalPct, retried }`.

### 2. Dashboard "Evolução último bloco" (`src/routes/dashboard.tsx` + lista de clientes)
- Nova coluna/chip por cliente: lê plano ativo + `prior_plan_id`, corre `computeCapacityGain` head-to-head sobre top-3 padrões (squat/hinge/push).
- Mostra Δ% mediano com `toneChip` (emerald se > +2%, muted se ±2%, amber se queda) + tooltip com breakdown.
- Sem dados (bloco 1 ou sem logs) → chip neutro "Bloco 1 — sem comparação".
- Fetch lazy: hook `useClientsBlockEvolution(clientIds)` em batch, cache via TanStack Query 5min.

## P1 — Plan page polish

### 3. Confetti em PR no logbook (`LogbookTimeline.tsx` + `Confetti.tsx`)
- Quando o utilizador loga um set e o seu e1RM > histórico → `<Confetti/>` 1×/sessão (guardar `prSeen` em `useRef` por sessionId).
- Toast "PR! Novo recorde em {exercise} ({weight}kg×{reps})" via sonner.

### 4. "Próximo bloco" suggestion card (`src/components/NextBlockCard.tsx`)
- Renderiza no fim de `/plans/$id` quando: plano `completed` OU semana atual = última semana com >70% adesão.
- Lê `block_feedback` + capacity gain para sugerir: deload (se RPE médio > 8.5), progressão normal, ou volume bump.
- CTA único: "Arquivar e gerar Bloco N+1" → chama `archivePlanAndStartNextBlock` com sugestão pré-preenchida.

## P2 — Polish

### 5. i18n EN sweep
- `rg "[Áàãâéêíóôõúç]"` em `src/i18n/locales/en/*.json` → traduzir hardcoded PT remanescente.
- Smoke walk: dashboard → cliente → plano → blueprint → microcycle → progressions → year. Verificar i18n keys faltantes (console: `i18next::translator: missingKey`).

### 6. Tour: âncora `data-tour="capacity-gain"` no `CapacityGainCard`
- Adicionar passo no `TourContext` entre `plan-block-chip` e `volume-section`.

## Atualização de backlog
Mover #9, #10, #13, #14 para ✅ Round 8. Promover #11, #12, #15 para P1 da Round 9. Adicionar nova entrada P1: "Realized vs prescribed stack-bar chart (recharts)".

## Ficheiros

**Criar**
- `src/components/NextBlockCard.tsx`
- `src/hooks/use-clients-block-evolution.ts`

**Editar**
- `src/server/phased/stage3-microcycle.functions.ts` (post-validation retry + rotation_audit meta)
- `src/routes/dashboard.tsx` (evolução column)
- `src/routes/clients.tsx` (chip evolução, se lista lá)
- `src/components/plan/LogbookTimeline.tsx` (PR detection → confetti+toast)
- `src/routes/plans.$planId.tsx` (montar NextBlockCard)
- `src/components/CapacityGainCard.tsx` (data-tour anchor)
- `src/contexts/TourContext.tsx` (passo extra)
- `src/i18n/locales/en/*.json` (sweep)
- `.lovable/backlog.md` (refresh)

## Notas técnicas
- `computeCapacityGain` já retorna `medianDeltaPct`; reutilizar sem alterar API.
- Confetti: já existe `src/components/log/Confetti.tsx` — só wire-up.
- Retry no Stage 3: cap em 1 tentativa para não duplicar custo. Telemetria via `makeTelemetry`.
- NextBlockCard usa `toneChip` para coerência com paleta status.

Aprovas?