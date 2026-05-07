# R77 — MVP Launch Gate

Audit only. No code, schema, prompt, or i18n changes in this round.
Read-only inspection of quota, payment, intake, WhatsApp, and schedule readiness.

---

## 1. Executive summary

- Private beta is **not safe yet** — verdict AMBER.
- Biggest cost leak: `checkPlanQuota()` runs **only at plan-row insertion** (`createPhasedPlan`, `startPhasedPlanDraft`, `startQuickPlan`). Every downstream AI stage (`synthesizeBrief`, `generateBlueprint`, `generateMicrocycleDays`, `generateDay`, `proposeProgressions`, `bulkFillRemainingWeeks`, `programNextWeek`, `escalatePlanDay`, `discussBlueprint`, `regeneratePlanSummary`, microcycle edit, legacy `generatePlanDraft/Week/Day`, `analyzeAssessmentSection`, `archivePlanAndStartNextBlock`) only checks ownership. A free user who never hits "Finalize" can re-fire AI on the same draft indefinitely; quota is bumped only by `trg_bump_plan_quota` on `generation_status='complete'`.
- Smallest required fix: quota **reservation** at first AI call + per-row **generation lock** + per-stage **retry cap** + Stripe **webhook**.
- Stripe is partially ready: Checkout, customer portal, `subscribers` upsert, EUR prices, tier→quota sync trigger all exist. Missing: signature-verified webhook (entitlement currently depends on user-triggered `checkSubscription` poll, leaving a 0–60s gap after checkout).
- Intake links are safe — public token does **not** trigger AI; trainer must explicitly start generation.
- WhatsApp must remain deeplink-only (`MessageComposerSheet`). Cloud API parked.
- Google Calendar OAuth: parked. Internal `/schedule` already covers MVP.
- Recommended R78: quota reservation + generation lock + retry cap + Stripe webhook. ~10–14 credits.

---

## 2. Launch verdict

**AMBER.**

Blockers (P0):
1. AI stages downstream of insertion do not check quota → unlimited free spend on drafts.
2. No generation lock → two tabs can fan out parallel `generateMicrocycleDays` on the same plan, doubling spend.
3. No Stripe webhook → entitlement only updates when the user reopens `/billing` and `checkSubscription` runs.

Non-blockers: intake (no AI), WhatsApp (deeplink), schedule (manual), PDF, R76 overlay (parked).

Fastest path to GREEN: ship R78, then R79 (paywall + webhook-pending UX), then a 30-min smoke pass.

---

## 3. Current quota flow

**Actual flow today:**

```
UI click → createPhasedPlan / startPhasedPlanDraft / startQuickPlan
            ├─ ownership check
            ├─ existing-draft-for-this-client check (if found, REUSE, no quota check)
            ├─ checkPlanQuota()   ← ONLY GATE
            └─ INSERT workout_plans (status=draft, generation_status=pending)

UI click → synthesizeBrief / generateBlueprint / generateMicrocycleDays /
           generateDay / proposeProgressions / bulkFillRemainingWeeks /
           programNextWeek / discussBlueprint / regeneratePlanSummary /
           escalatePlanDay / archivePlanAndStartNextBlock /
           analyzeAssessmentSection / microcycle-edit AI / legacy generatePlan*
            ├─ ownership check
            ├─ AI call (cost incurred)
            ├─ generation_log INSERT (when wrapped)
            └─ workout_plans UPDATE

UI click → finalizePlanGeneration
            └─ generation_status='complete'
                └─ trg_bump_plan_quota → profiles.plan_quota_used += 1
```

**Required flow:**

```
expensive entry → ownership → checkPlanQuota(used+reserved < limit)
                            → acquireGenerationLock(plan_id, owner=userId, ttl=2h, idempotency_key)
                            → reservePlanQuota(plan_id) (idempotent on first AI call)
                            → retryCap.checkAndIncrement(stage)
                            → AI call
                            → generation_log INSERT
                            → releaseGenerationLock
finalize → consumePlanQuota (reservation → used)
hard fail / abandon → releasePlanQuota (decrement reserved)
```

