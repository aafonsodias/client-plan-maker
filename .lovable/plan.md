# R77 — MVP launch-gate audit (single report, no code)

## Scope

Read-only. Produces one file: `.lovable/r77-mvp-launch-gate.md`. Does not implement, does not edit i18n, does not migrate, does not touch R76, does not start Slice J, does not touch Stage 4/5 or generation prompts.

## What I already verified during exploration

These findings shape the audit's verdict and don't need re-discovery:

- `checkPlanQuota` is called in **only 4 places**: `createPhasedPlan`, `startPhasedPlanDraft`, `startQuickPlan`, and `templates.functions.ts`. Every quota check happens **at plan-row insertion only**.
- Every other expensive AI entry point has **no quota check**: `synthesizeBrief`, `generateBlueprint`, `generateMicrocycleDays`, `generateDay`, `proposeProgressions`, `bulkFillRemainingWeeks`, `programNextWeek`, `regeneratePlanSummary`, `escalatePlanDay`, `archivePlanAndStartNextBlock`, `analyzeAssessmentSection`, `discussBlueprint`, `generatePlanDraft/Week/Day` (legacy). All require only that the caller own a plan row.
- The quota trigger (`trg_bump_plan_quota`) bumps `plan_quota_used` only when `generation_status` flips to `'complete'`. **Quota is consumed at finalization, not at start.** A free user who never finalizes can re-run brief/blueprint/microcycle/bulkfill on the same draft row indefinitely — and even **create unlimited new draft rows** for different clients, because `createPhasedPlan` only blocks the insert when there's already an in-progress plan for *the same client*. Different client = new draft = fresh AI spend.
- No `generation_lock` column. No idempotency key. No retry cap. No daily attempt cap. No abandoned-lock expiry. Two browser tabs can fire `generateMicrocycleDays` in parallel.
- No Stripe webhook route exists (`rg "webhook" src/routes` returns nothing). Entitlement is refreshed only by client-triggered `checkSubscription` poll. Webhook-pending state is implicit (user must click refresh).
- `billing.functions.ts` is otherwise solid: server-side Stripe customer lookup by email, server-side `subscribers` upsert, `getAccessStatus` server-truth, customer portal wired, EUR prices, tiers aligned with plan/client caps.
- Intake (`src/routes/intake.$token.tsx`) is a public submission route; whether it triggers AI or only writes assessment fields needs one read to confirm. Recommendation will be: public intake submits data only, AI only on trainer-initiated generation. Already aligned with current design — confirm in audit.
- WhatsApp = `MessageComposerSheet` deeplink (no Cloud API). Schedule = internal `/schedule` + packs. Both already in safe MVP shape.

## Audit's load-bearing positions

- **Verdict: AMBER.** Three P0 holes: (1) quota only consumed at finalize → free user can spend unlimited credits on drafts; (2) no generation lock → parallel-tab abuse; (3) no Stripe webhook → entitlement gap during checkout.
- **Biggest bankruptcy risk:** a free user creates N clients, fires `synthesizeBrief` + `generateBlueprint` + `generateMicrocycleDays` repeatedly per client without ever finalizing. None of those stages check quota; the only gate is `createPhasedPlan` per-client uniqueness, which is bypassed by adding new clients.
- **Smallest required fix (R78):** quota reservation model D. At every expensive AI entry, before calling AI:
  1. `checkPlanQuota` (already exists) — block if free quota exhausted by *reserved or finalized* plans, not just finalized.
  2. Acquire row-level generation lock (`workout_plans.generation_lock_acquired_at`, `generation_lock_owner`) — release on success/failure, expire after 2h.
  3. Daily attempt cap per user (`profiles.attempts_today` + reset trigger) — free: 2 full generations / 24h.
  4. Per-stage retry cap stored in `generation_state.retries.{stage}`.
