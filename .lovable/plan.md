
# Auditoria & plano MVP — Round atual

Antes de tocar em código quero deixar tudo mapeado, confirmar o que ainda existe (não perdemos nada) e priorizar. No fim ficam dois ficheiros: `.lovable/audits/round-mvp-map.md` (para nós) e `.lovable/audits/round-mvp-map.txt` (para colares ao Claude).

---

## 1. O logbook antigo NÃO se perdeu

Está vivo em `src/routes/plans.$planId.tsx` (1960 linhas). É a página do plano com **5 tabs**: `view` · `edit` · `log` · `results` · `progress`.

- `view` → `ViewMode` + `MesocycleTableView` + `SessionDayView` (a tal tabela desktop)
- `edit` → `MesocycleTableView` em modo editável
- `log` → `LogMode` (a tabela densa de logging desktop, com inputs por set)
- `results` → `ResultsPanel` + `LogbookTimeline` + `CapacityGainCard`
- `progress` → `ExerciseTrendChart`

A página nova `/log/$token` (mobile, ExerciseSetsCard) é **complementar**, não substituta — é o link partilhável do cliente. A do trainer (desktop, tabs) continua a ser `/plans/$planId`. O CTA "Abrir primeiro log" do cliente abre a `/log/$token` (mobile-first do cliente). Decisão: manter as duas, só clarificar copy e entradas.

---

## 2. Mapa da app Protocol (raízes e vasos)