Specific answers:

| Question | Answer |
|---|---|
| Where is quota checked? | `quota.server.ts::checkPlanQuota`, 4 sites only. |
| Before expensive AI work? | No — only at insert. |
| Before every AI stage? | No. |
| Before finalization? | No. |
| When consumed? | At `generation_status='complete'` via trigger. |
| Drafts without consuming? | Yes — unlimited until finalize. |
| Retry expensive stages? | Yes — unlimited. |
| Regenerate successful stages? | Yes — no cap. |
| Two browser tabs parallel? | Yes — no row lock. |
| Concurrent clicks bypass? | Yes. |
| Quick plan bypass? | No. |
| Repair / critic / regen bypass? | Yes. |
| Demo plans excluded safely? | Yes — `is_demo` filter. |
| AI calls always logged? | Mostly; legacy paths inconsistent. |
| Failed AI calls logged? | Partially. |
| Cost tracked? | `plan-cost.server.ts` exists, not enforced. |
| Server-side attempt cap? | None. |

---

## 4. Expensive-path map

| File / function | AI cost | Current protection | Missing | Abuse | Fix | Priority |
|---|---|---|---|---|---|---|
| `stage1-brief::createPhasedPlan` | low | ownership + quota | reservation | per-client uniqueness only | reserve | P0 |
| `stage1-brief::startPhasedPlanDraft` | medium | ownership + quota | reservation, lock | spam new clients | reserve + lock | P0 |
| `stage1-brief::synthesizeBrief` | high | ownership only | quota, lock, retry cap | re-fire on draft | full guard | **P0** |
| `stage2-blueprint::generateBlueprint` | high | ownership only | quota, lock, retry cap | re-fire | full guard | **P0** |
| `stage2-blueprint::discussBlueprint` | medium | ownership | daily cap | unlimited chat | daily cap | P1 |
| `stage3-microcycle::generateMicrocycleDays` | **critical** | ownership only | quota, lock, retry cap | parallel tabs × N | full guard + lock | **P0** |
| `stage3-microcycle::generateDay` | high | ownership only | quota, lock | per-day spam | full guard | **P0** |
| `stage4-progressions::proposeProgressions` | low | ownership | lock | parallel writes | lock only | P1 |
| `stage5-bulkfill::bulkFillRemainingWeeks` | low | ownership | lock | parallel writes | lock only | P1 |
| `program-next-week::programNextWeek` | low | ownership | lock | duplicate weeks | lock | P1 |
| `microcycle-edit::*` | none–medium | ownership | lock on AI variants | concurrent edits | lock | P1 |
| `plan::generatePlanDraft|Week|Day` (legacy) | high | ownership | quota, lock | legacy entry reachable? | guard or remove | **P0** if reachable |
| `plan::regeneratePlanSummary` | medium | ownership | daily cap | spam | cap | P1 |
| `plan::escalatePlanDay` | medium | ownership | daily cap, premium gate | spam | cap + premium | P1 |
| `quick-plan::startQuickPlan` | high | ownership + quota | lock, reservation | parallel tabs | lock + reserve | **P0** |
| `pre-stage::analyzeAssessmentSection` | medium | ownership | daily cap | section spam | cap | P1 |
| `blocks::archivePlanAndStartNextBlock` | high | ownership | quota, lock | next-block spam | full guard | **P0** |
| `templates::*` | low | quota | reservation | reuse drafts | reserve | P1 |
| `intake.$token.tsx` | none | token validity | rate limit | spam POSTs | upstream WAF | P2 |
| `log.$token.tsx` | none | token validity | rate limit | spam logs | upstream | P2 |
| AskForge / Concierge | medium if AI | unknown | gating | unlimited prompts | scope to paid | P1 |
| Demo seeding | high | founder/admin only | already gated | — | keep | n/a |
| PDF export | none | ownership | — | — | — | n/a |

