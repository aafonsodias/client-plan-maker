# Forge — Backlog vivo

Atualizado: Round 10 (3 Mai 2026)

| # | P | Área | Item | Estado |
|---|---|---|---|---|
| 1 | P0 | Motor | Rotação de exercícios entre blocos (prior_exercise_pool no Stage 3 prompt) | ✅ Round 6 |
| 2 | P0 | Motor | Bump load multiplier inter-blocos no archivePlanAndStartNextBlock | ✅ Round 6 |
| 3 | P0 | Plan page | CapacityGainCard (capacidade vs bloco anterior) no view + results | ✅ Round 6 |
| 4 | P0 | Lib | computeCapacityGain (Δ% por padrão + e1RM Epley) | ✅ Round 6 |
| 5 | P1 | Plan page | Logbook timeline (semana colapsável + PR badges via e1RM) | ✅ Round 7 |
| 6 | P1 | Volume | Realizado vs prescrito em VolumeSection (coluna + chip tonal) | ✅ Round 7 |
| 7 | P1 | YearView | Strip de Blocos no topo com micro-CapacityGain por bloco | ✅ Round 7 |
| 8 | P1 | Lib | computeWeeklyActualVolume (lê sessões + cruza com plano) | ✅ Round 7 |
| 9 | P0 | Dashboard | Coluna "evolução último bloco" na lista de clientes | 🔜 Round 8 |
| 10 | P0 | Motor | Pós-validação: se <40% accessory rotation, retry 1× com lista a evitar | 🔜 Round 8 |
| 11 | P2 | i18n | Sweep EN final + smoke test em todas as rotas | 🔜 Round 8 |
| 12 | P2 | Demo | Tour aproveita CapacityGainCard como ponto âncora extra | 🔜 Round 8 |
| 13 | P1 | Logbook | Confetti suave (1×/sessão) ao logar set que bate e1RM | 🔜 Round 8 |
| 14 | P1 | Plan page | Secção "Próximo bloco" sugerida (deload/progressão) com CTA arquivar+gerar | 🔜 Round 8 |
| 15 | P2 | Volume | Stack-bar semanal prescrito vs realizado (recharts ~140px) | 🔜 Round 9 |
| 9 | P0 | Dashboard | Chip Δ% evolução por plano em "Recent plans" (usePlanBlockEvolution) | ✅ Round 8 |
| 10 | P0 | Motor | Pós-validação rotação: retry 1× se <40% + rotation_audit em generation_meta | ✅ Round 8 |
| 12 | P2 | Demo | Passo "step_capacity" no tour ancorado em CapacityGainCard | ✅ Round 8 |
| 13 | P1 | Logbook | Confetti + toast 1×/sessão ao detectar PR e1RM | ✅ Round 8 |
| 14 | P1 | Plan page | NextBlockCard (deload/normal/push por adesão+RPE) com CTA Iniciar Bloco N+1 | ✅ Round 9 |
| 17 | P2 | Motor | Chip "Rotação N%" no header do plano (rotation_audit.finalPct) | ✅ Round 9 |
| 11 | P1 | i18n | Sweep EN final + smoke test em todas as rotas | 🔜 Round 9 |
| 15 | P1 | Volume | Stack-bar semanal prescrito vs realizado (recharts ~140px) | 🔜 Round 9 |
| 16 | P1 | Dashboard | Sparkline e1RM (EvolutionSparkline) ao lado do chip Δ% em Recent plans | ✅ Round 10 |
| 18 | P2 | Plan page | Popover do chip Rotação com firstPct→finalPct, dias regenerados e pool top 6 | ✅ Round 10 |
| 19 | P1 | Motor | Bloco ≥4 marca suggest_main_lift_swap; Stage 3 prompt + chip "Main lift refrescado" | ✅ Round 10 |
| 20 | P1 | Volume | Stack-bar semanal prescrito vs realizado (recharts ~140px) | 🔜 Round 11 |
| 21 | P1 | i18n | Sweep EN final + smoke test em todas as rotas | 🔜 Round 11 |
| 22 | P0 | Plan page | Auditoria real do main-lift swap (prior_main_lifts → main_lift_audit; chip honesto) | ✅ Round 11 |
| 23 | P1 | i18n | Sweep EN final + smoke test em todas as rotas | 🔜 Round 13 |
| 24 | P1 | Volume | Stack-bar semanal prescrito vs realizado (WeeklyVolumeBars, ~160px) | ✅ Round 12 |

## Princípio
Útil > funcional > bonito > divertido. Cada ronda corta o que não passa todos os 4.

## Meta-prompt sugerido para ti
> "Continua o backlog. Foco P0 desta ronda: **[área]**. Resultado esperado: **[1 frase]**. Princípio: útil, funcional, bonito, divertido — sem inventar features fora do backlog. Atualiza .lovable/backlog.md no fim."