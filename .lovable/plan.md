# Redteam first, then a clean execution plan

You asked me to red‑team the prompt before doing anything. Here's what I'd push back on, then a tight plan that addresses it.

## Red‑team — what's risky in the request

1. **Right‑click to change currency is a UX trap.**
   - Right‑click on desktop = browser context menu. Hijacking it confuses users and is invisible on touch devices (most of your traffic).
   - Better: a small currency chip next to the price (click / tap), with right‑click as a *bonus* power‑user shortcut — not the primary affordance.

2. **"Bitcoin pricing" needs a definition.**
   - Showing a BTC equivalent (display only) is easy and free — fetch a rate, show `≈ 0.00021 ₿`.
   - *Accepting* BTC is a different project (wallet, on‑chain confirmations, refunds, accounting, tax). Out of scope for this pass — Stripe / Paddle don't natively settle BTC.
   - Recommendation: **display BTC equivalent now, defer "pay with BTC" until after we pick a payment provider.**

3. **IP‑based free‑plan limiting is a bad idea.**
   - False positives: families, dorms, coworking, corporate NAT, mobile carriers (CGNAT) — all share IPs.
   - False negatives: VPN / incognito / mobile data flip defeats it in 10 seconds.
   - GDPR: IP is personal data; storing it for abuse prevention needs a lawful basis and a privacy notice update.
   - **Better gate:** 1 free plan per *authenticated account* (email). It's the same friction for abusers (make a new email) but zero collateral damage. Add email verification + Google sign‑in (already in the stack) so throwaway emails cost something.
   - If abuse becomes real, layer on: device fingerprint (FingerprintJS), Turnstile/hCaptcha on signup, or rate‑limit by `email_domain + ASN`. Not now.

4. **"Free only gives one training plan" needs to be enforced server‑side.**
   - Client checks are theatre. The Stage‑5 bulk‑fill server function is where the gate has to live, otherwise anyone with devtools bypasses it.

5. **Pricing change without a payment provider is premature.**
   - You don't have Stripe/Paddle wired yet. Switching the *displayed* currency is fine, but be honest with users — show "billed in EUR" in fine print so we don't promise USD billing we can't deliver.

6. **"Subscribe to log and reap benefits" — define "benefits" before gating.**
   - If logging is gated, free users get a PDF and… nothing. That kills the activation loop (no logs = no progressions = no reason to come back = no conversion).
   - **Recommended gate instead:** free = 1 plan + read‑only PDF. Paid = unlimited plans + logging + progressions + history + future health metrics. Logging is the hook, not the wall.

---

## Plan — what I'll actually build

### Wave A — Currency switcher (display‑only, no payment yet)

**Files**
- `src/lib/currency.ts` (new) — currency registry, formatters, FX fetch + 24h cache in `localStorage`.
- `src/components/PriceTag.tsx` (new) — renders `19€`, `$21`, or `≈ 0.00021 ₿` based on selected currency.
- `src/components/CurrencyMenu.tsx` (new) — small popover triggered by **left‑click** on the `$` header icon AND on either price number; right‑click on those same targets opens it too (bonus, not required).
- `src/contexts/CurrencyContext.tsx` (new) — selected currency persisted in `localStorage`, default = browser locale (EUR for `pt-*`, USD otherwise).
- `src/routes/index.tsx` — replace static `t("…pricing.beta_price")` / `pro_price` strings with `<PriceTag eur={0} />` and `<PriceTag eur={19} />`. Keep Portuguese/English copy for the period suffix ("/ enquanto durar a beta", "/ mês").
- `src/components/AppShell.tsx` (or wherever the header `$` lives) — wire the icon to open `CurrencyMenu`.
- i18n: add `currency.billed_in_eur_note` ("Billed in EUR · USD/BTC shown for reference") in `pt` + `en`.

**FX source**
- Free, no key: `https://api.frankfurter.app/latest?from=EUR&to=USD` (ECB rates, EUR → USD).
- BTC: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur` (no key, generous free tier).
- Both fetched once, cached 24h. If fetch fails, fall back to a hardcoded approximate rate and show a tiny "rates approx." tooltip. Never block render on the network call.

**UX**
- Header `$` icon → opens menu with EUR / USD / BTC radio + "Billed in EUR" footnote.
- Right‑click on the `$` icon or on the price numbers → same menu (kept as a discoverability bonus per your request).
- Selection persists across pages.

### Wave B — "1 free plan per account" gate

**Schema** (one migration)
- `profiles` already exists per your DB. Add:
  - `plan_quota_used INT NOT NULL DEFAULT 0`
  - `plan_quota_limit INT NOT NULL DEFAULT 1`
  - `subscription_status TEXT NOT NULL DEFAULT 'free'` (`free` | `active` | `canceled`) — placeholder until payments land.
- Trigger `after_workout_plan_finalized` on `workout_plans`: when `generation_status` flips to `complete` for the first time, increment `profiles.plan_quota_used` for the trainer.

**Server enforcement**
- `src/server/phased/stage5-bulkfill.functions.ts` — at the top of the handler, fetch the caller's `profiles` row; if `subscription_status === 'free'` AND `plan_quota_used >= plan_quota_limit`, return a structured error `{ error: "quota_exceeded" }` instead of running the LLM.
- Same guard at the *start* of stage 1 (intake → blueprint) so we don't waste tokens on plans the user can't finish.

**Client UX**
- On `quota_exceeded`, show a modal: "You've used your free plan. Subscribe to create more, keep logging, and unlock progressions." with a CTA that today links to a "Notify me" mailto (matches the existing Pro card behavior) and tomorrow becomes the Stripe/Paddle checkout.
- Plans index page: if quota used and free, the "New plan" button becomes "Upgrade to create more" (same modal).

**What I'm NOT doing in this pass**
- No IP capture, no fingerprinting, no captcha. Pure account‑level gate.
- No actual payment integration — that's a separate decision (Paddle vs Stripe). I'll surface the recommendation in a follow‑up message after this lands.
- No "pay with BTC". Display only.
- Logging stays free for the user's one free plan (so they experience the hook). The wall is on *creating a second plan*, not on logging the first.

### Out of scope for this PR (flagged for later)
- Payment provider selection + checkout (needs your call: Paddle for global tax handling vs Stripe for flexibility).
- Subscription webhooks + entitlement sync.
- Per‑country pricing (USD ≠ EUR × FX in real SaaS pricing — usually you set it manually).
- Any fingerprint / IP / captcha layer.

---

## Technical notes

- All FX/BTC fetches are client‑side (no secrets, public endpoints, cached). No server function needed for Wave A.
- Wave B gate is enforced inside `createServerFn` handlers using the existing `requireSupabaseAuth` middleware, so RLS still applies and the check can't be bypassed from the client.
- Migration uses a `BEFORE UPDATE` trigger on `workout_plans` to detect the `generation_status` transition `!= 'complete' → 'complete'` and increment the trainer's quota atomically. No race because it runs in the same transaction as the update.
- `PriceTag` accepts `eur: number` as the source of truth so we never store prices in multiple currencies.

## Open question (one)

For BTC display, do you want:
- **(a)** the *symbolic* equivalent of the EUR price (`19€ ≈ 0.00021 ₿`) — honest, useful, no commitment, **my recommendation**, or
- **(b)** a separate "BTC tier" priced in sats that doesn't move with FX?

I'll default to (a) unless you say otherwise. Approve the plan and I'll execute Wave A + Wave B in one pass.