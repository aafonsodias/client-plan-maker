
# Plano — Sprint 3 + 4 + Auditoria competitiva

Antes de mexer em código, três decisões honestas: (1) o que cobramos, (2) o que nos falta vs concorrentes, (3) como funciona o intake e a paywall.

---

## 1. Pricing — competitivo mas honesto

### Como o mercado está em 2025/26

**Plataformas para PT (B2B, cobram ao treinador):**
- **TrueCoach Starter** $26/mês até 5 clientes; **Standard** ~$54/mês até 25.
- **Trainerize** desde ~$5/mês (1 cliente), $40+ tier intermédio.
- **Everfit** tier grátis até 5 clientes; pago $39+ a partir de 15.
- **CoachingPortal** grátis até 5 clientes (todas as features) — pressão agressiva no low-end.

**Apps AI consumer (cobram ao atleta):**
- Fitbod ~$13/mês, Gymgineer $10/mês ($60/ano), Freeletics $15/mês.

### Recomendação revista (vs. €19/€45/€119 actuais)

| Tier | Antes | **Proposta** | Anual (-17%) | Clientes / Gerações |
|---|---|---|---|---|
| Free | — | **€0** | — | 1 cliente, 1 plano (já existe via quota) |
| Starter | €19 | **€14** | €140 (≈€11.6/mês) | 8 clientes, 8 gerações, 1 escalação premium |
| Pro | €45 | **€29** | €290 (≈€24/mês) | 25 clientes, 30 gerações, 4 escalações |
| Studio | €119 | **€79** | €790 (≈€66/mês) | 60 clientes, 80 gerações, 12 escalações, 5 lugares |
| Top-up | €12 / 10 escalações | **mantém** | — | — |

**Porquê descer:** TrueCoach Standard a $54 é a referência psicológica. €29 Pro fica claramente abaixo, e como estamos focados no nicho "honest health coaching" (não é all-in-one com nutrição/billing/loja), tem que pesar no preço. €14 Starter compete com Trainerize entry. Se considerares isto agressivo demais, a alternativa segura é **€19 / €39 / €99**.

Source-of-truth continua EUR (Core memory). PriceTag mostra USD/BTC só para display.

---

## 2. Auditoria de gaps — o que apps de topo têm que tu não tens

Categorizei por **must-have para competir**, **nice-to-have**, e **deliberadamente fora do scope** (não fazemos, e está bem).

### Must-have a fechar antes de monetizar a sério

| Gap | Já tens? | Acção |
|---|---|---|
| **App móvel (PWA mínimo) para o cliente registar treinos** | Tens `/log/$token` web — falta installable PWA + push | Adicionar manifest.json + service worker; "Add to Home Screen" no fim do intake |
| **Biblioteca de vídeos de exercícios** | Não — só nomes em texto | MVP: link a YouTube por exercício (campo `video_url` em exercises). V2: biblioteca curada |
| **Mensagens trainer↔cliente** | Não | Não construir do zero. Botão "Abrir WhatsApp" com mensagem pré-formatada já cobre 80% do uso real |
| **Check-in semanal automático** | Tens `weekly-digest` + `dropoff-alerts` | Falta o cliente *responder* — adicionar form no `/log/$token` (RPE, peso, fotos opcionais) |
| **Progress photos** | Tens medidas + photo do perfil | Adicionar `progress_photos` table + upload no log do cliente |
| **Templates de plano reutilizáveis** | Cada plano é gerado do zero | "Save as template" no plan header; "Start from template" no plans.new |

### Nice-to-have (Sprint 5+)

- Macros / nutrição básica (não competimos com MyFitnessPal — só registo de peso + fotos)
- Habit tracking (sleep, steps) via integração HealthKit/Google Fit
- Pagamentos cliente→PT (Stripe Connect) — grande feature, deixar para depois
- White-label app com nome do PT

### Fora de scope — assumir e comunicar

- Loja de programas, marketplace, billing entre PT e clientes finais, vídeo-chamadas, AI form-check por câmara. Diferenciamo-nos por **plano honesto baseado em evidência**, não por feature parity.

---

## 3. Sprint 3 — Intake slideshow do cliente

Hoje o cliente abre `/intake/$token` e vê um form longo. Vamos transformar em **slideshow com 1 pergunta por ecrã**, estilo Typeform.

### Stages (mantém intake_responses schema actual)

