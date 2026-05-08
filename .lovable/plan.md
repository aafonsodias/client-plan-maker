## Goal
On the landing pricing section, both toggle states show a **per-month** price. Annual is cheaper/month and noted as "billed annually". Monthly is the higher per-month price billed every month. No backend / Stripe / quota changes — pure marketing presentation.

Today the cards show `190€/yr` with a small `≈ €15.8/mo` underneath when "Annual" is selected, which buries the value. We'll flip that: the big number is always the per-month figure; the secondary line carries the billing cadence + total.

## Changes

### 1. `src/routes/index.tsx` — pricing card rendering (lines ~292–335)
- Big number: always `monthlyEquivalent(tier, billing)` (rounded to 1 decimal, or integer when whole), suffix `/mês`.
- Secondary line:
  - **Monthly:** `Faturado mensalmente`.
  - **Annual:** `Faturado anualmente · €{annual}/ano · poupa €{monthly*12 - annual}` (compact).
- When `billing === "annual"` add a tiny amber chip on the card itself: `−17%`.
- Drop the now-redundant `monthly_eq` line.

### 2. `src/components/landing/PricingToggle.tsx`
- Relabel options to make the offer obvious:
  - Monthly → `Mensal` (unchanged).
  - Annual → `Anual (−17%)`.
- Keep the existing `−17% · 2 meses grátis` chip beside the toggle when annual is active.
- Default state in `index.tsx` stays `"annual"` so first impression is the cheaper number.

### 3. i18n keys (`plan.json`, all 4 locales: pt, en, es, hi — pt is the source, the others get LLM translations of the same keys per Core memory)
- `landing.pricing.per_month` → `mês` (already exists, keep).
- `landing.pricing.billed_monthly` → `Faturado mensalmente`.
- `landing.pricing.billed_annually` → `Faturado anualmente · €{{total}}/ano`.
- `landing.pricing.savings` → `Poupa €{{amount}}/ano`.
- Remove (or stop using) `landing.pricing.per_year` and `landing.pricing.monthly_eq`.

### 4. No changes to
- `src/lib/pricing-tiers.ts` — math is already correct (`monthlyEquivalent` returns annual/12).
- `src/server/billing.functions.ts` — Stripe prices unchanged, checkout still uses `interval: "year"|"month"` correctly.
- `/billing` route — internal account page, separate concern; not in scope unless you want it aligned too (say the word and I'll mirror it in the build step).

## Numbers (sanity check)
| Tier | Monthly billing | Annual billing (per month) | Annual total | Savings/yr |
|---|---|---|---|---|
| Starter | €19/mo | €15.8/mo | €190 | €38 |
| Pro | €45/mo | €37.5/mo | €450 | €90 |
| Oficina | €119/mo | €99.2/mo | €1190 | €238 |

## Out of scope
- Billing page (`/billing`) styling — separate pass if requested.
- Stripe price IDs / quotas / tier names — untouched.