## Plano de execução — ordem por impacto

Sprint 3 (intake slideshow) está feito. Resta o que mais move agulha: **monetização** (sem isto não há receita) → **fechar gaps competitivos óbvios** → **polimento**.

Vou avançar nesta ordem e parar quando não houver mais nada de alto impacto. Aviso no fim.

### Decisões assumidas (corrige-me se quiseres outra coisa)

- **Preços**: €19 / €39 / €79 mensal, com opção anual a -2 meses (€190 / €390 / €790). Posiciona-se abaixo do TrueCoach (~$25-50) sem ser "preço de saldo".
- **Trial**: 14 dias **sem cartão** (já é o que `handle_new_user_trial` faz). Mais signups, conversão pela qualidade do output. Paywall aparece quando trial acaba OU quando tenta gerar 2º plano sem subscrição.
- **Tax**: Stripe **automatic_tax** (calcula+coleta, eu não trato de filing). VAT EU é o ponto sensível.

---

### Fase 4 — Monetização (impacto máximo)

**4.1 Stripe enable + 3 produtos/preços**
- Habilitar integração Stripe (já tenho `STRIPE_SECRET_KEY` no projecto, mas é preciso correr o tool oficial para wiring).
- Criar 6 prices: Starter mensal/anual, Pro mensal/anual, Studio mensal/anual em EUR.
- Guardar mapping `tier → price_id` em `src/lib/billing-tiers.ts` (single source of truth).

**4.2 Edge functions de billing**
- `create-checkout` — sessão Stripe Checkout, modo subscription, redirect `/billing/success`.
- `check-subscription` — lê stripe.subscriptions, escreve em `subscribers` (já existe), devolve `{subscribed, tier, current_period_end}`.
- `customer-portal` — billing portal session para gestão/cancelamento.
- `verify_jwt = true` em todas (são autenticadas).

**4.3 Paywall server-side**
- `checkPlanQuota()` em `src/server/quota.server.ts` já existe e gera `quota_exceeded`. Falta:
  - Trigger no client em `plans.new.tsx` / `startPhasedPlanDraft` → mostrar `<PaywallDialog/>` em vez de toast genérico.
  - Novo componente `src/components/PaywallDialog.tsx` com 3 tiers, CTA "Continuar" → `create-checkout`.
  - Banner no AppShell quando `trial_end` < 3 dias.

**4.4 Página `/billing` upgrade**
- Mostrar plano actual (de `subscribers`), uso (`profiles.plan_quota_used/limit`), trial countdown.
- Botão "Gerir subscrição" → `customer-portal`.
- Tabela comparativa dos 3 tiers com toggle mensal/anual.

**4.5 Hook global de subscrição**
- `useSubscription()` em `src/hooks/useSubscription.ts` — invoca `check-subscription` ao login + a cada 60s + após retorno do checkout. Cache em React Query.

---

### Fase 5 — Quick wins competitivos (alto ROI, baixo custo)

Auditoria competitiva identificou 3 gaps que dão para fechar rápido sem inflar o produto:

**5.1 Vídeo de exercícios** (TrueCoach/Trainerize têm)
- Coluna `video_url` em `workout_plan_days.content[].exercises[]` (já é jsonb, sem migração).
- Input no editor de plano + render `<VideoEmbed/>` (YouTube/Vimeo) na vista do cliente e no PDF (link clicável).

**5.2 Templates de plano** (poupar tempo aos PTs)
- Tabela `plan_templates(id, trainer_id, name, plan_data jsonb, created_at)` + RLS.
- Botão "Guardar como template" em `/plans/$id`.
- "Novo plano a partir de template" no fluxo `/plans/new`.

**5.3 Botão WhatsApp no perfil do cliente**
- Em `clients_.$clientId.tsx`, se `clients.phone` existir, botão `wa.me/{phone}?text={mensagem pré-preenchida com link do plano}`.
- Zero backend, 1 componente.

---

### Fase 6 — Polimento (se sobrar margem)

- **PWA básica**: `manifest.webmanifest` + service worker mínimo (instalável no telemóvel, sem offline complexo). Trainerize tem app nativa; isto fecha 60% do gap percebido.
- **Status-tone audit**: substituir cores hardcoded por `toneChip/toneDot` de `src/lib/status-tone.ts` em `clients.tsx`, `plans.$planId.tsx`, dashboards.
- **i18n EN sweep**: garantir paridade PT/EN nos novos componentes (paywall, billing, templates).

---

### Detalhes técnicos

```
src/
├── lib/billing-tiers.ts          # mapping tier→price_id
├── components/PaywallDialog.tsx  # modal de upgrade
├── components/TrialBanner.tsx    # banner header
├── hooks/useSubscription.ts      # hook global
└── routes/billing.tsx            # upgrade

supabase/functions/
├── create-checkout/
├── check-subscription/
└── customer-portal/
```

Migration nova:
```sql
CREATE TABLE public.plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  name text NOT NULL,
  plan_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainers manage own templates" ON public.plan_templates
  FOR ALL USING (auth.uid() = trainer_id) WITH CHECK (auth.uid() = trainer_id);
```

### Ordem de execução

1. Fase 4 completa (Stripe + paywall + /billing) — bloqueia receita, vai primeiro
2. Fase 5.1 (vídeos) → 5.2 (templates) → 5.3 (WhatsApp)
3. Fase 6 se ainda fizer sentido

Aviso quando acabar (ou quando precisar de input — ex: confirmar prices na Stripe).