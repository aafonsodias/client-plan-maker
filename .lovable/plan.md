
# Plano único — Arrumação + Intake slideshow + Funil

> Sem código nesta volta. Achados, decisões e ordem de execução. Perguntas no fim.

---

## 1. Mapa da app (estado atual)

```text
PUBLIC
  /                    landing (index.tsx)
  /auth                login/signup
  /privacy /terms      legais
  /manual              docs internos
  /intake/$token       intake do cliente (público via token)
  /log/$token          log do cliente (público via token)

AUTHENTICATED (AppShell)
  primaryNav:   /dashboard · /clients · /bancada · /settings
  secondaryNav: /manual · /billing · /  (landing)

  /dashboard             259 linhas — KPIs + onboarding
  /bancada               43 linhas  — placeholder/stub
  /forge                 169 linhas — NÃO está no nav (órfão)
  /clients               lista
  /clients_/$clientId    ficha cliente + intake link panel
  /plans                 index
  /plans/new             criar
  /plans/$planId         hub do plano (Results)
    ├ /brief
    ├ /blueprint         (VolumeSection pré-flight)
    ├ /microcycle
    ├ /progressions
    └ /sessions
  /billing               subscrição
  /settings              branding / conta

API
  /api/public/hooks/weekly-digest   (cron)
```

### Server functions (responsabilidades)

```text
plan.functions          CRUD legado de planos
plan.server             helpers
phased/stage1..5        pipeline phased atual (brief→bulkfill)
phased/pre-stage        warmup
phased/microcycle-edit  edição
blocks.functions        archivePlanAndStartNextBlock (block N+1)
blocks-manual.functions variante manual
quota.server            checkPlanQuota
intake.functions        load/save/generate token
billing.functions       Stripe (a verificar cobertura)
demo-*.functions        Demo Lab (5 ficheiros)
sessions(-ocr).functions logbook + OCR
measurements / feedback / studies / concierge
```

---

## 2. Tabela de achados

| # | Severidade | Achado | Proposta | Custo |
|---|---|---|---|---|
| A1 | **Alta** | Três hubs (`/dashboard` 259L, `/bancada` 43L stub, `/forge` 169L órfão fora do nav). Confusão de identidade. | Eleger `/dashboard` como hub único. Apagar `/bancada` e `/forge` (ou fundir conteúdo útil no dashboard). Atualizar `primaryNav`. | S |
| A2 | **Alta** | 5 ficheiros `demo-*.functions` + `DemoLabPanel`/`DemoOrchestrator`/`DemoMaquetteDialog` no bundle da landing. | Lazy-load do Demo Lab por `React.lazy` + dynamic import; só carrega quando o utilizador abre o painel. | S |
| A3 | **Alta** | `jsPDF` (lib/pdf.ts) provavelmente importado eagerly em rotas de plano. | Dynamic `import('@/lib/pdf')` dentro do handler do botão "Imprimir". | XS |
| A4 | **Alta** | `recharts` em ResultsPanel/ExerciseTrendChart carregado eager. | `React.lazy` para charts; skeleton no fallback. | S |
| A5 | **Alta** | `sessions-ocr` (Tesseract/OCR) potencialmente no bundle do `/log/$token` público. | Lazy import só quando user clica "Importar foto". | XS |
| A6 | **Alta** | `plan.functions` vs `phased/*` vs `blocks.functions` — sobreposição de criação/atualização de planos. | Marcar `plan.functions` como legacy, mover handlers ainda usados para `phased/` ou eliminar. Auditoria 1h. | M |
| B1 | Média | Chips/dots manuais fora de `status-tone` em vários sítios (a confirmar com grep). | Substituir por `toneChip/toneDot/toneText`. | S |
| B2 | Média | `BrandMark` ausente em `/settings`, `/billing`, `/manual`, `/log/$token`. | Adicionar em headers internos (não em PDF nem auth). | XS |
| B3 | Média | `IntakeLinkPanel` é denso e tem 3 estados quase idênticos — bom candidato a refactor depois do intake slideshow estar pronto. | Adiar até Fase 3 estabilizar. | — |
| B4 | Média | `/dashboard` 259L mistura KPIs + onboarding + (provavelmente) listas. | Quebrar em sub-componentes; grid denso 2-col em desktop. | M |
| B5 | Média | Mobile: AppShell tem nav fixo mas plan tabs + intake atual rebentam em <640px (a verificar). | Pass mobile dedicado depois de intake refeito. | M |
| C1 | Baixa | `Logo.tsx` + `BrandMark.tsx` coexistem — qual é canónico? | Documentar: BrandMark = chrome interno; Logo = landing/auth. | XS |
| C2 | Baixa | `ConciergeDock` + `concierge.functions` — usado? | Confirmar uso; se vivo, garantir lazy. | XS |
| C3 | Baixa | `manual.tsx` no secondaryNav — frequência real? Pode ir para footer. | Mover para footer do AppShell. | XS |
| C4 | Baixa | `i18n` carrega EN+PT eager; público é PT-first. | Lazy de namespaces não-críticos. | S |

