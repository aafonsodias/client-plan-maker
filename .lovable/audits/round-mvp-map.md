# Protocol — Mapa MVP & pontas soltas

_Última actualização: round actual (post-prompt-D)._  
_Para a versão flat (cole no Claude) ver `round-mvp-map.txt` no mesmo directório._

## 1. Logbook — não se perdeu nada

Existem **duas superfícies** complementares:

| Surface | Rota | Audiência | Layout |
|---|---|---|---|
| Editor do plano (5 tabs) | `/plans/$planId` (`src/routes/plans.$planId.tsx`, 1960 LOC) | Treinador | Desktop, denso |
| Logbook do cliente | `/log/$token` (`src/routes/log.$token.tsx`) | Cliente (link) | Mobile-first |

As 5 tabs do editor: `view` · `edit` · `log` · `results` · `progress`.
- `view` → `ViewMode` + `MesocycleTableView` + `SessionDayView`
- `edit` → `MesocycleTableView` editável
- `log` → `LogMode` (tabela densa de logging desktop)
- `results` → `ResultsPanel` + `LogbookTimeline` + `CapacityGainCard`
- `progress` → `ExerciseTrendChart`

CTA "Abrir primeiro log" da casa do cliente abre `/log/$token` (mobile-first), não substitui a vista do PT.

## 2. Mapa de raízes/vasos

### Rotas (`src/routes/`)
- `__root.tsx` — shell + providers (Tour, DemoRuns, Currency, ViewAs)
- `index.tsx` — landing PT-only
- `auth.tsx` · `welcome.tsx` — onboarding
- `dashboard.tsx` — home do PT
- `clients_.$clientId.tsx` ⭐ casa do cliente (PT) — 6402 LOC, 5 estágios + ProtocolRail
  - `clients_.$clientId.year.tsx` — vista anual
- `plans.$planId.tsx` ⭐ editor com 5 tabs
  - `.brief.tsx` · `.blueprint.tsx` · `.progressions.tsx` · `.microcycle.tsx` (redirect)
  - `.sessions.tsx` — histórico + export PDF compliance
- `plans.new.tsx` · `plans.index.tsx` · `templates.tsx`
- `log.$token.tsx` ⭐ logbook mobile do cliente
- `intake.$token.tsx` ⭐ intake público (header `x-intake-token`)
- `me.tsx` · `me.progresso` · `me.historico` — casa do cliente autenticado
- `schedule.tsx` · `schedule.packs.tsx` · `billing.tsx` · `settings.tsx` · `manual.tsx` · `knowledge.tsx`
- `admin.system.tsx` · `api/public/hooks/weekly-digest.ts`

### Servidor (`src/server/`)
Pipeline de geração `phased/` (5 estágios):
- `pre-stage.functions.ts` — contexto/normalização
- `stage1-brief.functions.ts` — AI → brief
- `stage2-blueprint.functions.ts` — AI → plano-mestre
- `stage3-microcycle.functions.ts` ⭐ AI → Semana 1 (origem do bug intra-week dup)
- `stage4-progressions.functions.ts` — determinístico (Bompa wave + NSCA)
- `stage5-bulkfill.functions.ts` — preenche semanas
- `programming-tier.server.ts` ⭐ remedial/conservative/advanced + `rpeFloors` + (R-novo) `week1SetCap`
- `programming-defaults.ts` · `schemas.ts` · `model-routing.server.ts`
- `summary.server.ts` · `ai.server.ts` · `program-next-week.functions.ts`

Outros servers:
- `plan.functions.ts` · `plan.server.ts` · `plan-cost.server.ts` · `plan-critic.server.ts` · `plan-repair.server.ts`
- `blocks.functions.ts` · `blocks-manual.functions.ts` — multi-block
- `sessions.functions.ts` · `sessions-ocr.functions.ts` — logbook + share token
- `clients.functions.ts` · `intake.functions.ts` · `intake-ai.functions.ts` · `intake-photos.*`
- `me.functions.ts` — self/preview do cliente
- `measurements.functions.ts` · `capacity.functions.ts` · `aspirations.functions.ts`
- `demo-*.functions.ts` (6) — demo lab + judge + year + oneshot + play + seed
- `quota.server.ts` — Free=1 plano
- `billing.functions.ts` — Stripe
- `schedule.functions.ts` · `feedback.functions.ts`
- `knowledge/` — knowledge profiles + system iterations

