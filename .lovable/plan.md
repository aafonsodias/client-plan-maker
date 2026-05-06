# Round 71 — Pricing toggle anual + reforço Studio

Fecha **R62 #2 (P1)** do backlog. A secção `pricing` da landing hoje só mostra dois cards (Beta grátis · Pro €19/mês), ambos mensais e sem comparação real entre tiers. O backlog pede:
1. Toggle Mensal ↔ Anual com -17% (~2 meses grátis), padrão da indústria.
2. Reforço do tier **Studio** (hoje invisível na landing — só existe em `billing.tsx`).

Próxima ronda P0 que importa para vender, sem tocar motor nem PDFs.

## Objetivo
- Trainer abre landing → vê 3 tiers (Starter / Pro / Studio) com toggle Mensal/Anual, "Mais popular" no Pro, comparação honesta de quotas (clientes/planos/mês).
- Conta-bar "−17% no anual · 2 meses grátis" perto do toggle.
- Studio ganha presença visual igual aos outros (não como afterthought).

## Mudanças

### 1. `src/routes/index.tsx` — secção pricing reescrita
- Substituir `<div className="grid gap-6 md:grid-cols-2">` por grid de 3 cards (`md:grid-cols-3`).
- Acima do grid: `<PricingToggle billing={billing} onChange={setBilling} />` com chip "−17%" no lado anual.
- Cada card lê preço de `PRICING_TIERS` (novo, abaixo) e mostra:
  - Nome (Starter / Pro / Studio)
  - Preço via `<PriceTag eur={price[billing]} />` + período
  - Quota: "8 clientes · 8 planos/mês" / "25 · 30" / "60 · 80" (consistente com Core memory)
  - 4-5 features curtas
  - CTA: Starter → /auth (start free trial); Pro → /auth (default); Studio → mailto agora (até pagamento estar live com Stripe — ver risco)
- Manter "Beta privado · 1 plano grátis" como uma faixa acima do grid (não como card), para não confundir com tier pago.
- Card central (Pro) com border accent + "Mais popular" pill amber (status-tone neutro).

### 2. `src/lib/pricing-tiers.ts` (novo, ~40 LOC)
Source-of-truth dos preços. Alinha com `billing.tsx` (que já tem os números) — extrair para que landing + billing leiam do mesmo sítio. Hoje `billing.tsx` tem-os inline; vou ler esse ficheiro e exportar.
```ts
export type Billing = "monthly" | "annual";
export const PRICING_TIERS = [
  { id: "starter", name: "Starter", monthly: 9, annual: 90, clients: 8, plans: 8, features: [...] },
  { id: "pro", name: "Pro", monthly: 19, annual: 190, clients: 25, plans: 30, popular: true, features: [...] },
  { id: "studio", name: "Studio", monthly: 49, annual: 490, clients: 60, plans: 80, features: [...] },
] as const;
export const ANNUAL_DISCOUNT_PCT = 17;
```
Annual = monthly * 10 (i.e. 2 meses grátis ≈ -17%).

### 3. `src/components/landing/PricingToggle.tsx` (novo, ~50 LOC)
- Segmented control (Mensal | Anual −17%) — design tokens, sem cor custom.
- Chip "2 meses grátis" amber discreto ao lado quando "Anual" activo.
- Acessível: `role="radiogroup"`, setas keyboard.

### 4. i18n — `src/i18n/locales/{pt,en}/plan.json`
Adicionar bloco `landing.pricing.tiers.{starter,pro,studio}` (name, badge, features[]) e `landing.pricing.toggle.{monthly,annual,discount_chip,save_badge}`. Manter chaves antigas (`beta_*`, `pro_*`) durante uma ronda para evitar quebra noutras superfícies — apagamos na próxima.

### 5. `src/routes/billing.tsx` — sync com source-of-truth (small)
Refactor mínimo: substituir hardcoded prices pelo `PRICING_TIERS` para landing e billing nunca divergirem. **Sem mudar UI**, só leitura. Se for risco, parqueio para R72 e deixo só a landing nesta ronda.

### 6. `.lovable/backlog.md`
Marcar **R62 #2 ✅** + adicionar secção "Round 71" com closed items.

## Honestidade
- Anual = `monthly × 10` (16.6% off real). Evito "−20% marketing". Chip diz "−17% · 2 meses grátis", que é o cálculo certo.
- Studio CTA = mailto até Stripe estar configurado para o tier (R62 #2 não inclui pagamento). Marcado discretamente como "Falar com o autor" até lá. Sem chip "Em breve" (que enfraquece a venda) — só o canal.
- Não invento features. Reuso o que já está em `billing.tsx`.

## Risco / fora de scope
- **Não** mudo `checkPlanQuota`, `subscribers` schema, Stripe webhooks, ou trigger `subscription_tier → plan_quota_limit`. Tudo isso já existe (R23 fechado).
- **Não** adiciono pagamento anual real. Ronda separada (precisa price IDs novos no Stripe).
- **Não** mexo na lógica `subscribers.subscribed/trial_end` nem em `has_active_access()`.
- Mantenho `<PriceTag/>` como única superfície de preço (Core memory: EUR source-of-truth).

## Mobile (375px primeiro)
- Toggle full-width acima do grid.
- Cards empilham 1-col abaixo de `md`, "Mais popular" do Pro mantém border accent.
- Faixa "Beta · 1 plano grátis" é uma `<div>` fina (não card) para não roubar altura.

## Próxima ronda (R72) sugerida
- Stripe price IDs para tier anual (Studio + Pro), webhook update.
- Storyboards 5 vídeos curtos (R62 #3).
- Funnel analytics básico (R62 #4).