Custos: XS <30min · S <2h · M ~½ dia.

---

## 3. Polimentos priorizados (Fase 2)

Ordem sugerida (cada item independente):

1. **A3 + A5** (XS) — lazy de jsPDF e OCR. Ganho imediato de bundle público.
2. **A2 + A4** (S) — lazy de DemoLab e recharts. Landing/auth ficam leves.
3. **A1** (S) — colapsar `/bancada` e `/forge` em `/dashboard`. Decisão de produto necessária (ver Q1).
4. **B1** (S) — sweep de status-tone com grep + substituições mecânicas.
5. **B2 + C1 + C3** (XS cada) — BrandMark consistency, doc Logo vs BrandMark, mover Manual para footer.
6. **B4** (M) — densificar dashboard em grid 2-col, separar onboarding.
7. **A6** (M) — auditoria de `plan.functions` legacy (depois do funil estar a funcionar, para não mexer em coisa viva).
8. **B5** (M) — pass mobile final, depois do intake slideshow.
9. **C2 + C4** — limpezas opcionais.

Empty states com voz PT (mem://design/voice-pt) são feitos à medida que se mexe em cada ecrã, não como sweep.

---

## 4. Intake slideshow — wireframe textual (Fase 3)

### Princípios
- Uma pergunta por ecrã. Card centrado, max-w 560px.
- Header fixo: BrandMark do PT (via `get_intake_branding`) + barra de progresso fina.
- Footer fixo: `← anterior` · contador `3 / 24` · `seguinte →` (Enter).
- Autosave debounced 600ms; chama `saveIntake` com `sections: [secção_atual]`.
- Tecla `Esc` abre "Guardar e continuar depois" (mostra que o link é válido 14d).
- Skip permitido em campos opcionais; obrigatórios bloqueiam `seguinte`.
- Animação: slide-fade lateral 180ms.

### Sequência de ecrãs (campo → FIELD_SCHEMA)

```text
S0  Boas-vindas               (sem campo)
    "Olá {first_name}. Vamos preparar a tua primeira sessão.
     São ~5 min. Podes parar e voltar quando quiseres."

═══ Secção: smart_goal ═══
S1  Objetivo específico        smart_specific           longText
S2  Como vais medir?            smart_measurable         shortText
S3  Até quando?                 smart_deadline           date YYYY-MM-DD

═══ Secção: readiness ═══
S4  Em que fase estás?          readiness_stage          enum (5 opções, cards visuais)

═══ Secção: training ═══
S5  Experiência                 experience_level         shortText (chips: nenhuma/<1ano/1-3/3+)
S6  Dias por semana             training_days_per_week   1..7  (slider grande)
S7  Duração por sessão (min)    session_duration_minutes 20..120 (slider)
S8  Onde treinas?               training_location        shortText (chips: casa/ginásio/outdoor/misto)
S9  Equipamento disponível      available_equipment      multi-chip (catálogo existente)

═══ Secção: lifestyle ═══
S10 Qualidade de sono           sleep_quality            1..10 (escala visual)
S11 Nível de stress             stress_level             1..10
S12 Energia diária              energy_levels            shortText
S13 Capacidade de recuperação   recovery_capacity        shortText

═══ Secção: nutrition ═══
S14 Hábitos alimentares         nutrition_habits         longText
S15 Água/dia (opcional)         extended.ext_water_l_per_day  number
S16 Refeições/dia (opcional)    extended.ext_meals_per_day    number
S17 Horas sentado/dia (opc)     extended.ext_hours_seated     number

═══ Secção: safety (CRÍTICO) ═══
S18 PAR-Q (7 perguntas Y/N)     parq_passed              bool (computed: true se todas N)
S19 Categoria ACSM              acsm_risk_category       enum low/moderate/high
       └ se "high" → S19b: aviso "consulta médica recomendada antes do treino"
S20 Medicação atual             medications              longText (opcional)
S21 Sinalizadores médicos       med_flags                multi-chip (catálogo)
S22 Lesões                      injuries                 longText (opcional)
S23 Condições médicas           medical_conditions       longText (opcional)
S24 Preferências/aversões       preferences              longText (opcional)

S25 Revisão                     mostra resumo por secção, "Editar" volta ao 1º ecrã da secção
S26 Submeter                    submit:true → estado submitted → ecrã "Obrigado"
```

### Condicionais
- **PAR-Q falhado** (qualquer Y nas 7): NÃO bloqueia submissão, mas marca `parq_passed:false` e mostra ecrã informativo "Vamos pedir-te apenas dados básicos e o teu PT vai contactar-te antes de avançar". Salta S20–S24 opcionais? Não — mantém, são úteis na consulta.
- **ACSM high**: banner persistente nos ecrãs seguintes; não bloqueia.
- **`training_days_per_week = 0`**: salta S7–S9 (não faz sentido).
- **Sem equipamento marcado em S9**: avisa "vamos assumir peso corporal".

### Copy PT (amostra, voz mem://design/voice-pt)
- S1: "O que queres conquistar?" subtítulo: "Concreto. Não vale 'ficar em forma'."
- S4: "Estás mesmo pronto para começar?" opções: *Ainda a pensar / Quase decidido / Já comecei / Já é hábito / Quero manter*
- S10: "Quanto dormiste, em média, esta semana?" 1=péssimo, 10=descansado.
- S18: "Algum destas situações se aplica a ti?" lista PAR-Q clássica.
- S26: "Pronto. O teu PT recebe isto agora e prepara a sessão."

### Componentes a criar
```text
src/components/intake/
  IntakeWizard.tsx          orquestrador (state, autosave, nav)
  IntakeStep.tsx            wrapper visual (header, footer, animação)
  IntakeProgress.tsx        barra fina + contador
  steps/
    StepWelcome.tsx
    StepText.tsx            (genérico para shortText/longText)
    StepEnumCards.tsx       (readiness, location)
    StepSlider.tsx          (1..10, days, minutes)
    StepChips.tsx           (single/multi)
    StepParq.tsx            (7 Y/N → computa parq_passed)
    StepReview.tsx
    StepThanks.tsx
  intake-schema.ts          ordem + dependências + mapping para FIELD_SCHEMAS
```

Nada de campos novos — tudo já existe em `FIELD_SCHEMAS` (`src/server/intake.functions.ts`) ou em `extended.*`.

---

## 5. Funil Assessment → Paywall → Premium (Fase 4)

### Estado atual confirmado
- `subscribers` com `subscribed`, `subscription_status`, `trial_end`, `current_period_end`.
- Trial 14d auto via `handle_new_user_trial`.
- Quota free: 1 plano finalizado (`plan_quota_used/limit` + `bump_plan_quota_on_complete`).
- Helpers: `has_active_access(uid)`, `can_create_more_plans(uid)`.
- Server-side gate: `checkPlanQuota()` em `quota.server.ts`.
- `STRIPE_SECRET_KEY` configurada. **Falta** `STRIPE_WEBHOOK_SECRET`.
- Tiers: Starter 8/8 · Pro 25/30 · Studio 60/80 (clients == plan-gens).

### Decisão: momento da paywall
**Recomendação: ao tentar criar o 2º plano (ou 1º depois do trial expirar).** Não no PDF. Não no signup. Razão: o utilizador precisa de viver o ciclo completo uma vez (intake→plano→PDF) para perceber valor. Bloquear no PDF seria desonesto (já gerou o plano, já gastou IA). Bloquear antes do `createPhasedPlan` é honesto: "este é o teu segundo plano, escolhe um tier".

### Decisão: Block N+1
**Conta como novo plano para a quota.** Razão: `archivePlanAndStartNextBlock` arquiva o anterior e roda o pipeline phased completo (custo de IA real). Tratar como gratuito seria buraco de abuso. Mostrar contador "Bloco 2 · usa 1 das tuas {limit} gerações deste mês".

### Produtos Stripe a criar (EUR, mensal + anual)
```text
Starter   €19/mês   €190/ano (-17%)   8 clientes / 8 planos/mês
Pro       €39/mês   €390/ano          25 clientes / 30 planos/mês
Studio    €79/mês   €790/ano          60 clientes / 80 planos/mês
```
(Valores indicativos — ver Q3.) Cada tier = 1 product + 2 prices. Total: 3 products, 6 prices. Metadata `tier: starter|pro|studio` no product para o webhook mapear.

### Arquitectura técnica

```text
src/server/billing.functions.ts        (já existe — auditar)
  createCheckoutSession(priceId)       → Stripe Checkout, mode:subscription
  createPortalSession()                → Customer Portal
  refreshSubscription()                → lê Stripe e atualiza subscribers (fallback se webhook falhar)

src/routes/api/public/hooks/stripe.ts  (NOVO)
  POST: verifica assinatura com STRIPE_WEBHOOK_SECRET (timingSafeEqual)
  Eventos:
    checkout.session.completed         → upsert subscribers (subscribed:true, price_id, tier)
    customer.subscription.updated      → atualiza status + current_period_end
    customer.subscription.deleted      → subscribed:false
    invoice.payment_failed             → subscription_status:'past_due'
  Usa supabaseAdmin.

src/routes/billing.tsx                 (já existe — completar)
  Mostra: tier atual, próximo pagamento, uso (X/Y planos, Z/W clientes)
  Botões: "Mudar plano" (Portal) · "Cancelar" (Portal) · upgrade direto

src/routes/pricing.tsx                 (NOVO ou subseção da landing)
  3 cards consistentes com landing, CTA "Começar trial 14d"
```

### UI states
- **Trial banner** (≤3 dias): topo do AppShell, amber, "Trial acaba em N dias · Escolher plano →".
- **Quota gasta** (free, depois de 1 plano): inline no botão "Novo plano" → desabilitado com tooltip + CTA "Upgrade".
- **TierChip** no header do AppShell (usar componente existente).
- **Past due**: banner vermelho persistente até pagamento.

### Arc completo (signup → desbloqueio)

```text
1. signup                  → handle_new_user (profile) + handle_new_user_trial (subscribers, trial_end +14d)
2. cria 1º cliente         → /clients + IntakeLinkPanel gera token
3. envia link (WA/email)   → cliente abre /intake/$token (slideshow)
4. cliente submete         → status submitted; PT vê alerta no /clients/$id
5. PT cria plano           → checkPlanQuota OK (trial OR quota_used<limit)
                           → phased pipeline → generation_status=complete
                           → trigger bump_plan_quota_used → 1
6. PT tenta 2º plano       → checkPlanQuota: !has_active_access && quota_used>=limit
                           → erro "quota_exceeded"
                           → UI: modal "Já criaste o teu primeiro plano. Escolhe um tier."
                           → CTA → Stripe Checkout
7. checkout.session.completed → webhook → subscribers.subscribed=true, tier=pro
8. user volta              → can_create_more_plans=true → cria 2º plano
9. block N+1               → mesma quota, mesmo gate
```

### Diagrama
Ver artefacto Mermaid abaixo.

---

## 6. Ordem de execução sugerida

```text
Sprint 1 (leveza imediata — 1 sessão)
  ├ A3 lazy jsPDF
  ├ A5 lazy OCR
  ├ A2 lazy DemoLab
  └ A4 lazy recharts

Sprint 2 (arrumação visual — 1 sessão)
  ├ A1 hub único (/dashboard); apagar bancada+forge
  ├ B1 sweep status-tone
  └ B2 BrandMark consistency

Sprint 3 (Intake slideshow — 2 sessões)
  ├ Aprovar wireframe
  ├ Construir IntakeWizard + steps genéricos
  └ Migrar campos por secção, preservar autosave/provenance

Sprint 4 (Funil — 2 sessões)
  ├ Criar produtos Stripe (3 products, 6 prices)
  ├ Auditar billing.functions; completar createCheckoutSession + createPortalSession
  ├ Webhook /api/public/hooks/stripe (pedir STRIPE_WEBHOOK_SECRET)
  ├ /pricing + completar /billing
  └ UI states: trial banner, quota modal, TierChip

Sprint 5 (polimento — 1 sessão)
  ├ B4 dashboard grid denso
  ├ B5 mobile pass
  └ A6 auditoria plan.functions legacy
```

---

## 7. Perguntas (preciso de resposta antes de Sprint 2 e 4)

**Q1 — Hub:** confirmas que `/dashboard` é o hub e que `/bancada` + `/forge` podem ser eliminados? Ou queres preservar algum conteúdo deles?

**Q2 — Bloco N+1 conta para quota?** A minha recomendação é sim (custo real de IA). Concordas?

**Q3 — Preços:** os valores €19/€39/€79 mensais (com -17% anual) são indicativos. Confirmas ou tens outros números? E queres oferecer só mensal, só anual, ou ambos no checkout?

**Q4 — Paywall trigger:** confirmas "ao tentar 2º plano" como momento? Alternativas: fim do trial, ou ao publicar PDF.

**Q5 — Manual no nav:** mover para footer ou manter no secondaryNav?

---

Quando responderes às perguntas (ou disseres "tu decides"), começo pelo Sprint 1 (lazy-loads — ganho imediato sem decisões pendentes).
