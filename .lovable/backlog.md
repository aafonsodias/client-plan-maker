# Forge — Backlog vivo

Atualizado: Round 21 (3 Mai 2026)

## Concluído (linha do tempo condensada)

| # | P | Área | Item | Round |
|---|---|---|---|---|
| 1 | P0 | Motor | Rotação de exercícios entre blocos (prior_exercise_pool no Stage 3 prompt) | R6 |
| 2 | P0 | Motor | Bump load multiplier inter-blocos no archivePlanAndStartNextBlock | R6 |
| 3 | P0 | Plan page | CapacityGainCard (capacidade vs bloco anterior) no view + results | R6 |
| 4 | P0 | Lib | computeCapacityGain (Δ% por padrão + e1RM Epley) | R6 |
| 5 | P1 | Plan page | Logbook timeline (semana colapsável + PR badges via e1RM) | R7 |
| 6 | P1 | Volume | Realizado vs prescrito em VolumeSection (coluna + chip tonal) | R7 |
| 7 | P1 | YearView | Strip de Blocos no topo com micro-CapacityGain por bloco | R7 |
| 8 | P1 | Lib | computeWeeklyActualVolume (lê sessões + cruza com plano) | R7 |
| 9 | P0 | Dashboard | Chip Δ% evolução por plano em "Recent plans" (usePlanBlockEvolution) | R8 |
| 10 | P0 | Motor | Pós-validação rotação: retry 1× se <40% + rotation_audit em generation_meta | R8 |
| 12 | P2 | Demo | Passo "step_capacity" no tour ancorado em CapacityGainCard | R8 |
| 13 | P1 | Logbook | Confetti + toast 1×/sessão ao detectar PR e1RM | R8 |
| 14 | P1 | Plan page | NextBlockCard (deload/normal/push por adesão+RPE) com CTA Iniciar Bloco N+1 | R9 |
| 16 | P1 | Dashboard | Sparkline e1RM (EvolutionSparkline) ao lado do chip Δ% em Recent plans | R10 |
| 17 | P2 | Motor | Chip "Rotação N%" no header do plano (rotation_audit.finalPct) | R9 |
| 18 | P2 | Plan page | Popover do chip Rotação com firstPct→finalPct, dias regenerados e pool top 6 | R10 |
| 19 | P1 | Motor | Bloco ≥4 marca suggest_main_lift_swap; Stage 3 prompt + chip "Main lift refrescado" | R10 |
| 22 | P0 | Plan page | Auditoria real do main-lift swap (prior_main_lifts → main_lift_audit; chip honesto) | R11 |
| 24 | P1 | Volume | Stack-bar semanal prescrito vs realizado (WeeklyVolumeBars, ~160px) | R12 |
| 23 | P1 | i18n | Sweep EN — NextBlockCard, WeeklyVolumeBars, popovers Rotação/Main lift | R13 |
| 25 | P1 | i18n | Sweep EN — CapacityGainCard, BlockAdaptationCard, VolumeStatusTable | R14 |
| 26 | P2 | i18n | Sweep EN — YearView + ExerciseTrendChart | R15 |
| 27 | P2 | i18n | Sweep EN — VolumeSection header + tooltip MEV/MAV/MRV | R16 |
| 28 | P0 | Segurança | REVOKE EXECUTE em SECURITY DEFINER backend-only + drop tabelas backup sem RLS | R17 |
| 29 | P1 | i18n | Dialogs: AddExerciseDialog, PaywallDialog, ShareAppButton, OneRepMaxCalculator, FeedbackPanel | R18 |
| 30 | P1 | i18n | Painéis cliente: ImportLogDialog, IntakeLinkPanel, PlanAssessmentSheet, MovementPatternCard | R19 |
| 31 | P1 | i18n | LogbookTimeline + datas com locale dinâmico (clients route, FeedbackPanel) | R20 |
| 36 | P1 | i18n | Sweep dashboard + clients (atenção/aniversários, plans-status-bar, EvolutionChip, dialogs convite) | R21 |
| 37 | P1 | Motor | Trigger sync subscription_tier → profiles.plan_quota_limit (Starter 8 / Pro 30 / Studio 80) + backfill | R23 |
| 38 | P2 | Plan page | Export PDF do bloco com secção "Block N · Evolution vs Block N-1" (computeCapacityGain + transition note) | R24 |
| 39 | P1 | i18n | billing.tsx + plans.$planId headers/toasts (FAQ, tiers, top-up, footer) | R22 |

## Em aberto

| # | P | Área | Item | Notas |
|---|---|---|---|---|
| 32 | P1 | i18n | Sweep restante em src/routes (clients_.$clientId 1.5k linhas — assessment subsections) | ~30 literals em painéis profundos |
| 33 | P2 | UX | Smoke test manual de cada rota em PT e EN antes de publicar | checklist em PR |

## Princípio
Útil > funcional > bonito > divertido. Cada ronda corta o que não passa todos os 4.

## Meta-prompt sugerido
> "Continua o backlog. Foco P0 desta ronda: **[área]**. Resultado esperado: **[1 frase]**. Princípio: útil, funcional, bonito, divertido — sem inventar features fora do backlog. Atualiza .lovable/backlog.md no fim."