```text
src/routes/                     # TanStack file-based routing
├─ __root.tsx                   # shell global + providers (Tour, DemoRuns, Currency, ViewAs)
├─ index.tsx                    # landing PT (PT-only) — hero, FAQ trim
├─ auth.tsx · welcome.tsx       # signup/login + onboarding
├─ dashboard.tsx                # home do PT — recent plans, próximas sessões
├─ clients_.$clientId.tsx       # ⭐ casa do cliente (PT) — 6402 linhas, 5 estágios + ProtocolRail
│   └─ .year.tsx                # vista anual de blocos
├─ plans.$planId.tsx            # ⭐ editor do plano com tabs view/edit/log/results/progress
│   ├─ .brief.tsx · .blueprint.tsx · .progressions.tsx · .microcycle.tsx (redirect)
│   └─ .sessions.tsx            # histórico + export PDF compliance
├─ plans.new.tsx · plans.index.tsx
├─ log.$token.tsx               # ⭐ logbook MOBILE do cliente (link partilhável)
├─ intake.$token.tsx            # ⭐ intake público (sem auth, x-intake-token header)
├─ me.tsx · me.progresso · me.historico  # casa do cliente autenticado
├─ schedule.tsx · schedule.packs.tsx · billing.tsx · settings.tsx · templates.tsx · manual.tsx · knowledge.tsx
└─ admin.system.tsx · api/public/hooks/weekly-digest.ts

src/server/                     # createServerFn (RPC) + .server helpers
├─ phased/                      # ⭐ pipeline de geração de plano (5 estágios)
│   ├─ pre-stage.functions.ts            # contexto, normalização
│   ├─ stage1-brief.functions.ts         # AI → brief
│   ├─ stage2-blueprint.functions.ts     # AI → plano-mestre
│   ├─ stage3-microcycle.functions.ts    # ⭐ AI → Semana 1 (origem do bug rotação)
│   ├─ stage4-progressions.functions.ts  # determinístico — Bompa wave + NSCA
│   ├─ stage5-bulkfill.functions.ts      # preenche semanas
│   ├─ programming-tier.server.ts        # ⭐ remedial/conservative/advanced + rpe_floors
│   ├─ programming-defaults.ts · schemas.ts · model-routing.server.ts
│   └─ summary.server.ts · ai.server.ts
├─ plan.functions.ts · plan.server.ts · plan-cost.server.ts · plan-critic.server.ts · plan-repair.server.ts
├─ blocks.functions.ts · blocks-manual.functions.ts        # archive + start next block
├─ sessions.functions.ts · sessions-ocr.functions.ts       # logbook + share token
├─ clients.functions.ts · intake.functions.ts · intake-ai.functions.ts
├─ me.functions.ts                                         # client-side preview/self
├─ measurements.functions.ts · capacity.functions.ts · aspirations.functions.ts
├─ demo-*.functions.ts (6)                                 # demo lab + judge
├─ quota.server.ts                                         # plan_quota (Free=1)
├─ billing.functions.ts                                    # Stripe
├─ schedule.functions.ts · feedback.functions.ts
└─ knowledge/                                              # knowledge profiles + system iterations

src/components/                 # 93 componentes
├─ plan/    LogbookTimeline · NextWeekCard · IntensityCockpit
├─ log/     ExerciseSetsCard · LogHeader · Confetti · ImportFromPhotoButton (mobile)
├─ volume/  VolumeSection
├─ ProtocolRail · ComplianceCard · ComplianceDashboard · MesocycleTableView · SessionDayView (desktop logbook)
├─ ResultsPanel · ExerciseTrendChart · CapacityGainCard · BlockAdaptationCard · NextBlockCard
├─ BrandMark · ClientAvatar · DemoRunsIndicator · ImportLogDialog · …

src/lib/                        # puro (sem I/O)
├─ pdf.ts · pdf-types.ts        # gerador PDF
├─ status-tone.ts · plan-status.ts · capacity-gain.ts · compliance.ts
├─ block-feedback.ts · block-adaptation.ts · plan-lineage.ts
├─ rotation-audit.ts            # ⭐ mede % accessórios novos vs bloco anterior
├─ volume-actual.ts · volume-compute.ts · volume-landmarks.ts · prescribe-volume.ts
├─ programming → tier · zones · capacity-thresholds · rpe-tone
├─ exercise-taxonomy · session-taxonomy · movement-criteria · exercise-demo
└─ regional-names · pricing-tiers · currency · friendly-error · auto-infer · …

DB (Supabase)                   # tudo com RLS (auth.uid() = trainer_id)
├─ profiles (white-label) · subscribers (Stripe) · user_roles
├─ clients (intake_token + user_id self) · assessments · assessment_unmatched_aspirations
├─ workout_plans (block_number, prior_plan_id, share_token, generation_meta)
├─ workout_plan_days · workout_sessions (entries jsonb, status, pr_celebrated_at)
├─ generation_log (telemetria de TODA chamada AI — obrigatório)
├─ client_packs · pack_members · client_bookings · client_checkins
├─ client_measurements · client_measurement_prefs · client_capacity_snapshots · capacity_domains
├─ plan_feedback · plan_templates · missions · daily_activity_log
├─ knowledge_profiles + versions · system_iterations · demo_runs
└─ acsm_* (chapters, sections, recommendations, contraindications, normatives, populations, thresholds)
```

---

## 3. O que foi feito desde a "prompt D" (esta conversa)

1. `ClientStageOneHero` criado (componente novo) + i18n EN/ES/PT do assessment.
2. `ComplianceCard` criado a "gating" — só renderiza com ≥2 semanas loggadas (corrigiu o painel vazio com risco branco).
3. Gate da secção Protocol simplificado: `heroPlan || protocolRailOpen` (deixou de mostrar caixa vazia quando não havia plano activo).
4. `clients_.$clientId.tsx`: importado `ThisWeekHero` + `ensureShareToken`; queries de `workout_plans` passaram a trazer `duration_weeks`, `share_token`, `share_token_expires_at`. CTA primário agora chama `ensureShareTokenFn` e navega para `/log/$token` ("Abrir primeiro log"). Smoke confirmado em browser.

(Sem alterações ao motor de geração desde a prompt D — o bug do microciclo é pré-existente e ainda não foi tocado.)

---

## 4. Pontas soltas confirmadas