---

## 5. Bankruptcy-risk map

- **Critical:** `generateMicrocycleDays`, `synthesizeBrief`, `generateBlueprint`, `generateDay`, `startQuickPlan` (parallel), `archivePlanAndStartNextBlock`, legacy `generatePlanDraft/Week/Day`.
- **High:** `discussBlueprint`, `escalatePlanDay`, `regeneratePlanSummary`, `analyzeAssessmentSection`, AskForge if AI-backed.
- **Medium:** stage4/5 deterministic generators, `programNextWeek`, microcycle-edit AI variants.
- **Low:** insertion-only entries already gated; PDF; templates; intake/log public POST; schedule.

Direct patch for every critical/high: server-side wrapper that runs `checkPlanQuota` → acquire row-lock with TTL → reserve quota if first AI call → retry-cap check → call existing handler. One helper, applied in ~12 files.

---

## 6. Anti-abuse MVP model

- Auth required before any AI call. No anonymous endpoints. (Already true.)
- Per-row generation lock: `workout_plans.generation_lock_acquired_at`, `generation_lock_owner`, TTL 2h. Conditional UPDATE so only one tab wins.
- Idempotency key per intent; cached result on replay via `generation_log.idempotency_key`.
- Free-plan reservation: `profiles.plan_quota_reserved` int. Increment on first AI call for a draft; decrement on hard-delete or 7-day staleness. Quota check = `used + reserved < limit`.
- Retry cap per stage: `generation_state.retries[stage]`. Free=1, paid=3.
- Daily attempt cap: `profiles.attempts_today` + `attempts_reset_at`. Free=2 full generations / 24h; paid unlimited within tier monthly cap.
- Monthly finalized plan cap: already enforced by `tier_to_plan_quota` + `sync_plan_quota_from_subscriber`.
- Lock TTL: 2h auto-expiry checked on next acquire.
- No auto-generation from public links (already true).
- AskForge: gate behind paid OR cap free at 5 messages/day.
- Demo Lab: founder/admin only.

| Setting | Free | Paid |
|---|---|---|
| Finalized plans total | 1 | tier monthly cap |
| Active reservations | 1 | tier cap − used |
| Full generation attempts / 24h | 2 | unlimited within monthly cap |
| Per-stage retries | 1 | 3 |
| Lock TTL | 2h | 2h |
| Manual regen after finalize | no | yes |
| AskForge | gated | included |

---

## 7. Quota reservation model

Choose **model D** (reserve at start, consume on finalize, release on hard failure / abandon).

- Current schema: `profiles.plan_quota_used`, `plan_quota_limit`. No `plan_quota_reserved`.
- No-schema MVP path: store flag in `workout_plans.generation_meta.reserved_quota` and count drafts. Workable but adds a count on every check.
- Recommended: small additive migration — `profiles.plan_quota_reserved int default 0` + `workout_plans.quota_reserved bool default false`.
- Parallel reservation prevention: `UPDATE profiles SET plan_quota_reserved = plan_quota_reserved + 1 WHERE user_id=$1 AND (plan_quota_used + plan_quota_reserved) < plan_quota_limit RETURNING ...` and check rowcount.
- Release on hard failure: wrapper sets `quota_reserved=false` + decrements reserved on terminal AI error.
- Expire abandoned: lazy sweep on next quota check for `quota_reserved=true AND updated_at < now() - 7d AND generation_status <> 'complete'`.
- Retry abuse: bounded by per-stage retry cap.
- Paid monthly counting: unchanged (subscribers + tier_to_plan_quota).
- Demo plans: `is_demo=true` skipped.

---

## 8. Payment and entitlement model

Current state:

