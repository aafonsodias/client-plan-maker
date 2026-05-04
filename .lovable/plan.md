## Context: how the product works (confirming your model)

- **Who pays**: PTs (subscription) and self-coached individuals who want AI-assisted plan generation/safety checks. Confirmed.
- **Client intake link**: belongs to a paying PT. Their clients fill it, then get an account that lets them see *their* plan + logbook (read/log only).
- **PT view = client view**: I'll add a "Ver como cliente" toggle on `/clients/$id` so you (PT) can preview exactly what the client sees on `/me`. No need to build a separate UI — same component, scoped data.
- **Stats DB seed**: every submitted intake already lands in `assessments` + `clients`. No extra work needed — the longitudinal dataset accrues naturally as PTs onboard clients.

Wearables (Xiaomi/Garmin/etc.) deferred — agreed, not blocking sales.

---

## P0 — bugs blocking sale

### 1. Founder hits "Atingiu o limite do plano gratuito" (CRITICAL)

Root cause found: `src/server/quota.server.ts` calls `supabase.rpc("can_create_more_plans")` through the authenticated client. The RPC returns null (not `true`) in that context, the code falls through, and the fallback only reads profile and returns `ok:false` regardless of whether `used<limit` or the user has access. Network log confirms: `used:15, limit:999999`, `subscribed:true` — should obviously pass.

**Fix**: rewrite `checkPlanQuota` to be explicit:
1. Read `subscribers` row → if `subscribed` true (and not expired) OR `trial_end > now` → `ok:true`.
2. Read `profiles.plan_quota_used/limit` → if `used < limit` → `ok:true`.
3. Otherwise `ok:false` with used/limit.

No more reliance on the broken RPC. Founder, paying PTs, and free-tier-with-quota-left all pass.

### 2. Three identical "+ Novo cliente" / "Adicionar cliente" buttons on dashboard

Confirmed in your screenshot. Dedupe to **one** primary action in the hero. Remove:
- The bare "+ Novo cliente" strip below the hero card (lines 187–197 in `dashboard.tsx`).
- The duplicate "Adicionar cliente" inside the `DashboardHint` how-it-works card (it already explains the 3 steps; the hero CTA covers the action).
- The empty-state "Adicionar cliente" inside "Ainda não há planos" — keep that one only when there are zero clients; if `clients > 0`, change to "Ver clientes".

Keep: hero `+ Novo cliente` (top-right) + the "Copiar link de avaliação · André" quick action (because that's a different action, not a duplicate).

### 3. Top bar text truncation at 830px ("Dash…", "Cli…", "Faturação", etc.)

The `lg:` breakpoint shows icons + truncated labels because `xl:inline` hides them only past 1280px. At 830–1279 the labels render but get clipped by `truncate`. Fix: at `lg`-only show **icon-only** with `title` tooltip (drop the label span entirely below `xl`). Already partly true for primary nav; same pattern needs applying to "Faturação", "Página inicial", "Terminar sessão", "Partilhar". Result at 830px: clean icon row, no ellipsis.

Also: the founder badge currently shows just the sparkle icon below xl — that's fine, but tighten the gap so it doesn't crowd "F…" brand truncation. Bump the brand `truncate` min-width so "FORGE" never truncates to "F…".

---

## P0 — UX polish you flagged

### 4. Rebrand "O seu estúdio de treino"

The label feels generic. Replacements I'll wire (PT-aware):
- `Welcome back, {firstName}` eyebrow
- Headline: **"A sua oficina"** (matches the new "Oficina" tier name + your craft positioning) or **"O seu estaleiro"** if you prefer a more grounded shipyard metaphor.

I'll go with **"A sua oficina"** — coherent with tier naming, honest, not corporate. (Memory rule: "honest craft tool".) If you hate it, one-line change.

### 5. SMART goal — more suggestions, equipment-style chips with legend

Current: `interpretGoal` returns 3 measurable + 3 deadline. Bump to **6 measurable + 5 deadline**, render as flat colour-coded chip grid (no subheaders) with a category legend row mirroring the equipment slide:
- 🟢 emerald = body composition
- 🔵 blue = performance (strength/endurance)
- 🟡 amber = health/clinical
- ⚪ neutral = lifestyle/habit
- ⬜ muted = "Outro" free-text

Same `CAT_TONE` mapping used in the equipment picker.

### 6. Movement spider chart → health-relevant + age/gender norm overlay (memento-mori style)

Current `MuscleVolumeRadar` only shows the trainee's score. Plan:
- Axes stay: Squat / Hinge / Push / Pull / Carry / Lunge (ACSM-aligned movement competencies).
- Add **two overlay rings**:
  - **Peer band** (dashed, semi-transparent): typical score for same age decade + sex. Seeded from ACSM 12e norms in `.lovable/acsm-12e-source.txt` (already in repo).
  - **Lifetime peak band** (faint amber): typical 25-y-old benchmark for that sex. The "where you could still be" line.
- Score derivation: combine `formScore` (technique) + `capacity` percentiles per pattern → 0-100. Colour the trainee polygon by tier (green/amber/red).
- Add a one-line caption: *"Você está em P{percentile} para {age}-{sex}. Pico vitalício ~{peakScore}."* — that's the memento-mori beat without being morbid.

Norms table lives in `src/lib/movement-norms.ts` (new). Sourced from ACSM 12e percentile tables; documented in code.

### 7. Self-log onboarding pattern

When a self-coached user signs up (no PT), they go through the same intake but the "Powered by {trainer}" footer hides and the thank-you copy switches to "A tua AI vai usar isto para construir o teu plano." Quota and paywall behave identically. (Already 80% wired by the `intake_path: 'self_log'` work — just verify the welcome/thanks copy branches.)

### 8. PT-as-client preview

Add a small "Ver como cliente" link on the client header (`/clients/$id`). Opens `/me?as={clientId}` — same `/me` route, but if the viewer is the trainer that owns the client, it renders read-only with the client's data. Lets you dogfood the client surface without juggling browsers/emails.

---

## Out of scope this round (will land next)

- Wearable sync (Xiaomi/Garmin) — deferred per your call.
- Spider-chart longitudinal lines (block-over-block evolution overlay).
- Certified-photo badge.
- Client-side write surfaces (logbook entries, messaging) — read-only `/me` first, write next round.

---

## Files I'll touch

`src/server/quota.server.ts` (rewrite), `src/routes/dashboard.tsx` (dedupe CTAs, rename hero), `src/components/AppShell.tsx` (icon-only at lg), `src/i18n/locales/{pt,en}/{common,intake}.json` (copy), `src/server/intake-ai.functions.ts` (more SMART suggestions), `src/routes/intake.$token.tsx` (chip grid + legend), `src/lib/movement-norms.ts` (new — ACSM table), `src/components/volume/MuscleVolumeRadar.tsx` (overlays + caption), `src/routes/me.tsx` + `src/routes/clients_.$clientId.tsx` (PT preview link).

## On publish

Yes — to let real clients reach the app you publish once. After that the preview URL (id-preview-…) and published URL are independent: each publish snapshots the current preview. You keep iterating in Lovable; the live site only updates when you press Publish again.