- **Quota reservation model:** add `plan_quota_reserved` int to `profiles`. Increment on `synthesizeBrief` first call for a draft; decrement only if the plan row is hard-deleted or marked `abandoned`. Free-plan check becomes `used + reserved < limit`. Migration is small and additive.
- **Stripe webhook:** add `/api/public/stripe-webhook` route handling `checkout.session.completed` + `customer.subscription.updated/deleted`, signature-verified via `STRIPE_WEBHOOK_SECRET`, writes to `subscribers` server-side. Eliminates the polling gap. Webhook-pending UI state for the 0–30s window after checkout success.
- **Free plan shape unchanged:** 1 finalized plan, multiple clients allowed (intake links cheap), but only 1 active reservation across all clients.
- **Intake/WhatsApp/Schedule:** already MVP-safe, no R78 work needed.
- **Google Calendar OAuth + WhatsApp Cloud API + top-ups + usage-based billing: parked.**
- **R78 implementation sequence (next round, NOT this round):**
  - R78: quota reservation + generation lock + retry cap + Stripe webhook. ~10–14 credits.
  - R79: PaywallDialog polish + billing webhook-pending state + smoke. ~5–8.
  - R80: intake link status states + WhatsApp templates audit. ~4–6.
  - R81: schedule polish + optional `.ics`. ~3–5.
- **Files R78 will edit:** `src/server/quota.server.ts`, `src/server/phased/stage1-brief.functions.ts`, `stage2-blueprint.functions.ts`, `stage3-microcycle.functions.ts`, `stage4-progressions.functions.ts`, `stage5-bulkfill.functions.ts`, `program-next-week.functions.ts`, `microcycle-edit.functions.ts`, `quick-plan.functions.ts`, `plan.functions.ts` (legacy generators), `blocks.functions.ts`, plus new `src/routes/api/public/stripe-webhook.ts`, plus one migration adding `plan_quota_reserved`, `generation_lock_acquired_at`, `generation_lock_owner`, `attempts_today`, `attempts_reset_at`.

## Document structure

`.lovable/r77-mvp-launch-gate.md`, sections 1–20 exactly per the brief:

1. Executive summary
2. Launch verdict (AMBER + reasons)
3. Current quota flow (text diagram of actual flow, contrasted with required flow)
4. Expensive-path map (table of every entry point, AI cost, current protection, missing protection, abuse scenario, fix, P0/P1/P2)
5. Bankruptcy-risk map (each path classified critical/high/medium/low)
6. Anti-abuse MVP model (auth gate, lock, idempotency, reservation, retry cap, daily cap, lock TTL, public-link-no-AI, demo-founder-only)
7. Quota reservation model (model D, schema additions, migration purpose only)
8. Payment + entitlement model (Stripe state today, webhook gap, recommended webhook route, webhook-pending UX)
9. Free plan shape (1 plan total, multiple clients OK, 1 active reservation, no GCal/CloudAPI/topups)
10. Intake/assessment link workflow (token flow, statuses needed, recommendation = current shape + status pills)
11. WhatsApp workflow (deeplinks only, 6 templates: intake / reminder / PDF / feedback / next session / pack renewal)
12. Google Calendar / schedule (parked OAuth; phase 1 = internal + WhatsApp; `.ics` only if cheap)
13. Publish readiness checklist (P0 / P1 / parked)
14. Error model (PT-PT copy table for all 15 error codes)
15. Recommended implementation sequence (rank A–Q; pick R78–R81)
16. Exact file list for R78 (above)
17. Estimated credit cost per slice (R78: 10–14, R79: 5–8, R80: 4–6, R81: 3–5, GCal OAuth: 15–25, WA Cloud: 20–30, usage billing: 12–18)
18. Smoke checklist (15 items per brief)
19. Do-not-do list (verbatim from brief)
20. Acceptance criteria for R78

## Method

- One more parallel read pass: confirm intake AI-trigger absence (`intake.$token.tsx` + `intake.functions.ts` headers), confirm `MessageComposerSheet` is deeplink-only, confirm no existing webhook route. ~3 file reads.
- Write the report in one `apply_patch`.
- Stop. No memory updates, no plan.md updates, no code edits.

## Acceptance check before closing

- `.lovable/r77-mvp-launch-gate.md` exists with all 20 sections.
- Verdict = AMBER, P0 holes named, R78 recommended with exact file list and migration purpose.
- No other file touched.
- Final chat reply summarises only: verdict, biggest bankruptcy risk, R78 patch, R78 files, credit estimate.

If you approve, I write the report and stop.