# Protocol — Backlog vivo

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

### Round 54 — Plan-view feedback (4 Mai 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 60 | P0 | Plan page | PR confetti idempotente: `workout_sessions.pr_celebrated_at` + `markSessionsCelebrated` server fn + LS fallback | R54 ✅ |
| 61 | P1 | Plan page | Mesocycle table: linha azul "realizado" debaixo de cada prescrição (`useSessionActuals` overlay) | R55 next |
| 62 | P1 | Plan page | Header colapsado: 2 linhas sticky (← All plans · Nome cliente · Block · Ready · ⋯) + Resumo do bloco em `<details>` (banner validação dentro) | R55 next |
| 63 | P1 | Plan page | Nome do cliente sempre visível: `flex-1 min-w-0` + overflow menu p/ os 8 botões | R55 next (#62) |
| 64 | P1 | Theme | Light-mode contraste tokens (`status-tone.ts` light variants emerald-50/700, amber-50/700, red-50/700) | R54 ✅ |
| 65 | P2 | Plan page | Avaliar deteção de PR para bodyweight/hold (sem e1RM) — baseline marcado no Block 1 | parked |

**Nota:** #61/#62/#63 ficam para o turno seguinte porque o RPE periodization (Round 53 P0) muda a shape das células do MesocycleTableView — quero o overlay azul sobre a versão final para evitar refazer.

**Cross-source policy** — Bompa 6e + NSCA 3e + ACSM 12e partilham overlap genuíno (variáveis de treino, populações, assessment). Modelo B (tabelas source-agnostic com `source` discriminator) estende-se às três fontes — superficializa concordância (sinal forte) vs discordância (resolver manualmente). Fontes parqueadas: `.lovable/acsm-12e-source.txt`, `.lovable/bompa-buzzichelli-6e-source.txt`, `.lovable/nsca-essentials-3e-source.txt`.

## Princípio
Útil > funcional > bonito > divertido. Cada ronda corta o que não passa todos os 4.

### Round 64 — PDF day naming + Intensity Cockpit (5 Mai 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 70 | P0 | PDF | Labels "Sessão N · Foco" (PT) / "Session N · Focus" (EN); foco inferido por movement pattern quando o AI manda "Week 1" junk | R64 ✅ |
| 71 | P0 | Motor | `buildWavePlan(tier, weeks, {model, deloadEveryN})` — 3 modos (linear, undulating, block) + injecção de deload por knob | R64 ✅ |
| 72 | P0 | Schemas | `wave_model`, `autoreg_strictness`, `cockpit_preset` em ProgrammingVariables com Zod defaults | R64 ✅ |
| 73 | P0 | UI | `<IntensityCockpit/>` (5 knobs + 6 presets) montado no BriefEditor; remove fields duplicados na "Configuração de programação" | R64 ✅ |
| 74 | P0 | Motor | Stage 4 lê `programming_variables.wave_model` + `deload_frequency` e persiste `generation_meta.cockpit` | R64 ✅ |
| 75 | P1 | Plan page | Mount cockpit também em `/plans/$id` modo edit (sticky no topo do Stage 4 panel) | R65 next |
| 76 | P1 | Motor | `programNextWeek(planId)` — autoreg_strictness corta carga 5% se RPE realizado > prescrito + 0.7 (apenas em modo strict) | R65 ✅ |
| 77 | P2 | Motor | Modo `conjugate` (Westside) — exige tagging max-effort/dynamic-effort em Stage 3 | parked |
| 78 | P2 | Analytics | Dashboard de adesão por preset (hypertrophy_classic vs strength_base etc.) | parked |
| 79 | P1 | i18n | EN strings para Cockpit + presets (hoje hardcoded em PT) | R65 ✅ |
| 80 | P1 | Plan page | Botão "Programar próxima semana" no header — chama programNextWeek e mostra adherence + flagged count | R66 next |
| 81 | P1 | UX | Surface programNextWeek error "low_adherence" com CTA para abrir logbook da semana actual | R66 |

### Round 66/67 — Plan-page wiring (5 Mai 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 80 | P1 | Plan page | `<NextWeekCard/>` no header (programNextWeek + adherence guard) | R66 ✅ |
| 81 | P1 | UX | Erro "low_adherence" mostrado inline na própria card (sem toast) | R66 ✅ |
| 75 | P1 | Plan page | `<IntensityCockpit/>` montado no `/plans/$id` modo edit, persist directo em `programming_variables` | R67 ✅ |

### Round 73 — NextActionCard compact + assessment-first (9 Mai 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 96 | P0 | Dashboard | NextActionCard sempre presente, layout compacto (strip ~56px, sem glow), nunca null | R73 ✅ |
| 97 | P0 | Dashboard | Prioridade respeita pipeline: rever submetida → completar incompleta → gerar quando 100% → aniversário → empty | R73 ✅ |
| 98 | P0 | Princípios | mem://principles/next-action-priority.md trava regressão (nunca gerar plano com avaliação <100%) | R73 ✅ |

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

## Closed Round 29 (Stage 2 unblock + founder telemetry)
- Stage 2 Blueprint default model switched from `openai/gpt-5-mini` (failing tool-call contract → "Schema validation failed after retry") to `google/gemini-3-flash-preview` (same Lovable Gateway default Stage 1 uses reliably). Override via `FORGE_MODEL_STAGE_2` still respected.
- Deterministic Blueprint fallback: `buildDeterministicBlueprint(brief, weeks, guidelines)` builds a valid skeleton from primary_goal + tier session window when the AI fails. Stored as the plan's blueprint with `generation_meta.blueprint_source = "deterministic_fallback"` and logged as `stage2:blueprint:fallback` in `generation_log`. Trainer is no longer dead-ended.
- Toast surfaces fallback honestly ("fallback determinístico — IA falhou, edite à vontade") when used.
- Founder-only `<FounderAiTelemetryPanel/>` mounted above the StageCard stack on `/clients/$clientId`. Toggles between this-plan and last-7d-account views, reads `generation_log` via two new authenticated server fns (`getPlanGenerationTelemetry`, `getTrainerGenerationTelemetry`). Gated to `aafonsodias@gmail.com`.
- Fixed missing i18n key `assessment:generate.brief_coverage` (PT + EN). Console warning gone.

## Closed Round 30 (Inline stage flow + microcycle hotfix)
- Stage 3 hotfix: `archetypeForDay()` is now null-safe — falls back to round-robin over `session_archetypes`, then to a synthetic `full_body` archetype, so Day 1 never errors with "No archetype for day 1" again.
- `/plans/$planId/microcycle` now batch-generates the full week (`generateMicrocycleDays`) on first open instead of just Day 1, so the trainer sees the whole microcycle to review.
- Brief approval auto-flow: approving the brief on `/clients/$id` collapses the Stage 1 card AND the assessment synthesis (folds into a green "✓ Avaliação completa" pill) and auto-expands Stage 2 (Blueprint) — same pattern Blueprint already had.
- Memory rule saved: `mem://principles/inline-stage-flow.md`.

## Open after Round 30 (P0 next)
- Microcycle workbench inline on `/clients/$id` (5-lane day tabs, color-coded sections, drag/superset, AI comment-on-edit) — designed in `.lovable/plan.md` Round 30 §3 but deferred from this round to keep the hotfix isolated.
- Searchable warmup/activation/stretch picker (extends `AddExerciseDialog` with `section` filter).
- `useStageAutoFlow()` helper to centralize the collapse/expand pattern across all 5 stages.
- Backlog parked items unchanged: FITT-VP backbone (R2), Bompa overlay (R2.5), special-population overlays (R3), NSCA (R3.5), behaviour change (R4), McGill (Future), schedule polish (Schedule v2+).

## Deferred (honest scoping)
- Movement spider chart peer overlay — needs ACSM normatives wired through movement-screen surface, not the volume radar. Real round of work, not a quick add.
- Knowledge roadmap (FITT-VP / Bompa / NSCA) — each is a multi-week round; do not box-tick.
- Steps widget, metabolism panel, e1RM trends, client messages — touch the engine/client surface; resume after engine unfreeze.
- Demo Lab UI — intentionally hidden last round; do not resurrect without a new decision.

## Closed Round 31
- BrandMark: optical center fix (-1px nudge) — spark now visually centered in glow ring
- Dashboard: replaced ⚒ emoji plate with <BrandMark size="sm"/>; title → "Protocol · AI Workbench" (PT+EN)
- index.tsx: gate landing render on authLoading (BrandMark splash) — refresh inside app no longer flashes marketing page
- IntakeLinkPanel: realtime subscription on clients row + auto-collapse to "Aberto" chip when intake_status=opened
- clients route: brief approval honesty — "Avaliação completa" only when coverage ≥80%, else amber "Avaliação parcial · X%" chip kept open
- Microcycle: per-day skeleton lanes (amber Loader2 cards) shown immediately while generating, replacing single opaque spinner

## Open Round 32
- P0 Documents: collapse ClientDocuments into a single clinical-teal icon button (cross/stethoscope) in client header action row, opens right Sheet drawer
- P0 Microcycle inline: extract MicrocyclePanel from /plans/$id/microcycle route, render as Stage 3 expandedBody on /clients/$id; keep route as thin back-compat shell
- P1 Microcycle engine: switch generateMicrocycleDays to fire-and-forget (return after pending insert; background Promise.all writes via realtime); add 90s soft-timeout per day with single retry
- P1 Wearables: client dashboard fields for sleep / RHR / steps / HRV; surface in trainer view as continuous signals (separate from intake)
- P2 IntakeLinkPanel hide-by-default once intake_status='reviewed' or 'submitted'; surface as "Pedir nova avaliação" trigger

## Round 32 (done)
- P0: Stage 3 microcycle inlined on /clients/$id via MicrocyclePanel; no more nav away
- P0: Microcycle generation switched to gemini-2.5-flash, concurrency 7, FITT-VP retry only on block N≥2
- P0: Server-side log line in generateMicrocycleDays for observability
- P1: Documents collapsed to clinical-teal stethoscope icon + Sheet
- P0: Intake link panel now hides once assessed; available via Send-icon Sheet in header

## Round 33 (next)
- P1: drag-to-reorder days + supersets in MicrocyclePanel
- P1: per-exercise inline AI comments on edit
- P1: searchable warmup catalog
- P2: Stage 4 Progressions inlined too (currently still navigates)

## Closed Round 33
- P0: Assessment collapse only hides the questionnaire — green "Avaliação completa · X%" pill + Brief/Blueprint/Microcycle/Progressions stages stay visible (synthesisOpen state, stages lane lifted out of AssessmentSection)
- P0: Plans-list rows for phased drafts open inline via openPhasedDraft(planId, stage) — no more standalone /plans/$planId/<stage> windows
- P1: StageCard tone="brief" keeps amber for the source-of-truth Brief; other approved stages (blueprint/microcycle/progressions) collapse to emerald strips matching the post-assessment chip — clear visual progression amber → emerald
- P0: /plans/$planId/{brief,blueprint,microcycle,progressions} routes converted to redirect shells → /clients/$clientId

## Round 34 (next)
- P0: FITT-VP backbone (#45) — workout_plans.prescription_parameters, submax VO₂ test, 9 cardinal sign/symptom checklist
- P1: drag-to-reorder days + supersets in MicrocyclePanel
- P1: per-exercise inline AI comments on edit
- P1: searchable warmup catalog
- P2: Stage 4 Progressions fully inlined too (the Open button on approved still navigateToStage — convert to inline expansion like microcycle)

## Closed Round 36
- P0: Per-day approval lock — `workout_plan_days.approved_at` column, `approveDay`/`unlockDay` server fns, MicrocyclePanel surfaces an amber "Approve day N" CTA per active day; once approved, regenerate goes through an explicit Unlock confirm. Auto-collapse Stage 3 now waits for ALL days to be approved (not just AI-done), removing the silent jump that lost edits.
- P0: Day tabs distinguish "AI done · awaiting review" (neutral, "review" tag) from "approved" (golden ✓). Header reads `N/M dias aprovados (X a rever)`.
- P1: Assessment richness travels with plan — `workout_plans.assessment_completion_pct` column populated by `approveBrief({ assessmentCompletionPct })`. Surfaced as `· dados 86%` on plans-list rows. PDF richness footer parked for next round (needs pdf.ts cover-section refactor).
- P1: Stage labels via i18n — `plan:stage.label.{1..5}` keys (PT + EN) replace hardcoded titles in clients route + MicrocyclePanel header. EN no longer leaks "Plano-mestre".

## Round 36 deferred (next)
- P0: Stage 5 (Progressions) inlined — needs new ProgressionsPanel component (no existing UI to extract; the route has always been a redirect shell). Out of this round to keep risk low.
- P1: WeekMatrix desktop view (D from R35 plan)
- P1: VerifiedBadge (F from R35 plan)
- P1: PDF richness footer (uses `assessment_completion_pct` already persisted)

## Closed Round 38 (finish-line polish)
- Dashboard: removed Recent plans + Plans by status (focus = clients/alerts).
- Stage 4: approved-day shows quiet emerald chip + small Unlock link instead of amber CTA.
- Stage 5: inlined ProgressionsPanel with how-to-edit guide; approveProgressions now triggers bulkFillRemainingWeeks so weeks 2–N are real.
- Plano final: direct PDF download via downloadPlanById (no nav to /plans/$id).
- Duration mismatch: phased draft now stores duration_weeks from assessment.
- ClientAvatar: verified prop + amber BadgeCheck overlay.
- AppShell: BadgeCheck added next to Founder pill (visible verified marker).
- i18n: "Gerar Microcycle/Progressions" → PT-correct strings; "Stage:" → "Etapa:".

## Closed Round 39 (weekly PDF + finish R38)
- PDF: weekly mode (`PdfMeta.week_number`). Renders one cover (with macro index strip + "Esta semana" session list + honest BLOCK/WEEK/SESSIONS KPIs) + one page per session. Walked back full-block export — PTs print weekly and update on weekends.
- PDF: macro index strip = N chips (W1..WN) with current highlighted + 1-word tag (base/+load/+reps/deload).
- PDF: exercise name column widened to 220pt + wraps to 2 lines (no more "Reverse Hyperextension Bodywei…" clipping).
- PDF: footer per page now reads `Protocol · {client} · Bloco N · Semana W · email`.
- Plano final UI: per-week selector + "Descarregar Semana" button replaces single "Descarregar PDF".
- AppShell: founder pill now also carries the verified BadgeCheck (visible marker requested).
- i18n cleanup: removed mixed PT/EN ("Gerar Microcycle/Progressions", "Stage:").

## Open after Round 39
- WeekMatrix desktop view (carry-over).
- Adaptive repeat assessments — first = rich baseline, subsequent = small contextual re-checks; question/measurement set adapts to goal/context (glutes for women prioritising glutes, biceps for men prioritising arms, etc.). Parked, real round of work.
- Backend-stored "verified" flag (currently founder-only via email gate). Real cert/verification pipeline is out of scope.

## Closed Round 40 (PDF richness footer + small polish)
- PDF cover: assessment richness chip (`AVALIAÇÃO {pct}% · gerado {date}`), tonal stripe (≥80 emerald, ≥60 amber, else muted). Wired through `download-plan.ts`.
- PDF cover: honest amber banner "Mostrando Semana 1 — semanas seguintes ainda não geradas" when the trainer asks for a later week but only W1 exists. No silent empty PDFs.
- Plano final row: per-week select now defaults to latest week with any `approved_at` day (small `planLatestWeek` lookup populated on mount).
- Backlog re-parked: WeekMatrix desktop, adaptive repeat assessments, backend verified pipeline — each is a real round, not a polish item.

## Open after Round 40 (parked — real rounds)
- WeekMatrix desktop view: full grid surface + interaction model. Needs design pass, not a small edit.
- Adaptive repeat assessments: schema for assessment versions + context-aware question sets (gender/goal-driven).
- Real verified/cert backend: today is just the founder email gate. Needs cert source-of-truth + UI to prove/verify.

## Closed Round 41 (client page recomposition — pass 1)
- Founder dot: amber Sparkles overlay on `<ClientAvatarUpload/>` (only on aafonsodias@gmail.com clients) — visible "verified" marker on the avatar itself, not just the header pill.
- Identity chip strip: folded "Última avaliação · DD/MM/AAAA →" into a single `AVALIAÇÃO {pct}% · DD/MM` chip with tonal colour (≥80 emerald / ≥60 amber / else red). Click scrolls to synthesis. ACSM + Recovery chips kept, same height/shape.
- Pipeline collapse: when Plano-mestre + Semana-tipo + Progressão are all approved, the three StageCards fold into a single emerald `<PipelineStrip/>` ("Pipeline · Bloco N completo · {date}") with click-to-expand-inline. Stage 2 (Briefing) stays open for tweaks.

## Closed Round 42 (client page recomposition — hero card)
- Shared macro-index helper: extracted `weekTagFor(weekNumber, totalWeeks)` to `src/lib/macro-index.ts`. PDF (`src/lib/pdf.ts`) now uses it — single source of truth for base/+load/+reps/deload tagging.
- New `<MacroIndexStrip/>` component mirrors the PDF cover strip in the DOM (chips W1..WN, current highlighted, click-to-select). Trainers see the same visual language on paper and on screen.
- New `<ThisWeekHero/>` focal-point card replaces the flat "Plano final" row: amber-glow background, plan title, Bloco/Semana/tag headline, full macro index strip, primary "Descarregar Semana N" CTA + secondary "Abrir plano" link. Onboarding variant (no complete plan) renders a calm "Sem plano ativo" card with manual + IA generation buttons.
- Plano final section demoted to "Histórico de planos" (uppercase muted heading) and only matters now when the trainer has multiple plans / drafts to manage.

## Open after Round 42 (parked — real rounds, unchanged)
- WeekMatrix desktop view.
- Adaptive repeat assessments.
- Real verified/cert backend pipeline.

## Closed Round 46
- Mission schema migration (missions table + assessment_completion column on clients) + RLS
- src/lib/missions.ts helper with weights + computeAssessmentCompletion
- Tri-mode theme: Dark · Slate · Cream — ThemeToggle 120° rotation, .slate class added to styles.css
- Brand mark refactored to inline SVG (currentColor) — auto-adapts to all 3 themes, deleted protocol-mark.png
- AtlasGenie animation upgraded: emerge from below + amber halo, prefers-reduced-motion respected
- Dashboard last-intake button: 2-line label "Último link de intake gerado / para {nome}"
- IntakeLinkPanel terminology: "Copiar link de intake" + tooltip
- Workbench title personalised: "O teu Workbench" / "Your Workbench"
- AtlasGenie pill moved into hero (next to + Novo cliente), removed solo row
- Protocol cleanup: deleted forge-logo.png, renamed STORAGE_KEY → protocol_theme, model key → protocol.ai.model

## Parked for R47+
- Missions UI rico (panel, Atlas-pointing, confetti on completion)
- Atlas pointing/Joyride choreography (full helper with auto-scroll + blink)
- Marketing AI avatars (diverse models para vídeos) — needs ethical-use guidelines first
- Google Earth gym/farmácia locator
- Reviews/Reddit/Portal da Queixa scrape agent

## Closed Round 49 (compact shell + protocol rail)
- AppShell: icon-only nav < 2xl, secondary controls (locale/theme/billing/sign-out) collapsed into avatar DropdownMenu — header no longer truncates at 1280–1544px.
- BrandMark behaviour: wordmark only ≥2xl, P-mark always visible.
- New <ProtocolRail/>: permanent 5-stage spine on /clients/$id (Avaliação→Briefing→Plano-mestre→Semana-tipo→Progressão), emerald check when done, amber "Reavaliação · em Nd" / "Nd em atraso" chip when last assessment + 14d is approaching/past.
- StageCard: added `done` (emerald) status + `rightSlot` for inline supplemental info.

## Closed Round 50 (nutrition cue + backlog grooming)
- New `src/lib/nutrition-suggestions.ts` (PT/EN, no AI, no DB) — three windows: big meal 3–4h, pre 30–60min, post 0–2h, each with 3 example foods + rationale.
- New <NextMealCue/> rendered under <ThisWeekHero/> on /clients/$id — collapsed by default, click expands 3-column grid.
- Stage 1 re-assessment cadence: **chip-only** (ProtocolRail amber "Reavaliação" chip) — no editor surface, no migration. Schema (`client_measurement_prefs.periodic_interval_days` + `client_measurements`) is ready when we promote the editor.

## Open after Round 50 (P0/P1 next)
- P1 **PR snapshot share**: dedicated card the trainer can screenshot to send via WhatsApp (e1RM Δ, lift name, date, brand mark). First-workout PR is noisy → gate to PRs after week 2 OR an explicit "share" button.
- P1 **Logbook session replay**: linear timeline of completed sessions inside /clients/$id with set-by-set view + emoji RPE strip.
- P1 Email reminders (Resend): 24h-before-session + 2h-before-session opt-in per client. Pure server fn + cron.
- P2 Multi-modality framework (vision only): hooks for cardio/mobility/breathwork tracks alongside resistance.
- P3 (parked, no work): leaderboards, longevity dashboard, meditation/nutrition tracking modules.

## Closed Round 51 (re-assessment editor)
- New `<ReassessmentSheet/>` (`src/components/ReassessmentSheet.tsx`) — right Sheet with 4 grouped sections: Cardio (VO₂máx, FC repouso), Força · resistência (dead-hang, active-hang, plank, box squats), TA (sistólica/diastólica + 5-min rest protocol copy), Circunferências (cintura/anca/peito/braço/coxa/gémeo).
- Writes one `client_measurements` row (cadence='periodic') via existing `recordMeasurement` server fn — zero migration, all fields live inside `values` jsonb.
- `ProtocolRail` "Reavaliação" chip is now a button (always shown when stage 1 ≥80%) with `onReassessClick`; opens the sheet on click.

## Closed Round 52 (client page UX overhaul)
- **Header simplified**: 7 toolbar buttons → 1 (`Mais ações ▾`) + the date picker + ClientDocuments chip. PDF, "Ver como cliente", "Pedir nova avaliação" moved into the dropdown.
- **ThisWeekHero now owns the single primary action**: contextual CTA changes by client lifecycle state (Pedir avaliação → Iniciar briefing IA → Aprovar plano-mestre → Aprovar semana-tipo → Aprovar progressão → Abrir treino de hoje). Hero card promoted (heavier border, amber glow shadow, 11px CTA height).
- **StageCard prefix change**: removed "Stage N — " text; numbers now appear as small badges. Reduces three-vocabulary overlap (Avaliação/Briefing… vs Stage N vs Bloco N).
- **ComplianceDashboard upgrade**: KPIs show Δ% vs the immediately-prior window (computed client-side, no schema change). "Adherence — No plan baseline" replaced by "Consistência" when no planned baseline exists. Adesão KPI now carries inline verdict ("no alvo / abaixo do alvo / muito abaixo"). Top exercises split into "Por carga (kg)" (only weighed) and "Por volume (séries)" — bodyweight no longer mis-compared in kg. Sparkline gained a 3-week moving-average trend line (SVG, no libs).

## Open after Round 52 (P0/P1 next)
- P1 **Compliance qualitative tags + goal-aware verdicts** (e.g. "volume adequado para fase base"). Needs a per-client objective model first.
- P1 **Compliance grouped layout**: "Consistência / Carga / Distribuição" with 1-2 well-interpreted KPIs each instead of 4-grid of telemetry.
- P2 Goals model (per-client primary objective: força / hipertrofia / saúde / performance) feeding both Hero CTA copy and Compliance verdicts.

## Open after Round 53 (P1)
- P1 **Public "Train with me" join link** — single, shareable URL (e.g. `/join/{trainerSlug}`) that anyone can open, see a short pitch (in-person or online), and submit a lead form (name + email + goals + modality). Creates a draft client in `pending` status; trainer accepts/declines from dashboard. Replaces the dropped per-client "copy intake link" shortcut. Needs: public route, Zod-validated server fn + rate limit, basic anti-spam, RLS-friendly `pending` client state, dashboard "Pending requests" inbox.

## Closed Round 54 (player card cockpit)
- `ClientPlayerCard` row no longer navigates — it expands in place into a `ClientCockpit` showing ACSM/Recovery chips, ProtocolRail (read-only), plan title + block/week + PDF, and the existing ComplianceDashboard. Cockpit fetches its own assessment + generation_state on first expand so the dashboard list stays cheap.
- Detail route `/clients/$clientId` remains the editor/builder. Cockpit links there via "Abrir editor" and to `/clients/$clientId/year` via "Logbook".

## Open after Round 54 (P1)
- P1 **Trim detail-route header** — the header strip on `/clients/$clientId` (avatar plate + ACSM/Recovery chips + ProtocolRail + ThisWeekHero) now duplicates the cockpit. Demote it to a thin "Voltar à lista" + name + phase pill bar so the route reads as a pure builder. Risk-controlled because the route is ~4.2k lines; do it in its own focused round.

## Open after Round 55 (landing tightening)
- P1 **Field/gym assessment expansion** — VO₂máx submaximal estimate, sit-and-reach, behind-the-back scratch, TUG (Timed Up & Go for 60+), single-leg balance progressions, dead/active hang. Decide which to surface as input vs which to derive. Insights cards on landing already promise sleep, energy, VO₂máx, hang — wire them to real data.
- P1 **Pre/post-session subjective log** — energy, sleep, stress, soreness BEFORE; mood, RPE, perceived benefit AFTER. Mandatory at the top of each workout day in the logbook. Feeds all "energy/recovery" insights cards.
- P2 **Client photo privacy** — auto-detect face, crop above the ear OR apply blur (user choice). Show pose template (heel-to-hair, front/side/back, swimwear). Spell out benefits: postural read, muscle harmony, progress comparison, joint feedback for us. Update FAQ q4 once shipped.
- P2 **Warmup library + agility/cognitive double-task module** — CARs (neck/scapular/shoulder/T-spine/hip), dynamic stretches (cossack, 90/90, spiderman, world's greatest), banded activation (monster walks, side-walks, pull-aparts, Y-W-T-L, snowflakes), agility-ladder drills with built-in timer + word-count beep for cognitive double-tasking. Replaces "treadmill warmup" defaults.
- P2 **Multi-perspective surfaces** — 4 explicit viewer modes already promised in FAQ q12: Solo trainee, Long-distance client, PT-of-record, Client-of-PT. Currently the app leans PT-first; need view toggles + tailored CTAs.
- P2 **Reference verifiability** — every AI-generated rationale shows the manual page/PubMed link it draws from. No author cited without source inside.

## Audit 2026-05 — open items
- [x] P0: Hero mockup invisible (HeroVisualRotator collapsed to 0px) — fixed
- [x] P1: Headline rotator min-h bumped (200/290) to prevent layout jump PT↔EN
- [x] P0: Hero rotator empty space inside amber ring — active slide drives height (R-curr)
- [x] P2: `/welcome` already gated by `account_type` (skip redirect if set) — no work needed
- [x] P2: DashboardHint already persists via `forge.hint.dashboard.dismissed` — no work needed
- [x] P2: ThisWeekHero is not on dashboard.tsx (lives only on /clients/$id) — non-issue
- [x] UX: Mock clients on landing CoachWorkbench renamed to classic universal names (Maria Silva, João Costa, Marie Dubois, Antonio Rossi, Anna Schmidt)
- [ ] P1: Fusion B — `/templates` → `/plans?tab=templates` (own round)
- [ ] P1: Fusion C — `/schedule/packs` → `/schedule?tab=packs` (own round)
- [ ] P2: Fusion A — `/me` → `/settings?as=…` (gentle, low value alone)


## Closed Round 56 (insights wired to real data)
- Mock clients on landing CoachWorkbench renamed to most-populous-country classics: Maria Silva (BR), John Smith (US), Priya Sharma (IN), Wei Chen (CN), Chioma Okafor (NG).
- New `<RealInsightsCard/>` (`src/components/RealInsightsCard.tsx`) — reads last 60 periodic `client_measurements`, picks 2 latest values per metric, computes Δ + window in days, renders a chip per metric (VO₂máx, dead_hang_s, active_hang_s, plank_s). Empty state offers explicit "Abrir reavaliação" CTA — no fake numbers.
- Mounted on `/clients/$clientId` above the Compliance details. Uses existing `setReassessOpen` to open `<ReassessmentSheet/>`. Zero migration, zero new server fn — reuses `listMeasurements` + the periodic fields the sheet already writes.
- i18n PT+EN added under `plan:insights.*` (loading, header, cta_record, empty_*, no_data, delta_window, first_measurement, disclaimer, metric.{vo2max,dead_hang_s,active_hang_s,plank_s}).
- Closes the gap between the landing's "Insights da IA" promise and what the app actually surfaces. App now delivers the same 4 metrics it advertises.

### Round 58 — Coach Cockpit (5 Mai 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 70 | P0 | Dashboard | CoachCockpit: hero (semana · sessões · €) + mini-week timetable + nudges (aniversários + pack ending) | R58 ✅ |
| 71 | P0 | Dashboard | MessageComposerSheet — templates PT/EN editáveis (birthday/christmas/reengage/pack_ending/new_client) + WhatsApp deeplink + copiar | R58 ✅ |
| 72 | P1 | Roles | Trainee /me cockpit (logbook + mesocycle + previsão Bloco N+1) | R59 next |
| 73 | P2 | AI | "Reescrever com IA" no MessageComposerSheet (tom + comprimento) | R59 |
| 74 | P2 | Schedule | ICS export one-way para Google/Apple Calendar | parked |

### Round 59 — Less surface (5 Mai 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 75 | P1 | Landing | Fundir Anti-ChatGPT + ForWhom em WhoAndWhySection (−1 secção, ~−400px scroll) | R59 ✅ |
| 76 | P1 | Routes | Fusão `/templates` → `/plans?tab=templates` (Tabs + redirect) | R60 next |
| 77 | P1 | Routes | Fusão `/schedule/packs` → `/schedule?tab=packs` | R60 next |
| 78 | P1 | Trainee | `/me` cockpit (hero + mini-mesocycle + NextBlock + recent logs) com useUserMode | R60 |
| 79 | P1 | Client | Trim header `/clients/$id` (4206-line file) — chips clínicos em <details> | R60 |

### Round 60 — Route fusion (5 Mai 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 76 | P1 | Routes | `/templates` → `/plans?tab=templates` (Tabs + redirect, AppShell entry now "Plans") | ✅ |
| 77 | P1 | Routes | `/schedule/packs` → `/schedule?tab=packs` (Tabs + redirect, RevenuePanel/manage_packs link migrated) | ✅ |
| 78 | P1 | Trainee | `/me` cockpit (hero + mini-mesocycle + NextBlock) | R61 |
| 79 | P1 | Client | Trim header `/clients/$id` (4206 LOC, chips em <details>) | R61 |

### Round 60.1 — Mobile hygiene (5 Mai 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 80 | P0 | Schedule | Remover botão "Manage packs" duplicado (Tabs já o expõe) | ✅ |
| 81 | P0 | Schedule | Header colapsado (1 linha) + tirar AppShell back + remover subtitle | ✅ |
| 82 | P0 | Schedule | DayStrip: `grid-cols-7` em vez de `flex overflow-x-auto` (mata scrollbar feia em mobile) | ✅ |
| 83 | P1 | Schedule | KPIs colapsam em 1 linha quando semana = 0 sessões/0€ | ✅ |
| 84 | P1 | Trainee | `/me` cockpit (hero + mini-mesocycle + NextBlock) | R61 |
| 85 | P1 | Client | Trim header `/clients/$id` em <details> | R61 |

## Round 61 — PT-only repositioning + ES/HI scaffold
- ✅ Hero reescrito: "Planos cientificamente válidos em 90s — com o teu nome", 3 bullets, chip "Beta privado · vagas limitadas esta semana"
- ✅ WhoAndWhySection escondida (PT-only), HeroVisualRotator → 1 slide (HeroPlanMockup), HeroHeadlineRotator → 1 variant
- ✅ Logbook section encolhida (1 mockup), FAQ 10 → 5 perguntas (q1, q2, q9, q13, q14)
- ✅ ES + HI: 4 ficheiros traduzidos via Lovable AI (plan + common); resto cai em fallback EN
- ✅ LanguageSwitcher: ES (Español) + HI (हिन्दी) adicionados

## Round 62 — pendente (do feedback do utilizador)
- P0 Onboarding: modo "rápido" (5 inputs → plano em 60-90s) + upgrade para completo
- P1 Pricing: toggle anual (-17%) + reforço do tier Studio
- P1 Conteúdo: storyboards de 5 vídeos curtos (TikTok/Reels) — "porque 90% dos planos são lixo", "erro que perde clientes", "ACSM em 2h", antes/depois Excel→Protocol
- P2 Analytics: funil cliques → registos → planos gerados
- P2 Tradução ES/HI: revisão por nativo, traduzir restantes ficheiros (intake, manual, schedule, assessment)

## Round 68 — Header trim `/clients/$id` (5 Mai 2026)
- ✅ #79/#85 (P0): Header colapsado para 1 linha + chip strip. Avatar 48px, nome `text-xl sm:text-2xl md:text-3xl`, email truncado.
- ✅ Single icon-only `MoreHorizontal` overflow menu (`align="end"`, `ml-auto`) — agrega Download PDF, Ver como cliente, Pedir nova avaliação.
- ✅ Readiness strip (ACSM + Recovery chips) removida do header — duplicava `ClientCockpit`/`ProtocolRail` 200px abaixo. Single source of truth.
- ✅ AssessmentDatePicker + ClientDocuments mantidos numa segunda linha discreta abaixo do header.

## Round 69 — `/me` trainee cockpit (5 Mai 2026)
- ✅ #84 (P1): `loadMe` agora devolve `currentWeek`, `weekDays` (dias prescritos da última semana) e `recentSessions` (últimas 3) — read-only, RLS-safe via `supabaseAdmin` filtrado por trainer ownership.
- ✅ `/me` reescrita: hero plano com gradient amber + chip "X/Y feitos", lista de sessões da semana com check ✅/⭕ por `day_label`, lista de sessões recentes com data + nº exercícios.
- ✅ Voz PT: "tu" → "você" ("a sua conta", "peça ao seu treinador", "o seu treinador") — alinhada com Core memory.
- ✅ Sem write paths nesta surface: registo continua via link partilhado `/log/$token` (assinatura com bearer ≠ session). Próximo passo (#86 next) = mensagem do treinador.

## Round 70 — Onboarding rápido (5 Mai 2026)
- ✅ R62 #1 (P0): Nova rota `/plans/quick` — 5 inputs (nome, idade+sexo, objetivo, experiência, dias+equipamento) → cliente + assessment mínimo + pipeline phased completo, fire-and-forget.
- ✅ `startQuickPlan` server fn (`src/server/quick-plan.functions.ts`) com `requireSupabaseAuth` + `checkPlanQuota` + Zod. Inserção em `demo_runs` para reusar o `DemoRunsIndicator` global (zero spinners locais).
- ✅ Pipeline (`src/server/quick-plan.server.ts`): client → assessment (form criteria optimistas, capacity null, screen_not_assessed=true) → pre-stage analyses em batches de 4 → `runDemoPlay` (5 stages) → done.
- ✅ Honestidade: assessment marcado em `extended.quick_plan` com inputs originais; `notes` do cliente avisa "Plano rápido — sem intake clínico". Quota conta normal (1/1 free).
- ⏳ Próximos passos: CTAs no dashboard + landing hero (deixei fora desta ronda — rota acessível por URL e não quis tocar dashboard 554-LOC à pressa).

## Round 70.1 — Quick-plan CTAs (5 Mai 2026)
- ✅ CoachCockpit: botão âmbar "Plano rápido" → `/plans/quick` ao lado de "Abrir agenda".
- ✅ Landing hero: CTA "Experimente em 5 cliques" (visível só para signed-in para não confundir signup primário).

## Round 71 — Pricing toggle anual + tier Studio (5 Mai 2026)
- ✅ R62 #2 (P1): nova source-of-truth `src/lib/pricing-tiers.ts` (Starter €19/€190 · Pro €45/€450 · Studio €119/€1190 — espelha `billing.tsx`). `priceFor` + `monthlyEquivalent` helpers.
- ✅ `<PricingToggle/>` segmented Mensal/Anual com chip "−17% · 2 meses grátis" no lado anual (acessível, `role=radiogroup`).
- ✅ Landing pricing reescrito: 3 cards (md:grid-cols-3) com "Mais popular" no Pro, quota inline ("8 clientes · 8 planos/mês"), beta como faixa fina acima (não compete com tiers pagos).
- ✅ Studio CTA = mailto até Stripe estar wired para tier — sem chip "Em breve" (enfraquece a venda), só o canal honesto.
- ✅ i18n PT+EN: novo bloco `landing.pricing.{subtitle, popular_badge, per_month, per_year, monthly_eq, quota, beta_strip_*, toggle.*, tiers.{starter,pro,studio}.{tagline,cta,features}}`. Chaves antigas mantidas (não quebram billing.tsx).
- ⏭ R72 next: Stripe price IDs anual + storyboards 5 vídeos curtos + funnel analytics (R62 #3/#4).

## R7x — Aesthetic direction visual touches (queued)
- Dashboard: "next action" card with amber under-glow (single loud moment).
- Clients list: thin amber left border on birthday / red-flag rows.
- Intake.$token: numbered chips (01, 02…) per section; spacing rhythm to 48.
- Plan view: 600ms fade-in once on "Pronto" reveal.
- Capacity-gain: large display numeral typography pass on /me/progresso.

### Round 68 — /me polish (9 May 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 90 | P0 | /me/progresso | CapacityHero: big tabular numeral (avg Δ% e1RM) as page loud-moment; emerald/amber tone by sign | R68 ✅ |
| 91 | P0 | /me i18n | progress + history hardcoded PT → keys; locale-aware date formatting (pt/en/es/hi) | R68 ✅ |
| 92 | P1 | dashboard | "Next action" loud card (next session / top alert) | next |
| 93 | P1 | clients list | Thin amber left border for birthday + red-flag rows | next |
| 94 | P1 | intake.$token | Numbered chips per section (1/N) | next |
| 95 | P1 | plans.$id | "Pronto" 600ms fade-in reveal when status flips to ready | next |

### Round 72 — Aesthetic loud-moments pass (9 May 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 92 | P1 | dashboard | `<NextActionCard/>` mounted at top of `/dashboard` (submitted → birthday ≤7d → invite → quick) — single amber under-glow | R72 ✅ |
| 93 | P1 | clients list | `flagged` prop on ClientPlayerCard → `border-l-2 border-l-amber-500/60` for birthday ≤7d or submitted | R72 ✅ |
| 94 | P1 | intake.$token | Section chip = `01 · 06` tabular numerals; between-section spacing → `space-y-12` (48px rhythm) | R72 ✅ |
| 95 | P1 | plans.$id | View-mode CapacityGainBlock wrapped in `animate-fade-in` (~300ms) — soft "ready" reveal | R72 ✅ |

### Open thread — Assessment as bite-sized slider (proposed 9 May 2026)

Vision (founder): cada secção do protocolo (PAR-Q+, Antropometria, Goals, …, Performance — 14 no total) é servida como um cartão único, navegável por swipe / setas, em vez de uma página longa com tudo aberto. No fim do último cartão sai-se do protocolo e aterra-se no dashboard do cliente com o meso atual + gráficos de progresso. Sentir-se-ia mais como onboarding humano que como formulário clínico.

Decisões em aberto antes de implementar:
- 1 input por slide ou 1 secção por slide? (14 vs ~60 slides)
- Como tratar campos opcionais sem fazer o utilizador "swipar por nada"?
- Persist drift: guarda a cada swipe (já temos autosave) ou só no "Próxima"?
- Aterragem final: `/clients/$id` (vista treinador) ou `/me` (vista cliente)? Provavelmente depende de quem preencheu (treinador vs cliente via intake token).
- Mobile-first → setas + swipe nativo + barra de progresso fina no topo. Desktop → setas teclado ←/→.
- Como conviver com o modo "Ver tudo" actual (long-form) — fica como toggle ou desaparece?

Scope estimado: 2-3 rounds (R-A wireframe + slider mechanics em 1 secção como prova; R-B aplicar a todas; R-C aterragem dashboard). Não tocar antes de fechar as decisões acima.

### Round 74 — Cleanup quick-plan (10 Mai 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 99 | P0 | Cleanup | Apagada rota `/plans/quick`, server fns `quick-plan.functions.ts` + `quick-plan.server.ts`, chaves i18n `quick_title/sub/cta` (PT+EN) — fecha conflito com `mem://principles/no-quick-plans.md` | R74 ✅ |
| 100 | meta | Process | Novo contrato de operação (admin do backlog) escrito em `.lovable/plan.md` — confronto com visão antes de implementar, ideias soltas aterram com prioridade, 1 P0 por round | R74 ✅ |
| 101 | P1 | Dashboard | Hero "Esta semana" reescrito com aesthetic system: grelha 1:φ (1.618), separação tonal (`bg-muted/40`, sem borda), Fraunces no intervalo da semana, copy editorial ("Receita" + "Agenda →"), caption movida para `title=` (sem perder função) | R74 ✅ |
| 102 | P1 | Dashboard | Aesthetic pass aplicada ao resto da página: título h1 em Fraunces, cartões Today/MiniWeek/Nudges/Attention em separação tonal (sem borda+card), eyebrows com tracking 0.18em, amber reduzido a 3 momentos (NextActionCard bar, Coins, Today header) — lista de clientes mantém borda por densidade | R74 ✅ |

**Próximos candidatos (escolha do utilizador no próximo turno):**
- Aesthetic pass `/dashboard` → `/plans/$id` → `/me` (tratamento editorial do NextActionCard replicado)
- Slider de assessment — fechar 6 decisões abertas (linha 461) antes de qualquer código
- R62 #3/#4/#5 (storyboards vídeo, funnel analytics, revisão nativa ES/HI) — re-priorizar com gatilho concreto

### Round B.2 — `/clients/$id` aesthetic pass (10 Mai 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 103 | P1 | clients/$id | StatCard, AssessmentSynthesisDashboard (incl. flag block sem amber), ClientSnapshotCard → separação tonal (`bg-muted/30-40`, sem borda), `eyebrow` + `body-prose`, `tabular-nums` nos números | R B.2 ✅ |
| 104 | P1 | clients/$id | AssessmentSection: shell sem borda, tab pills + toggles em `label-caps`/`eyebrow` com `bg-muted/40-60` (sem amber/accent), checkmarks em muted | R B.2 ✅ |
| 105 | P1 | clients/$id | SectionBlock + SectionAnalysisCard + CompletionStrip → `bg-muted/40` sem borda accent, títulos em `eyebrow`, body em `body-prose` muted | R B.2 ✅ |
| 106 | deferred | clients/$id | BriefEditor asymmetric layout (1:φ) — vive em `src/components/BriefEditor.tsx`, fica para round dedicado (componente separado, deserve own pass) | next |
| 107 | deferred | clients/$id | Microcopy audit (no "Let's", ellipsis → ".", "Adicionar medição" etc.) + i18n 4 locales + verify-capacity-i18n.ts — separar por tocar muitas keys em 4 ficheiros | next |
| 108 | deferred | clients/$id | Screenshot canónico em `.lovable/design/round-b-canonical-screenshots/clients-id-full-page.png` + smoke 375px + verificação 3 temas | next |

### Round B (Trust pass) — Decide to wire or delete (hidden assessment fields)

Hidden behind `VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS` per assessment foundational audit (`.lovable/audits/assessment-foundational-2026.md`). No documented downstream consumer in Stage 1 brief, deterministic calcs, or any other code path. Decide in Phase B whether to wire to a real consumer or drop column + i18n keys.

| Field | Captured at | Reason hidden |
|---|---|---|
| `nutrition.ext_processed_food_freq` | §9 Nutrition (clients_.$clientId.tsx) | No documented downstream consumer per audit |
| `nutrition.ext_water_l_per_day` | §9 Nutrition (clients_.$clientId.tsx) | No documented downstream consumer per audit |
| `posture.standing_posture_notes` | §11 Posture (clients_.$clientId.tsx) | No documented downstream consumer per audit |

### Round D — Walkthrough P0 fixes (10 May 2026)

| # | P | Área | Item | Status |
|---|---|---|---|---|
| 109 | P0 | clients/$id | Concluir avaliação sempre habilitado; AlertDialog confirma quando parcial (`generate.incomplete_*` em pt/en/es/hi) | R D ✅ |
| 110 | P0 | SmartGoalSection | Template selecionado dentro da categoria com estado visual claro (`bg-foreground/10 ring-foreground/30`, badge em foreground) | R D ✅ |
| 111 | P0 | clients/$id | Rockport wizard — pulls weight/age/sex, asks mm:ss + post-walk HR, computes VO₂max via fórmula ACSM, classifica poor/fair/good/excellent | R D ✅ |
| 112 | P0 | RxImplications | Live update por secção em Mobility/Movement/Nutrition — RxImplications já recomputa por re-render (passa assessment); o que falta é **per-section analysis function** (CC9). Adiar para Round E (arquitetura pre-stage por secção). | deferred → Round E |
| 113 | P0 | clients/$id | Verificar persistência de estado parcial — autosave já corre via `flushPendingSave`/debounce (lines 1140+); upsert em `assessments` ocorre em qualquer % de preenchimento. Sem regressão observada. | R D ✅ verified |

## Round actual (post-prompt-D)

| # | P | Área | Item |
|---|---|---|---|
| - | P0 | Motor | Stage 3: regra intra-week uniqueness no prompt + week1SetCap por tier (remedial 2/1/1, conservative 3/2/1, advanced 3/3/2) |
| - | P0 | Motor | enforceWeek1SetCap determinístico após enforceRpeFloor (logado em generation_log com stage `set_cap`) |
| - | P2 | Docs | .lovable/audits/round-mvp-map.md + .txt — mapa app + pontas soltas |
| - | P1 | Briefing | Redesign editorial (t-1..t-4, tonal cards) — próxima round |