- Stripe Checkout: wired (`createCheckout`, `createTopupCheckout`).
- Products / prices: EUR, monthly + yearly per tier; legacy Pro honored.
- Webhooks: **missing** — no `/api/public/stripe-webhook` route. `subscribers` updated by user-initiated `checkSubscription` poll only.
- Server-side entitlement before expensive work: partial — `getAccessStatus` exists but `checkPlanQuota` is the only path that reads `subscribers`, and it's not called before downstream AI stages.
- `/billing` accuracy: depends on user clicking refresh. OK for MVP, weak under burst.
- `PaywallDialog`: triggers on `quota_exceeded` from the 4 insert-time gates only. After R78, every AI entry can throw the same code.
- Customer portal: wired.
- Webhook delayed: today the user sees "still no access" until they reload. No webhook-pending state.
- Webhook fails: silent — would never reconcile.
- Cancellation: only on next poll.
- Trial fields: `handle_new_user_trial` inserts a 14-day trial on signup. **Conflicts with "1 free plan, no trial" landing copy.** Recommendation: remove auto-trial or update landing.
- Client-side trust: PaywallDialog is server-fetched; no client-only trust paths found.

MVP recommendation:

- Add `/api/public/stripe-webhook` (signature-verified with `STRIPE_WEBHOOK_SECRET`), handle `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Write `subscribers` via `supabaseAdmin`.
- Keep `checkSubscription` as fallback poll on `/billing` mount.
- Show "A confirmar pagamento…" state on `/billing?checkout=success` for up to 60s.
- Customer portal stays.
- Top-ups / usage-based / metered: parked.
- **Remove auto-trial creation** to align landing offer with code truth.

---

## 9. Free plan shape

- 1 trainer account.
- 1 complete finalized plan (`plan_quota_limit=1`).
- 1 active reservation across all clients (after R78).
- Multiple clients allowed — intake links are cheap (no AI).
- PDF export, intake link, WhatsApp deeplink, manual schedule, basic dashboard, plan editing all allowed.
- No repeated successful regeneration. No GCal sync. No WhatsApp Cloud API. No top-ups for free users. No bulk demo seeding. AskForge gated or capped.

UX at limit: PaywallDialog with PT-PT copy "Atingiu o seu plano grátis (1 de 1). Para gerar mais planos, escolha um plano." + CTA → `/billing`.

---

## 10. Intake / assessment link workflow

Confirmed from schema + `protect_client_intake_columns`:

- Token: `clients.intake_token uuid` + `intake_token_expires_at` + `intake_status` + `intake_submitted_at`.
- Scoped to one client (RLS via token lookup).
- Expires (column exists; UI handling P1).
- Reusable until expiry (no single-use flag).
- Trainer can revoke/regenerate (trigger allows trainer mutate); UI presence not audited this round.
- Stranger access risk: low.
- Multiple submissions: allowed; UX should overwrite.
- Public submission triggers AI: **no** — `intake.$token.tsx` writes `clients` + `assessments` only.
- Statuses needed: `not_sent`, `sent`, `opened`, `submitted`, `reviewed`. Schema supports `intake_status` text.
- Copy-link, WhatsApp prefill: P1.
- Rate limiting: rely on Cloudflare upstream.
- Mobile: works.

MVP recommendation: keep current shape; add status pills + copy-link + WhatsApp template in R80.

---

## 11. WhatsApp workflow

Deeplink-only via `MessageComposerSheet` (`https://wa.me/<phone>?text=<encoded>`).

| Trigger | Template (PT-PT, "você") | Variables | MVP |
|---|---|---|---|
| Client → "Enviar avaliação" | "Olá {nome}, segue o link para preencher a avaliação inicial: {url}. Demora cerca de 10 minutos." | nome, url | yes |
| Client → "Recordar avaliação" | "Olá {nome}, ainda não recebi a avaliação. Segue o link novamente: {url}." | nome, url | yes |
| Plan → "Enviar PDF" | "Olá {nome}, aqui está o seu plano de treino: {url}." | nome, url | yes |
| Schedule → "Confirmar sessão" | "Olá {nome}, a confirmar a sessão de {dia} às {hora}." | nome, dia, hora | yes |
| Schedule → "Pedido de feedback" | "Olá {nome}, como correu a sessão? Alguma coisa a ajustar?" | nome | yes |
| Packs → "Renovação" | "Olá {nome}, o pacote termina em breve. Quer renovar?" | nome | yes |