```
1. Boas-vindas (nome do PT + foto + 1 frase)
2. Identidade (nome, idade, género)
3. Antropometria (altura, peso) — slider ou input grande
4. Objectivo principal (4 chips: emagrecer / hipertrofia / saúde / desporto)
5. Histórico (lesões — chips multi + texto livre)
6. Disponibilidade (dias/semana, minutos/sessão)
7. Equipamento (EquipmentMultiSelect já existe, reutilizar)
8. Saúde (PAR-Q simplificado — 5 sim/não)
9. Foto opcional (drag & drop, skippable)
10. Resumo + submit
```

### Decisões UX

- **Progress bar fina no topo** (toneChip neutral, accent quando completa).
- **Atalhos de teclado**: Enter = next, Esc = back. Mobile: swipe.
- **Auto-save** no Supabase a cada step (campo `intake_responses.draft_step` para retomar).
- **Validação inline** no botão Next, não em alerts.
- **Voz PT** (Core memory `voice-pt.md`) — perguntas curtas, segunda pessoa, sem jargão clínico.

### Ficheiros a criar

- `src/components/intake/IntakeSlideshow.tsx` (orchestrator)
- `src/components/intake/steps/Step01Welcome.tsx` ... `Step10Review.tsx`
- `src/components/intake/IntakeProgress.tsx`
- `src/lib/intake-schema.ts` (zod por step + ordem dos steps)
- `src/server/intake.functions.ts` — adicionar `saveIntakeStep()` (draft) e manter `submitIntake()`

### Migration DB

```sql
alter table public.intake_responses
  add column if not exists draft_step int default 0,
  add column if not exists draft_payload jsonb default '{}'::jsonb;
```

`/intake/$token` passa a renderizar o slideshow; o form actual fica como fallback `?legacy=1` durante 1 semana.

---

## 4. Sprint 4 — Paywall + Billing

### Decisões assumidas (vou avançar com isto, diz se queres mudar)

- **Trigger paywall:** ao tentar gerar o **2º plano** (free quota = 1) **OU** quando trial de 14 dias acaba. Já temos `checkPlanQuota()` → erro `quota_exceeded`. Falta interceptar no UI.
- **Bloco N+1 conta para quota:** sim (já era a recomendação aprovada).
- **Trial:** 14 dias com cartão exigido (reduz no-shows pós-trial vs. trial sem cartão).
- **Mensal e anual** ambos no checkout, anual destacado (-17%).

### Trabalho

1. **Componente `PaywallDialog`** — mostra tier actual, CTA para `/billing`, copy honesta ("Já criaste 1 plano grátis. Para continuar, escolhe um tier.")
2. **Interceptar erros** `quota_exceeded` em:
   - `plans.new.tsx` (botão Criar plano)
   - `clients_.$clientId.tsx` (botão "Bloco seguinte")
   - `BlockTransitionDialog.tsx`
3. **Banner no AppShell** quando `trialDaysLeft <= 3` (toneChip warn).
4. **Atualizar preços em `billing.tsx`** para os novos valores (€14/€29/€79).
5. **Stripe products & prices** — preciso criar via tool `stripe--create_stripe_product_and_price` (3 tiers × 2 intervalos = 6 prices). Verificar primeiro o que já existe com `stripe--list_products`.
6. **Atualizar `src/server/billing.functions.ts`** — mapear `tier+interval` para os novos `price_id`s (env vars: `STRIPE_PRICE_STARTER_MONTH`, etc.).

### Pré-requisito Stripe

Precisas confirmar: **Stripe já está habilitado neste projecto?** Se não, corro `payments--enable_stripe_payments` primeiro (vais preencher um form com email).

---

## 5. Ordem de execução

1. **Sprint 3 (intake slideshow)** — sem dependências externas, posso começar já.
2. **Auditoria gaps — quick wins**: campo `video_url` em exercises + botão WhatsApp no perfil cliente + "save as template" do plano. (~2h cada)
3. **Sprint 4 (paywall + billing)** — depende de confirmares: preços (€14/€29/€79 vs €19/€39/€99) e Stripe enabled.
4. **PWA mínimo** + check-in semanal do lado do cliente (Sprint 5).

---

## Perguntas para destrancar

1. **Preços:** vais com **€14/€29/€79** (agressivo, abaixo de TrueCoach) ou **€19/€39/€99** (margem maior, ainda competitivo)?
2. **Trial:** 14 dias **com cartão** ou **sem cartão**? (Com cartão converte 2-3× mais mas reduz signups iniciais.)
3. **Stripe:** já está enabled no projecto? Se não, quando responderes habilito.
4. **Quick wins de gaps:** queres que eu meta os 3 quick wins (vídeo URL, botão WhatsApp, save as template) **antes** ou **depois** do Sprint 4?

Diz-me as respostas e arranco com o Sprint 3 imediatamente (não depende de nada das perguntas).
