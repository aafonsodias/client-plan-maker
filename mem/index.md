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
Client photos = private bucket `client-photos`, path `{trainerId}/{clientId}.{ext}`, signed URL stored on clients.photo_url. Use <ClientAvatar/> for display, <ClientAvatarUpload/> for editing.
Equipment list = src/lib/equipment-catalog.ts (40+ items, EN canonical persisted to DB). Use <EquipmentMultiSelect/> for inputs; never hardcode equipment lists.
Plan feedback = public.plan_feedback (RLS by trainer_id). Bots write via admin client; trainers/clients via src/server/feedback.functions.ts. Render with <FeedbackPanel/>.
Microcycle gate requires haveAllRows AND doneCount===sessionsPerWeek. Auto-advance: approving day N kicks day N+1 (one step ahead, never chains).
i18n audit of src/routes/clients_.$clientId.tsx delegated to external Opus run (assessment namespace). Don't auto-wrap strings there until that lands.
workout_sessions.client_feedback (jsonb, nullable) = {kind: question|complaint|stress, text}. Demo bots write it via maybePersonaFeedback() (src/lib/demo-personas.ts) ~1 in 3 sessions, persona-aware.
Concierge AI = founder-only chat dock (src/components/ConciergeDock.tsx + src/server/concierge.functions.ts). Routes hand-curated in src/lib/concierge-routes.ts; suggestions are filtered to allow-list before render.
