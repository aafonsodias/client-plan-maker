# Project Memory

## Core
Pricing source-of-truth = EUR. USD/BTC are display-only via PriceTag + CurrencyContext. Never store prices in non-EUR.
Free plan = 1 finalized workout plan per account (profiles.plan_quota_used/limit, trigger trg_bump_plan_quota). No IP/fingerprint gating — too much collateral damage and GDPR baggage.
Quota gate enforced server-side via checkPlanQuota() in src/server/quota.server.ts; client surfaces "quota_exceeded" error from createPhasedPlan / startPhasedPlanDraft.
Subscription truth = subscribers.subscribed/trial_end via has_active_access(); helper can_create_more_plans(uid) combines both.
Brand mark = <BrandMark size="sm|md|lg" /> from src/components/BrandMark.tsx (amber under-glow ring). Use in app chrome/headers; never on PDFs or auth's bespoke plate.
Protocol logo = geometric hammer striking a cubic block, 3 amber sparks (#D4A24C). Never anvil/medieval. See [Brand mark](mem://design/brand-mark).
Founder badge = Sparkles (NOT Crown — too royal/VIP for an honest craft tool). Amber pill in AppShell header for aafonsodias@gmail.com only.
Pricing tiers: clients cap == plan-generations cap (Starter 8/8, Pro 25/30, Studio 60/80). 1 client = 1 plan baseline; cap mismatch is dishonest.
Landing page mirrors the 5-stage app journey (Intake → Brief → Blueprint → Microcycle → Progressions). Never advertise unbuilt features without a "Soon" chip.
Status colour palette = success/emerald, neutral/muted, warn/amber, danger/red. "Ready" plans are emerald (NOT amber). Use src/lib/status-tone.ts (toneChip/toneDot/toneText) for new chips/dots.
View-as-client (R70) = global impersonation mode for product QA and base for the real client app. 3 independent layers: (1) UI via ViewAsContext+useViewAs (sessionStorage), (2) route-visibility map em src/lib/route-visibility.ts (trainer-only|client-visible|shared-readonly) — populated route-by-route durante auditoria, (3) RLS no Supabase (já existente; trainer continua a actuar como trainer, é só visual). Botão "Ver como cliente" (Eye) ao lado do "+ Novo cliente" no /dashboard navega para /me em preview. <ViewAsBar/> âmbar fixa no topo (montada no __root) permite trocar de cliente e sair. Em preview, escrita está sempre desactivada visualmente. Nunca confiar só na UI — UI esconde, router redirige (Fatia 2), RLS recusa.
App theme (R71) = paleta terapêutica baseada em evidência. 3 modos no ThemeToggle: deep (escuro, teal-night hue 215) · sage (médio, teal-grey hue 195) · mist (claro, parchment hue 200). Acento quente = terracota suave hue 45 a ~10% de cobertura (CTAs, focus rings, chips activos). Class hooks mantidos (`:root` / `.slate` / `.light`) para back-compat — só os valores oklch mudaram em src/styles.css. Protocol amber (`--protocol-*`, BrandMark, founder badge, PDF export) NÃO mudou — vive em paralelo. Status semantic colours (success emerald, warn amber, danger red) também mantêm-se via status-tone.ts.
Client photos = private bucket `client-photos`. Avatar path `{trainerId}/{clientId}.{ext}` (signed URL on clients.photo_url, use <ClientAvatar/> + <ClientAvatarUpload/>). Reference posture photos path `{trainerId}/{clientId}/posture-{front|side|back|face}.{jpg|png}`, recorded on `assessments.extended.photos[slot]`. Posture photos = honest framing (visual progress, NOT diagnosis). See [Intake photos](mem://features/intake-photos).
Equipment list = src/lib/equipment-catalog.ts (40+ items, EN canonical persisted to DB). Use <EquipmentMultiSelect/> for inputs; never hardcode equipment lists.
Plan feedback = public.plan_feedback (RLS by trainer_id). Bots write via admin client; trainers/clients via src/server/feedback.functions.ts. Render with <FeedbackPanel/>.
Microcycle gate requires haveAllRows AND doneCount===sessionsPerWeek. Auto-advance: approving day N kicks day N+1 (one step ahead, never chains).
i18n audit of src/routes/clients_.$clientId.tsx delegated to external Opus run (assessment namespace). Don't auto-wrap strings there until that lands.
workout_sessions.client_feedback (jsonb, nullable) = {kind: question|complaint|stress, text}. Demo bots write it via maybePersonaFeedback() (src/lib/demo-personas.ts) ~1 in 3 sessions, persona-aware.
Concierge AI = founder-only chat dock (src/components/ConciergeDock.tsx + src/server/concierge.functions.ts). Routes hand-curated in src/lib/concierge-routes.ts; suggestions are filtered to allow-list before render.
Inline stage flow: all 5 plan stages live inline on /clients/$id; approving a stage flips it golden + collapsed and auto-expands the next. Brief approval also folds the assessment synthesis. See mem/principles/inline-stage-flow.md.

Demo content = clients.is_demo + workout_plans.is_demo. Quota trigger bump_plan_quota_on_complete skips is_demo plans. Auto-seeded once per trainer via ensureDemoClient (gated by profiles.demo_seeded_at). Demo Lab Instant: logbook always = duration (fill-to-end).
In-app AI = <AskProtocolDock /> (replaces GuideDock). Tabs: Navegar (askConcierge) + Perguntar à IA (askProtocol — model picker + credit cost). Available to every signed-in trainer.
Demo onboarding seed = 1 ano completo (13 blocos × 4 semanas) para a Maria. Bloco 13 é gerado pela IA real; Blocos 1–12 são clones SQL com mutações leves + logbook back-dated. Botão "Rodar +1 ano" empurra session_date +365d (cap em today). Ver mem/features/demo-year.md.
Demo + landing names = src/lib/names/regional-names.ts (region-weighted mixture model). Never hardcode display names. Ver mem/features/regional-names.md.
Dashboard = role-aware cockpit. Coach=hero(semana·sessões·€)+mini-week+nudges (aniversários, pack ending) com MessageComposerSheet (templates PT/EN editáveis, WhatsApp deeplink, sem AI). Lista de clientes vive abaixo.
No adversarial positioning. Never sell Protocol by attacking Excel/ChatGPT/Trainerize/RP/generic apps. No "vs", "melhor que", "sem viver no Excel". Show workflow + benefit + control; let user connect dots. See [non-adversarial](mem://positioning/non-adversarial.md).
Inner-app design = "calm tools, loud moments". One bold gesture per page (amber under-glow / large numeral / 600ms reveal); the rest stays editorial-quiet. Status colour vocabulary only (emerald/amber/muted/red). Per-page table in mem://design/aesthetic-direction.md.
Invite flow = pre-fill name/email/phone BEFORE generating the link, so WhatsApp + Email buttons in IntakeLinkPanel are already addressed. createInviteClient accepts {fullName?, email?, phone?}.

- [Intake recurrence](mem://principles/intake-recurrence.md) — intake = on-demand re-assessment; continuous data (sleep/HR/wearables) lives on client dashboard
- [No stage redirects](mem://principles/no-stage-redirects.md) — all 5 stages render inline on /clients/$id, /plans/* are thin back-compat wrappers
- [Inline-only journey](mem://principles/inline-only-journey.md) — Plans-list rows expand inline (no nav), standalone stage routes are redirects
- [Schedule & revenue future scope](mem://features/schedule-revenue-future.md) — what R67 deferred; design as one coherent system later
- [Exercise intelligence layer](mem://features/exercise-intelligence-layer.md) — deferred structured exercise DB / muscle map / McGill overlay
- [Exercise media layer](mem://features/exercise-media-layer.md) — deferred technique video library
- [Exercise taxonomy spec](mem://specs/exercise-library-taxonomy.md) — R72 umbrellas, patterns, filters, search tokens
- [Exercise data model spec](mem://specs/exercise-data-model.md) — R72 proposed canonical + override + suggestion fields
- [Exercise media quality spec](mem://specs/exercise-media-quality.md) — R72 8 statuses + first-30 filming priority
- [Play / Games library](mem://features/traditional-games-play-library.md) — R72 traditional games taxonomy + cultural respect rules
- [Exercise library priority](mem://audits/exercise-library-priority.md) — R72 Now/Next/Later/Parked slice ranking
- [Exercise media production](mem://specs/exercise-media-production.md) — R73 filming standards (angles, length, slate, no music)
- [Founder demo limitations](mem://features/founder-demo-limitations.md) — R73 what Demo Lab + R71 simulator do NOT prove
- [Client education PDF appendix](mem://features/client-education-pdf.md) — R73 required glossary page for client-facing PDF
- [Evidence source ethics](mem://principles/evidence-source-ethics.md) — R73 required fields + forbidden patterns for citing studies
- [Session structure principles](mem://specs/session-structure-principles.md) — R74 complete-session block list + "guidelines inform, coach simplifies"
- [Exercise media hosting architecture](mem://specs/exercise-media-hosting-architecture.md) — R75 raw → master → streaming → app metadata; provider-agnostic; YouTube as reference only
- [Exercise media data model](mem://specs/exercise-media-data-model.md) — R75 future `exercise_media` shape keyed by `ExerciseKey`; reuses R74 `MediaQualityStatus`
- [Exercise media file organisation](mem://specs/exercise-media-file-organisation.md) — R75 naming convention + `/Protocol Exercise Media` folder structure
- [Aesthetic direction](mem://design/aesthetic-direction.md) — "calm tools, loud moments" + per-page loud-moment table for every authenticated page
- [One loud moment per page](mem://principles/one-loud-moment-per-page.md) — rule + how to apply when adding new sections
- [Exercise media production workflow](mem://specs/exercise-media-production-workflow.md) — R75 7-step Plan→Film→Select→Edit→Review→Encode→Attach
- [Exercise AI visual pipeline](mem://specs/exercise-ai-visual-pipeline.md) — R75 AI/avatar/stickfigure are visual layers, never source of truth
- [Exercise media implementation plan](mem://audits/exercise-media-implementation-plan.md) — R75 phased rollout; Now = docs+file discipline, Next = Slice 2 identity wiring
