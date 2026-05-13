# Gap a 90 dias entre o produto actual e a visão "MVP forte"

_Última actualização: 2026-05-13. Documento canónico — fonte única para
priorização. Nenhum trabalho fora desta lista até o último item da fase 1
estar fechado._

## Contexto

Baseado no estudo arquitetural de Maio 2026 (Secções A–Q) cruzado com o
estado real do código + memória do projecto. Os princípios já interiorizados
(augment-not-automate, AI ≤1 microciclo, Stage 4 determinístico, programação
versionada, pricing honesto, voz formal PT-PT) **não** estão neste documento
— estão na memória core e mantêm-se. Este documento lista apenas o que
falta ou precisa de refactor.

## Veredicto

Distância à "MVP forte" do estudo: ~6–10 semanas de trabalho focado se
pararmos features novas. Hoje somos um one-shot generator com CRM. Falta o
loop fechado: **logs reais → adaptation engine → próximo bloco
justificável**. Sem isso, todo o resto é demo.

---

## Fase 1 — Fundações invisíveis (semanas 1–2)

Trabalho que não muda nada visível mas que destrava todo o resto. Se
saltarmos isto, cada uma das fases seguintes traz dívida composta.

### 1.1 Acabar R-A — `resolveProgrammingContext` como única fonte

Já existe em `src/server/programming-context.server.ts`. Já migrado:
`getPlanConstraints`. Falta migrar:

- **Stage 3** (`src/server/phased/stage3-microcycle.functions.ts`) — hoje
  chama `classifyTier` + `rpeFloors` directamente. Deve receber
  `ProgrammingContext` injectado.
- **Stage 4** (`src/server/phased/stage4-progressions.functions.ts`) — lê
  `programming_variables` directamente para wave/deload. Deve consumir
  `ctx.cockpit`.
- **BriefEditor / IntensityCockpit** — usa `resolveCockpit` directamente.
  Migrar para `resolveProgrammingContextSync` para que o "Por que este
  número?" tooltip mostre `source` (`tier_engine` vs `user_override` vs
  `starting_floor`).
- **TierChip** + **PDF render** — eliminar re-derivação local. Recebem
  `ProgrammingContext.tier` como prop.

Critério de aceitação: nenhum ficheiro fora de `programming-context.server.ts`
importa `classifyTier`, `rpeFloors`, `deriveStartingFloor` ou
`resolveCockpit` directamente. Lint rule no fim para travar regressão.

### 1.2 `engine_version` em todos os outputs determinísticos

Cada engine determinístico devolve um objecto sem assinar. Adicionar campo
`engine_version: "name@semver"` em:

- `programming-tier.server.ts` (`classifyTier` → `programming-tier@1.0.0`)
- `programming-defaults.ts` (`deriveStartingFloor`, `resolveCockpit`)
- Wave builder (`buildWavePlan` em stage4)
- `preparticipation.server.ts` (`runPreparticipationAlgorithm` →
  `parq-plus-acsm@2023.1`)
- `derive.server.ts` (FITT-VP)
- `program-next-week.functions.ts`

Persistir em `generation_log.engine_versions` (jsonb). Trivial — um campo
por engine, um por chamada.

### 1.3 Engine ports formais (interfaces TS)

O estudo cita explicitamente: "two days of work that prevents months of
refactoring." Definir em `src/domain/ports/`:

```ts
export interface PlanGenerator {
  readonly version: string;
  generate(input: PlanInput): Promise<PlanDraft>;
  explain(draft: PlanDraft): RationaleBundle;
}

export interface ProgressionEngine {
  readonly version: string;
  nextWeek(input: ProgressionInput): ProgressionOutput;
}

export interface ScreeningEvaluator {
  readonly version: string;
  evaluate(input: ScreeningInput): ScreeningResult;
}

export interface AdaptationEngine {
  readonly version: string;
  proposeNextBlock(input: AdaptationInput): NextBlockProposal;
}

export interface AiProvider {
  readonly version: string;
  generate<T>(opts: AiCallOptions<T>): Promise<AiResult<T>>;
}
```

Sem implementações novas. Os módulos actuais passam a implementar estes
contratos. `engineRegistry` resolve port → adapter por workspace.

---

## Fase 2 — Safety + auditoria (semana 3)

### 2.1 Screening como hard-gate

Tabela `screening_evaluations` (workspace_id, client_id, protocol_version,
answers jsonb, risk_band enum, structured_reasons jsonb, evaluator_id,
created_at). RLS por workspace. Imutável: novas avaliações = novas linhas.

Plan generator passa a chamar `getActiveScreening(client_id)` antes de
gerar. Se `risk_band ≥ intermediate` e plano excede ceiling implícito (HIIT
vigoroso, 1RM testing, RPE > 9 num red-flag), recusa gerar — ou exige
`override_reason` que vai para `audit_events`.

### 2.2 Audit events table

`audit_events` append-only: id, workspace_id, actor_id, event_type, entity_type,
entity_id, payload jsonb, engine_versions jsonb, upstream_hash, created_at.