No automated outbound, no Meta API, no template approval, no background messaging, no delivery status.

---

## 12. Google Calendar / schedule

Phase 1 (MVP, mostly built): `/schedule` internal manual calendar, `/schedule.packs.tsx`, WhatsApp confirmation message (R80), optional `.ics` if cheap (~2–3 credits, P1).

Phase 2 (parked): Google Calendar OAuth — needs scope `calendar.events`, OAuth + refresh tokens + consent screen + privacy review. ~15–25 credits. **Park.**

Recommendation: park OAuth, ship `.ics` only if R81 has budget.

---

## 13. Publish readiness checklist

### P0 — must-have

- [x] Auth works (no anonymous signup).
- [ ] No anonymous AI generation (true today, but legacy `plan.functions.ts` paths need re-confirmation).
- [ ] Quota lock works (R78).
- [ ] Generation lock works (R78).
- [ ] Payment gate works (R78 + R79).
- [x] Stripe production keys ready (`STRIPE_SECRET_KEY`).
- [ ] `STRIPE_WEBHOOK_SECRET` configured (R78).
- [ ] Billing page accurate post-checkout (R79).
- [ ] PaywallDialog accurate after R78 wrapper.
- [ ] Privacy policy.
- [ ] Terms.
- [ ] Support email visible.
- [ ] Data deletion / export wording.
- [x] Intake link smoke.
- [ ] Generation smoke (R78).
- [ ] Payment smoke (R79).
- [x] PDF export smoke.
- [x] Mobile 375px smoke (recheck post-R78).
- [ ] Quota error states PT-PT (R78).
- [ ] No fake trial copy — remove `handle_new_user_trial` OR update landing.
- [x] No fake social proof.

### P1

`.ics` export, GCal OAuth, WhatsApp Cloud API, top-ups, usage-based billing, advanced CRM, real testimonials, advanced analytics, R76 Slice J.

### Parked

Automated outbound WhatsApp, calendar sync, wearables, medical/lifestyle overlays, credit marketplace, public testimonials, growth automation.

---

## 14. Error model

| Code | PT-PT copy | CTA | Retry | Support | Surface |
|---|---|---|---|---|---|
| `quota_exceeded` | "Atingiu o limite do seu plano grátis. Escolha um plano para gerar mais." | Ver planos | no | no | PaywallDialog |
| `payment_required` | "Esta funcionalidade requer um plano pago." | Ver planos | no | no | PaywallDialog |
| `generation_locked` | "Já existe uma geração em curso para este plano. Aguarde alguns instantes." | Atualizar | yes | no | inline toast |
| `retry_limit_exceeded` | "Atingiu o limite de tentativas para esta etapa. Tente mais tarde." | Voltar | no | no | inline |
| `generation_failed` | "Algo correu mal ao gerar o plano. Pode tentar novamente." | Tentar de novo | yes | no | inline |
| `generation_timeout` | "A geração demorou demasiado tempo. Pode tentar novamente." | Tentar de novo | yes | no | inline |
| `webhook_pending` | "A confirmar o pagamento. Pode demorar até 60 segundos." | Atualizar | yes | no | /billing |
| `checkout_failed` | "Não foi possível abrir o pagamento. Tente novamente." | Tentar | yes | no | /billing |
| `subscription_inactive` | "A sua subscrição não está activa. Renove para continuar." | Renovar | no | yes | /billing |
| `intake_token_expired` | "Este link expirou. Peça um novo ao seu treinador." | — | no | no | /intake |
| `intake_already_submitted` | "Já enviou esta avaliação. Pode actualizá-la se quiser." | Editar | no | no | /intake |
| `forbidden_client_access` | "Não tem acesso a este cliente." | Voltar | no | no | client page |
| `pdf_export_failed` | "Não foi possível gerar o PDF. Tente novamente." | Tentar | yes | no | plan page |
| `whatsapp_link_unavailable` | "Não foi possível abrir o WhatsApp. Verifique o número." | Editar | no | no | composer |
| `schedule_save_failed` | "Não foi possível guardar a sessão." | Tentar | yes | no | /schedule |

