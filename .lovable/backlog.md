# Forge — Backlog vivo

Atualizado: Round 28 (4 Mai 2026)

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
| 32 | P1 | i18n | Sweep clients_.$clientId profundo (StageCards, Synthesis, AssessmentSection, Snapshot) | R25 |
| 33 | P2 | UX | Smoke test checklist PT/EN versionado em .lovable/smoke-test.md | R26 |
| 51 | P0 | Conhecimento | ACSM 12e ingestion + gap report (8 ch · 22 sec · 59 rec · 79 contra · 167 norm · 37 pop) → `.lovable/acsm-12e-gap-report.md` | R27 |

## Em aberto

| 40 | P0 | Schedule | My Schedule v1: timetable semanal + revenue panel + packs (R28) | R28 ✅ |
| 41 | P2 | Schedule | Modo "individual" como trainer-of-self (auth/role discussion + intake mínimo) | futuro |
| 42 | P2 | Schedule | Recurring booking rules ("toda 3ª/5ª 7h por 10 semanas") | futuro |
| 43 | P2 | Schedule | Sync Google/Apple Calendar (one-way export ICS para começar) | futuro |
| 44 | P2 | Schedule | Cobrança/faturação ligada a packs (Stripe link por pack) | futuro |

### Roadmap conhecimento (ACSM + Bompa + NSCA)

| # | P | Round | Item | Status |
|---|---|---|---|---|
| 45 | P0 | R2 | FITT-VP backbone + citations: `workout_plans.prescription_parameters` estruturado, teste submax VO₂ (Rockport / 1.5-mi / Ebbeling), checklist dos 9 sinais/sintomas cardinais no intake. Auto-adopt dos 17 thresholds da gap report §E (todos mais conservadores — zero decisões bloqueantes). | next |
| 46 | P1 | R2.5 | Bompa & Buzzichelli 6e ingestion — camada de periodização sobre o FITT-VP. **Modelo B aprovado**: tabelas source-agnostic `periodization_phases` / `_sequences` / `_microcycle_patterns` com `source` + `citation`. | planned |
| 47 | P1 | R3 | Special-population overlays — ~18 populações que caem silenciosamente (gap report §D): pediátrico, gravidez, idosos/frailty, LBP, HTA, T1D, T2D, dislipidemia, obesidade, MASLD, asma, DPOC, AVC, Parkinson, MS, depressão, sobreviventes de cancro, osteoporose. Inclui novos do 12e (POTS, ME/CFS, SCAD, transgénero). | planned |
| 48 | P2 | R3.5 vs R2.7 | NSCA Essentials 3e ingestion — camada de exercise selection / cuing / técnica / programming aplicado. **Pergunta em aberto**: Hipótese A = Round 3.5 (após overlays, plug substituições por cima); Hipótese B = Round 2.7 (antes dos overlays, para overlays poderem citar exercícios específicos). Preferência A. Decidir quando lá chegarmos. | parked |
| 49 | P2 | R4 | Behaviour-change scaffolding — ACSM Cap. 12 (transtheoretical, motivational interviewing hooks, goal-setting templates). | parked |
| 50 | P2 | Future | McGill — Ultimate Back Fitness and Performance (2014). Overlay LBP especializado; depende de a infraestrutura de overlays do Round 3 já existir. | parked |
| 51 | P3 | Future | Linter housekeeping — mover extension(s) fora do schema `public` (Supabase linter `Extension in Public`). Pré-existente, não bloqueia features. | parked |

**Cross-source policy** — Bompa 6e + NSCA 3e + ACSM 12e partilham overlap genuíno (variáveis de treino, populações, assessment). Modelo B (tabelas source-agnostic com `source` discriminator) estende-se às três fontes — superficializa concordância (sinal forte) vs discordância (resolver manualmente). Fontes parqueadas: `.lovable/acsm-12e-source.txt`, `.lovable/bompa-buzzichelli-6e-source.txt`, `.lovable/nsca-essentials-3e-source.txt`.

## Princípio
Útil > funcional > bonito > divertido. Cada ronda corta o que não passa todos os 4.

## Meta-prompt sugerido
> "Continua o backlog. Foco P0 desta ronda: **[área]**. Resultado esperado: **[1 frase]**. Princípio: útil, funcional, bonito, divertido — sem inventar features fora do backlog. Atualiza .lovable/backlog.md no fim."

## Closed this round
## Closed Round 28
- Merged /clients into /dashboard (single home for clients + invite dialog + filters)
- Deleted src/routes/clients.tsx and src/components/DemoClientBanner.tsx
- Removed "Clientes" + "Users" import from AppShell nav (5-item nav)
- Tour: dropped step_banner + step_lab; demo-lab anchor no longer required
- Plan engine FROZEN this round (no edits to plans/intake-ai/quota/prompts)
- SMART suggestion chips on intake (color-coded body/perf/clin/life + 1m/3m/6m/1y deadline shortcuts)
- "Ver como cliente" preview: /me?as={clientId} for trainers, amber preview banner
- Manual client creation: createManualClient server fn + tabbed dialog (invite | manual)

## Deferred (honest scoping)
- Movement spider chart peer overlay — needs ACSM normatives wired through movement-screen surface, not the volume radar. Real round of work, not a quick add.
- Knowledge roadmap (FITT-VP / Bompa / NSCA) — each is a multi-week round; do not box-tick.
- Steps widget, metabolism panel, e1RM trends, client messages — touch the engine/client surface; resume after engine unfreeze.
- Demo Lab UI — intentionally hidden last round; do not resurrect without a new decision.