Eventos da MVP: `plan_generated`, `plan_approved`, `screening_completed`,
`session_logged`, `block_advanced`, `engine_overridden`,
`risk_band_changed`. `generation_log` continua para AI calls; `audit_events`
é o registo de domínio.

---

## Fase 3 — Loop fechado (semanas 4–8)

### 3.1 Per-set session logging end-to-end

Hoje `/log/$token` existe mas a granularidade real e a validação
server-side estão incompletas. Trabalho:

- Tabela `session_set_logs`: session_id, exercise_id, set_index, reps,
  load_kg, rpe, rir, pain_flag boolean, pain_region, notes
- Trigger server-side: pain ≥3 → row em `audit_events` + notification ao
  trainer (sem agregar para semanal — surge agora)
- Trigger: ao logar set, recompute rolling e1RM por movement pattern
  (Epley) → materialised em `client_movement_metrics`
- Validação server-side em `logSet` server fn: load > 0, reps 1–50, RPE
  1–10, exercise_id pertence ao plano activo

### 3.2 Adaptation engine v1 (block-level)

**O build existencial do estudo.** `programNextWeek` resolve semana a
semana; falta o salto de bloco baseado em logs reais.

`src/server/adaptation/propose-next-block.server.ts`:

- Input: `client_id`, `prior_plan_id`
- Lê: assessment activa, prior_plan brief + microcycle, todos os
  `session_set_logs` do bloco, `programming_variables` actuais
- Computa determinísticamente:
  - Δe1RM por movement pattern (4-week trend, mín 6 sessões)
  - RPE drift por exercise (logged − prescribed)
  - Adherence (% sessões completas, % sets completos no range)
  - Volume actual vs MEV/MAV/MRV por muscle (de `volume-actual.ts`)
  - Pain flag count
- Outputs estruturado `NextBlockProposal`:
  - Diff de prescription por exercise (load %, sets, RPE target)
  - Rationale chips por mudança (referenciam logs específicos)
  - Deload trigger se: e1RM ↓>5%, RPE drift ↑>0.7 a load constante,
    adherence <60%, ou pain count >3
- AI **só** intervém para escrever a `block_transition_summary` em prosa;
  não decide nenhum número. Stage 3 do bloco N+1 recebe a proposal como
  input, não regenera do zero.

`archivePlanAndStartNextBlock` é refactorizado para usar este caminho —
deixa de re-correr todo o pipeline phased.

---

## Fase 4 — Renovação + receita (semanas 9–10)

### 4.1 End-of-block progress report PDF

Bilingual, branded. Reusa infra do plan PDF. Conteúdo:

- Hero: nome do cliente, bloco N → N+1, datas
- Deltas determinísticos: Δe1RM por padrão (com Epley + IC), adherence %,
  volume completado vs MEV
- Subjective trend: pain flags, RPE médio (se temos check-ins)
- Foto comparativa (só se consentido)
- Trainer narrative (AI, ≤120 palavras, escrita em registo do cliente)
- Próximo bloco preview: 2–3 chips de foco

Gerado on-demand + automaticamente quando `archivePlanAndStartNextBlock`
corre. Guardado em `client_documents`.

### 4.2 Stripe Checkout produção

Quota e tiers já existem. Falta:

- Stripe Checkout session via server fn
- Webhook handler em `src/routes/api/public/stripe-webhook.ts` com
  signature verification (HMAC timing-safe)
- Sync `subscribers.subscribed` + `current_period_end`
- Customer portal link em `/billing`

---

## Distrações explicitamente proibidas até Fase 4 acabar

Cada um destes está documentado na memória, é tentador, e o estudo
(Secção L "Dangerous distractions" + N "Dangerous distractions during MVP")
avisa em específico:

- Multi-modality (jogos tradicionais, mobility-only, etc.)
- Exercise media production pipeline (vídeos próprios)
- Demo Lab / persona simulator iteração nova
- Schedule.packs UI mais rica, calendar integration
- Wearables (Apple Health, Garmin)
- Mobile native apps
- Community / chat features
- Revenue analytics dashboard
- Multi-trainer workspaces
- Marketing push antes de retention provada

Se uma destas surgir num pedido, responder com link para este documento e
propor adicionar à fase 5 (post-MVP).

---

## Critério "MVP forte fechado"

1. Trainer faz onboarding < 5min e cria plano em < 90s.
2. Cliente loga ≥80% dos sets de uma semana.
3. Sistema propõe automaticamente bloco N+1 com diff justificado por logs.
4. Trainer revê + aprova em < 3min.
5. PDF de progresso gerado e enviado ao cliente.
6. Stripe cobra €19 com sucesso e quota é respeitada.
7. Cada decisão da pipeline aparece em `audit_events` com versão de engine.
8. Re-screening em 6 meses ou trigger de evento muda risk_band e bloqueia
   intensidades incompatíveis sem override registado.

Quando os 8 critérios passarem em smoke contra ≥1 cliente real pagante,
este documento é arquivado e abre-se `forge-post-mvp.md`.