Rules: calm, direct, "você", no backend names, one next action.

---

## 15. Recommended implementation sequence

Ranked: A (quota) → B (lock/idempotency) → C (reservation) → E (webhook) → D (paywall polish) → F (billing state) → G (intake copy-link) → H (intake statuses) → O (publish smoke) → Q (AskForge gating) → P (landing/auto-trial fix) → I (PDF send) → J (schedule polish) → K (`.ics`) → L (GCal, parked) → M (WA Cloud, parked) → N (usage billing, parked).

**Picked rounds:**

- **R78:** Quota hardening + generation lock + idempotency + reservation + Stripe webhook (A+B+C+E bundled — same wrapper).
- **R79:** PaywallDialog polish + webhook-pending UX + landing/auto-trial alignment + smoke (D+F+P+O).
- **R80:** Intake status states + copy-link + WhatsApp templates (G+H).
- **R81:** Schedule polish + optional `.ics` (J+K).

---

## 16. Exact file list for R78

**Edit:**

- `src/server/quota.server.ts` — extend `checkPlanQuota`; add `reservePlanQuota`, `releasePlanQuota`, `acquireGenerationLock`, `releaseGenerationLock`, `checkRetryCap`.
- `src/server/phased/stage1-brief.functions.ts` — wrap `synthesizeBrief`, `createPhasedPlan`, `startPhasedPlanDraft`.
- `src/server/phased/stage2-blueprint.functions.ts` — wrap `generateBlueprint`, `discussBlueprint`.
- `src/server/phased/stage3-microcycle.functions.ts` — wrap `generateMicrocycleDays`, `generateDay`.
- `src/server/phased/stage4-progressions.functions.ts` — lock-only wrap on `proposeProgressions`.
- `src/server/phased/stage5-bulkfill.functions.ts` — lock-only wrap on `bulkFillRemainingWeeks`.
- `src/server/phased/program-next-week.functions.ts` — lock wrap.
- `src/server/phased/microcycle-edit.functions.ts` — lock wrap on AI variants.
- `src/server/phased/pre-stage.functions.ts` — daily cap on `analyzeAssessmentSection`.
- `src/server/quick-plan.functions.ts` — add lock + reservation.
- `src/server/plan.functions.ts` — guard or remove legacy `generatePlanDraft|Week|Day`; cap `regeneratePlanSummary`, `escalatePlanDay`.
- `src/server/blocks.functions.ts` — wrap `archivePlanAndStartNextBlock`.
- `src/server/templates.functions.ts` — call `reservePlanQuota` if templates trigger AI.
- **New:** `src/routes/api/public/stripe-webhook.ts` — signature-verified webhook → `subscribers` via `supabaseAdmin`.

**Inspect only (no edit):**

- `src/components/PaywallDialog.tsx` (R79).
- `src/routes/billing.tsx` (R79).
- `src/routes/intake.$token.tsx` (R80).

**Do not touch:** `phased/ai.server.ts`, Stage 3/4/5 algorithm logic, `plan-cost.server.ts` formulas, `plan-critic.server.ts`, `plan-repair.server.ts`, R76 overlay files, i18n, generation prompts.

**Migration (additive):**

```
ALTER TABLE profiles
  ADD COLUMN plan_quota_reserved int NOT NULL DEFAULT 0,
  ADD COLUMN attempts_today int NOT NULL DEFAULT 0,
  ADD COLUMN attempts_reset_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE workout_plans
  ADD COLUMN generation_lock_acquired_at timestamptz,
  ADD COLUMN generation_lock_owner uuid,
  ADD COLUMN quota_reserved boolean NOT NULL DEFAULT false;
```