### Componentes (`src/components/`, 93 ficheiros)
- `plan/` — `LogbookTimeline`, `NextWeekCard`, `IntensityCockpit`
- `log/` — `ExerciseSetsCard`, `LogHeader`, `Confetti`, `ImportFromPhotoButton` (mobile)
- `volume/VolumeSection`
- `ProtocolRail`, `ComplianceCard`, `ComplianceDashboard`, `MesocycleTableView`, `SessionDayView`
- `ResultsPanel`, `ExerciseTrendChart`, `CapacityGainCard`, `BlockAdaptationCard`, `NextBlockCard`
- `BrandMark`, `ClientAvatar`, `DemoRunsIndicator`, `ImportLogDialog`, …

### Lib (`src/lib/`, puro)
- `pdf.ts` · `pdf-types.ts` — geração PDF
- `status-tone.ts` · `plan-status.ts` · `capacity-gain.ts` · `compliance.ts`
- `block-feedback.ts` · `block-adaptation.ts` · `plan-lineage.ts`
- `rotation-audit.ts` ⭐ % accessórios novos vs bloco anterior
- `volume-actual.ts` · `volume-compute.ts` · `volume-landmarks.ts` · `prescribe-volume.ts`
- `programming` → `training-tier`, `training-zones`, `capacity-thresholds`, `rpe-tone`
- `exercise-taxonomy` · `session-taxonomy` · `movement-criteria` · `exercise-demo`
- `regional-names`, `pricing-tiers`, `currency`, `friendly-error`, `auto-infer`

### DB (Supabase, RLS por trainer)
- `profiles` (white-label) · `subscribers` (Stripe) · `user_roles`
- `clients` (intake_token + user_id self) · `assessments` · `assessment_unmatched_aspirations`
- `workout_plans` (block_number, prior_plan_id, share_token, generation_meta)
- `workout_plan_days` · `workout_sessions` (entries jsonb, status, pr_celebrated_at)
- `generation_log` — telemetria obrigatória de TODA chamada AI
- `client_packs`, `pack_members`, `client_bookings`, `client_checkins`
- `client_measurements`, `client_measurement_prefs`, `client_capacity_snapshots`, `capacity_domains`
- `plan_feedback`, `plan_templates`, `missions`, `daily_activity_log`
- `knowledge_profiles` + versions, `system_iterations`, `demo_runs`
- `acsm_*` (chapters, sections, recommendations, contraindications, normatives, populations, thresholds)

## 3. Mudanças desde a "prompt D" (esta conversa)

1. `ClientStageOneHero` criado + i18n EN/ES/PT do assessment.
2. `ComplianceCard` criado com gating ≥2 semanas loggadas (sem aquele risco branco vazio).
3. Gate da secção Protocol: `heroPlan || protocolRailOpen` (sem caixa vazia sem plano activo).
4. `clients_.$clientId.tsx`: `ThisWeekHero` + `ensureShareToken`; queries trazem `duration_weeks`/`share_token`/`share_token_expires_at`; CTA "Abrir primeiro log" navega para `/log/$token`.
5. **(Round actual)** Documentação + Stage 3 — regra intra-week dup + `week1SetCap` por tier.

## 4. Pontas soltas

### P0 — Motor de geração
- **Intra-week dup** — Stage 3 repete o mesmo exercício em todas as sessões (3× goblet squat). O `prior_exercise_pool` regula só inter-bloco. **Fix nesta round:** prompt adiciona regra "max 1 ocorrência por accessory na semana, main lift max 2 sessões"; pós-validação detecta duplicados, retry com `hardBan` no(s) dia(s) duplicados; tag em `generation_meta.intra_week_dup_audit`.
- **Sets Semana 1 por tier** — `tierGuidelines("remedial")` não impõe limite de sets → AI defaulta a 3, irrealista para remedial. **Fix nesta round:** novo `week1SetCap` em `TierGuidelines` (remedial 2/1/1, conservative 3/2/1, advanced 3/3/2 para main/accessory/carry); injectado no prompt + truncagem determinística pós-AI.

### P1 — UX / Design
- Briefing está visualmente espaçado/feio. Aplicar aesthetic-system (`t-1..t-4`, Fraunces+Inter Tight, tonal cards, amber só 2-3×). _Round seguinte._
- Logbook desktop polish + link "Pré-visualizar como cliente". _Round seguinte._

### P2 — Documentação
- Manter este map vivo e o `.txt` para colares ao Claude.

## 5. Ordem desta round

1. Auditoria (este ficheiro + `.txt`).
2. Stage 3 prompt + pós-validação intra-week dup.
3. `week1SetCap` por tier + prompt + truncagem determinística.
4. Smoke: gerar plano remedial 2 sessões/semana e validar zero duplicados + sets ≤2 main / ≤1 accessório.

## 6. Critérios "feito"

- Md + txt existem e são auto-suficientes.
- Plano remedial: zero duplicados intra-semana, main lift ≤2 sessões, accessórios 1×, sets Semana 1 dentro do cap.
- `backlog.md` atualizado.