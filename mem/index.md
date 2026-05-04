# Project Memory

## Core
Pricing source-of-truth = EUR. USD/BTC are display-only via PriceTag + CurrencyContext. Never store prices in non-EUR.
Free plan = 1 finalized workout plan per account (profiles.plan_quota_used/limit, trigger trg_bump_plan_quota). No IP/fingerprint gating — too much collateral damage and GDPR baggage.
Quota gate enforced server-side via checkPlanQuota() in src/server/quota.server.ts; client surfaces "quota_exceeded" error from createPhasedPlan / startPhasedPlanDraft.
Subscription truth = subscribers.subscribed/trial_end via has_active_access(); helper can_create_more_plans(uid) combines both.
Brand mark = <BrandMark size="sm|md|lg" /> from src/components/BrandMark.tsx (amber under-glow ring). Use in app chrome/headers; never on PDFs or auth's bespoke plate.
FORGE logo = geometric hammer striking a cubic block, 3 amber sparks (#D4A24C). Never anvil/medieval. See [Brand mark](mem://design/brand-mark).
Founder badge = Sparkles (NOT Crown — too royal/VIP for an honest craft tool). Amber pill in AppShell header for aafonsodias@gmail.com only.
Pricing tiers: clients cap == plan-generations cap (Starter 8/8, Pro 25/30, Studio 60/80). 1 client = 1 plan baseline; cap mismatch is dishonest.
Landing page mirrors the 5-stage app journey (Intake → Brief → Blueprint → Microcycle → Progressions). Never advertise unbuilt features without a "Soon" chip.
Status colour palette = success/emerald, neutral/muted, warn/amber, danger/red. "Ready" plans are emerald (NOT amber). Use src/lib/status-tone.ts (toneChip/toneDot/toneText) for new chips/dots.
Client photos = private bucket `client-photos`. Avatar path `{trainerId}/{clientId}.{ext}` (signed URL on clients.photo_url, use <ClientAvatar/> + <ClientAvatarUpload/>). Reference posture photos path `{trainerId}/{clientId}/posture-{front|side|back|face}.{jpg|png}`, recorded on `assessments.extended.photos[slot]`. Posture photos = honest framing (visual progress, NOT diagnosis). See [Intake photos](mem://features/intake-photos).
Equipment list = src/lib/equipment-catalog.ts (40+ items, EN canonical persisted to DB). Use <EquipmentMultiSelect/> for inputs; never hardcode equipment lists.
Plan feedback = public.plan_feedback (RLS by trainer_id). Bots write via admin client; trainers/clients via src/server/feedback.functions.ts. Render with <FeedbackPanel/>.
Microcycle gate requires haveAllRows AND doneCount===sessionsPerWeek. Auto-advance: approving day N kicks day N+1 (one step ahead, never chains).
i18n audit of src/routes/clients_.$clientId.tsx delegated to external Opus run (assessment namespace). Don't auto-wrap strings there until that lands.
workout_sessions.client_feedback (jsonb, nullable) = {kind: question|complaint|stress, text}. Demo bots write it via maybePersonaFeedback() (src/lib/demo-personas.ts) ~1 in 3 sessions, persona-aware.
Concierge AI = founder-only chat dock (src/components/ConciergeDock.tsx + src/server/concierge.functions.ts). Routes hand-curated in src/lib/concierge-routes.ts; suggestions are filtered to allow-list before render.
Inline stage flow: all 5 plan stages live inline on /clients/$id; approving a stage flips it golden + collapsed and auto-expands the next. Brief approval also folds the assessment synthesis. See mem/principles/inline-stage-flow.md.

Demo content = clients.is_demo + workout_plans.is_demo. Quota trigger bump_plan_quota_on_complete skips is_demo plans. Auto-seeded once per trainer via ensureDemoClient (gated by profiles.demo_seeded_at). Demo Lab Instant: logbook always = duration (fill-to-end).
In-app AI = <AskForgeDock /> (replaces GuideDock). Tabs: Navegar (askConcierge) + Perguntar à IA (askForge — model picker + credit cost). Available to every signed-in trainer.
Demo onboarding seed = 1 ano completo (13 blocos × 4 semanas) para a Maria. Bloco 13 é gerado pela IA real; Blocos 1–12 são clones SQL com mutações leves + logbook back-dated. Botão "Rodar +1 ano" empurra session_date +365d (cap em today). Ver mem/features/demo-year.md.

- [Intake recurrence](mem://principles/intake-recurrence.md) — intake = on-demand re-assessment; continuous data (sleep/HR/wearables) lives on client dashboard
- [No stage redirects](mem://principles/no-stage-redirects.md) — all 5 stages render inline on /clients/$id, /plans/* are thin back-compat wrappers