**P0 — Motor (impacta cada plano gerado)**
- Stage 3 está a repetir o mesmo exercício em todas as sessões (3× goblet squat). O `prior_exercise_pool` só rege rotação **inter-bloco**, não **intra-microciclo**. Falta uma regra: "no máximo 1 ocorrência por exercício dentro da Semana 1".
- Falta cap de sets para Semana 1 em tier `remedial`. `tierGuidelines("remedial")` define exercícios e RPE mas NÃO sets — o AI defaulta a 3. Para remedial Semana 1 deve ser 1–2 sets (intro week). Sim, concordo contigo. Conservative deve arrancar com 2; advanced 2–3.

**P1 — UX/Design**
- Briefing (`/plans/$planId/brief`) hoje é uma redirect-shim de 34 linhas — o conteúdo real do brief está dentro do `plans.$planId.tsx`. Está visualmente espaçado/feio. Precisa de redesign editorial Fraunces+Inter Tight, tonal-separation, t-1..t-4, amber só 2-3 vezes (cf. aesthetic-system.md).
- O logbook desktop dentro de `plans.$planId.tsx` precisa de uma releitura mas é alta complexidade — separar para R seguinte.

**P2 — Documentação**
- Não temos um único índice navegável de rotas/server-fns. Esta auditoria fica como `.lovable/audits/round-mvp-map.md` + `.txt`.

---

## 5. Plano de execução (próximas rounds)

**Esta round (recomendado fazer já):**

1. **Documentar** — escrever `.lovable/audits/round-mvp-map.md` (versão rica, com este mapa) **e** `.lovable/audits/round-mvp-map.txt` (versão flat para colares ao Claude). Acrescentar entrada no `.lovable/backlog.md`.

2. **Fix P0 motor — Stage 3:**
   - Em `src/server/phased/stage3-microcycle.functions.ts`, acrescentar ao prompt regra dura: *"Cada exercício pode aparecer no máximo UMA vez nesta Semana 1, excepto o main lift que pode repetir-se no máximo em 2 sessões. Variantes contam como exercícios diferentes (e.g. goblet squat ≠ box squat ≠ leg press)."*
   - Pós-validação: detectar duplicados intra-semana → 1 retry, depois substituir determinísticamente pela próxima alternativa do `requiredAlternatives` do tier.
   - Tag em `generation_meta.intra_week_dup_audit`.

3. **Fix P0 motor — sets Semana 1 por tier:**
   - Em `programming-tier.server.ts`, adicionar `week1SetCap: { main, accessory, carry }` ao `TierGuidelines` (remedial 2/1/1, conservative 3/2/1, advanced 3/3/2).
   - Stage 3 lê e injecta no prompt como hard cap; pós-validação trunca se vier acima.
   - Stage 4 (progressões determinísticas) sobe sets a partir da Semana 2 conforme o wave.

**Round seguinte:**

4. **Briefing redesign** — só CSS/JSX. Aplicar `t-1..t-4` (Fraunces titles, Inter Tight body), tonal cards (`var(--surface)` em vez de borders), reduzir espaçamento vertical para 1.618 base, remover amber excepto no CTA principal e no chip de "Aprovar".

5. **Logbook desktop polish** — clarificar que `plans.$planId` é a vista do PT (5 tabs) e `/log/$token` é a vista do cliente; adicionar link cruzado no header do PT ("Pré-visualizar como cliente").

---

## 6. Não vou tocar (deixar como está)

- `/log/$token` mobile — está bem.
- Pipeline de quota, Stripe, RLS — fora de scope.
- Demo Lab, tour, year view — funcionam.

---

## 7. Critérios de "feito" para esta round

- Os 2 ficheiros de auditoria existem e são auto-suficientes (alguém novo lê o `.txt` e percebe a app).
- Plano novo para Carlos remedial: zero exercícios duplicados intra-semana; main lift no máximo 2× nas sessões; accessórios 1× cada; sets ≤2 na Semana 1.
- Backlog actualizado com R-novo + P0/P1.

Confirmas que avanço por esta ordem (1 → 2 → 3 esta round, briefing fica para a próxima)?