Plus: extend `bump_plan_quota_on_complete` to clear `quota_reserved` and decrement `plan_quota_reserved` on finalize.

`STRIPE_WEBHOOK_SECRET` must be added before R78 ships — request via `add_secret`.

**User-facing copy (R78):** PT-PT toast strings for `generation_locked`, `generation_failed`, `retry_limit_exceeded` (inline; R79 moves to i18n keys).

**Smoke steps:** see §18.

---

## 17. Estimated credit cost per slice

- **R78** quota + lock + reservation + webhook: **10–14 credits**.
- R79 paywall + webhook-pending + auto-trial fix + smoke: 5–8.
- R80 intake statuses + copy-link + WhatsApp templates: 4–6.
- R81 schedule polish + `.ics`: 3–5.
- Google Calendar OAuth: 15–25.
- WhatsApp Cloud API: 20–30+ (Meta approval out of band).
- Usage-based billing / top-ups: 12–18.

Cumulative R78–R81: ~22–33, leaving ~22 from the current ~55 budget.

---

## 18. Smoke checklist (post-R78)

- [ ] Free user creates 1 plan end-to-end.
- [ ] Free user cannot start a second plan (PaywallDialog `quota_exceeded`).
- [ ] Two tabs simultaneously click "Generate microcycle": only one runs, other shows `generation_locked`.
- [ ] Free user retrying failed stage twice: second shows `retry_limit_exceeded`.
- [ ] Paid user creates within tier limit; quota counts correctly.
- [ ] Quota exceeded opens PaywallDialog.
- [ ] Stripe checkout success → webhook fires → `subscribers.subscribed=true` within 5s.
- [ ] Webhook-pending state appears if entitlement not yet updated.
- [ ] Intake link submission writes assessment without firing AI.
- [ ] WhatsApp deeplink opens with prefilled correct text.
- [ ] `/schedule` still loads.
- [ ] PDF export still works.
- [ ] 375px Mobile Safari renders all wrapper toasts.
- [ ] No Stage 4 / Stage 5 behavioural changes (compare sample plan before/after).
- [ ] Every AI call writes `generation_log` (sample 5 calls).

---

## 19. Do-not-do list

- Do not implement R78 yet (this is audit only).
- Do not reopen R76. Do not implement Slice J.
- Do not touch Stage 4 / Stage 5.
- Do not change generation prompts.
- Do not add Google Calendar OAuth now.
- Do not add WhatsApp Cloud API now.
- Do not add usage-based billing or top-ups now.
- Do not allow anonymous AI generation.
- Do not rely on client-side quota checks.
- Do not allow free users to spam AI retries.
- Do not create fake trials.
- Do not change the offer away from "1 complete free plan" unless code truth changes.
- Do not expose backend provider names to users.
- Do not add fake social proof.
- Do not build a bloated CRM.
- Do not beautify unrelated UI.
- Do not refactor unrelated files.
- Do not touch health / readiness overlays.
- Do not spend credits on non-launch-blocking work.

---

## 20. Acceptance criteria for R78

R78 is approved only if it delivers all of:

- Server-side per-row generation lock with TTL on every critical/high path.
- Idempotency key honored on stage retries (cached result returned on replay).
- Free-plan reservation enforced (`used + reserved < limit`).
- Hard retry cap per stage (free=1, paid=3).
- Parallel-tab protection demonstrated by smoke step #3.
- Clean PT-PT error toasts for `quota_exceeded`, `generation_locked`, `retry_limit_exceeded`, `generation_failed`.
- Stripe webhook live, signature-verified, writes `subscribers` server-side.
- No Stage 4 / Stage 5 behavioural drift.
- Every expensive AI call still writes `generation_log`.
- No product-code drift outside the quota / generation / webhook paths.
- Smoke checklist (§18) passes.

If any of these is missing, the round is rejected and re-scoped.
