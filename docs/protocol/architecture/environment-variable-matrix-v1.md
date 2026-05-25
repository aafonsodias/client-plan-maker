# Protocol Environment Variable Matrix v1

## Executive summary

Protocol cannot become independent from Lovable until environment variable ownership is explicit across local development, staging, production, backend jobs, auth, AI, billing, and email. The current repo has a mixed environment surface: Supabase client keys are used by browser and middleware paths, Supabase service role keys are used by server/admin paths, Lovable remains the AI gateway credential, and billing/email/digest behavior depends on server-only secrets.

Client-public variables are expected to be safe to expose to the browser, usually `VITE_*` variables or publishable Supabase keys. Server-private variables must never be exposed to client bundles, logs, docs, screenshots, or issue comments. That group includes service role keys, provider API keys, Stripe secrets, email provider keys, and digest/webhook secrets.

The main blockers are:

- Local dev: owned Supabase client variables, server Supabase variables for server functions, and feature flags when testing legacy assessment views.
- Staging: owned Supabase project variables, service role key, auth redirect/origin settings, AI routing credentials, Stripe test secret, Resend test key, and digest secret if scheduled jobs are tested.
- Production: production-owned Supabase, service role key, production origin, Stripe/Resend production ownership, digest secret placement, and replacement for the Lovable AI gateway.
- Lovable independence: `LOVABLE_API_KEY`, Lovable build/auth package assumptions, Lovable AI gateway calls, and any environment-linked deployment/origin assumptions must be removed or replaced deliberately.

## Environment variable matrix

| Variable name | Category | Client-visible or server-only | Required in local | Required in staging | Required in production | Owning service | Runtime surface | Repo evidence/path | Validation method | Migration note |
|---|---|---|---|---|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase client/public | Client-visible | Yes for browser app and auth flows | Yes | Yes | Supabase | Browser Supabase client | `src/integrations/supabase/client.ts`, `.env.example` | `rg "VITE_SUPABASE_URL" src .env.example` | Must point to the owned Supabase project before auth cutover. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase client/public | Client-visible | Yes for browser app and auth flows | Yes | Yes | Supabase | Browser Supabase client | `src/integrations/supabase/client.ts`, `.env.example` | `rg "VITE_SUPABASE_PUBLISHABLE_KEY" src .env.example` | Replace with the owned project publishable/anon key. |
| `VITE_SUPABASE_PROJECT_ID` | Unknown/needs confirmation | Client-visible if used | Unknown; listed in example only | Unknown | Unknown | Supabase | Unknown | `.env.example` | `rg "VITE_SUPABASE_PROJECT_ID" . src supabase scripts` | Confirm whether deployment tooling or Lovable expects this before removal or replacement. |
| `SUPABASE_URL` | Supabase server/private | Server-only by intent; client fallback exists in code | Yes for server functions and scripts | Yes | Yes | Supabase | Server Supabase clients, auth middleware, scripts | `src/integrations/supabase/client.server.ts`, `src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/client.ts`, `scripts/` | `rg "SUPABASE_URL" src scripts .env.example` | Must match owned project URL; review client fallback before treating it as private-only. |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase client/public | Publishable key; used by server middleware | Yes for server-rendered/auth middleware paths | Yes | Yes | Supabase | Auth middleware and server/client fallback | `src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/client.ts`, `.env.example` | `rg "SUPABASE_PUBLISHABLE_KEY" src .env.example` | Pair with owned project URL; safe to expose as publishable key but still avoid logging values. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server/private | Server-only | Yes when running server/admin scripts or server functions that need elevated access | Yes before staging replay and validation | Yes for production server/admin paths | Supabase | Server Supabase admin client and smoke/verification scripts | `src/integrations/supabase/client.server.ts`, `scripts/r2.2-smoke2.ts`, `scripts/r2.2-smoke2-derive-only.ts`, `scripts/verify-consolidation-phase-a.ts`, `.env.example` | `rg "SUPABASE_SERVICE_ROLE_KEY" src scripts .env.example` | Must be owned, rotated, and stored only in server secret stores. |
| `SUPABASE_KEY` | Unknown/needs confirmation | Server-only if used | Optional script fallback only | Unknown | Unknown | Supabase | Verification script fallback | `scripts/verify-consolidation-phase-a.ts` | `rg "SUPABASE_KEY" scripts .env.example src` | Confirm whether this is legacy naming; prefer explicit publishable or service role names. |
| `LOVABLE_API_KEY` | Lovable-specific | Server-only | Required for current AI paths unless mocked/disabled | Required for current AI paths until replaced | Required for current AI paths until replaced | Lovable | AI gateway calls across server functions | `src/server/anthropic-compat.server.ts`, `src/server/atlas.functions.ts`, `src/server/concierge.functions.ts`, `src/server/demo-judge.functions.ts`, `src/server/intake-ai.functions.ts`, `src/server/sessions-ocr.functions.ts`, `src/server/phased/ai.server.ts`, `src/server/phased/stage2-blueprint.functions.ts`, `scripts/r2.2-smoke2.ts`, `.env.example` | `rg "LOVABLE_API_KEY|ai.gateway.lovable.dev" src scripts .env.example` | Primary Lovable independence blocker for AI; replace through an adapter rather than one-off endpoint swaps. |
| `FORGE_MODEL_STAGE_3` | AI/model routing | Server-only | Optional script override | Unknown | Unknown | AI provider decision pending | Smoke script model selection | `scripts/r2.2-smoke2.ts` | `rg "FORGE_MODEL_STAGE_3" scripts src .env.example` | Confirm target model routing names after AI provider decision. |
| `STRIPE_SECRET_KEY` | Stripe | Server-only | Optional unless billing is exercised | Yes for billing validation with test mode | Yes for production billing | Stripe | Billing server functions | `src/server/billing.functions.ts`, `.env.example` | `rg "STRIPE_SECRET_KEY" src .env.example` | Confirm account ownership and test/live separation before production cutover. |
| `RESEND_API_KEY` | Email/Resend | Server-only | Optional unless digest email is exercised | Yes if digest/email is tested | Yes if digest/email is enabled | Resend | Weekly digest hook email delivery | `src/routes/api/public/hooks/weekly-digest.ts`, `.env.example` | `rg "RESEND_API_KEY" src .env.example` | Confirm Resend account ownership, sending domain, and environment-specific keys. |
| `DIGEST_SECRET` | Digest/scheduled jobs | Server-only | Optional unless testing digest hook | Yes if staging hook is enabled | Yes if production hook is enabled | Deployment scheduler / app backend | Weekly digest webhook authorization | `src/routes/api/public/hooks/weekly-digest.ts`, `.env.example` | `rg "DIGEST_SECRET" src .env.example` | Store in scheduler and runtime secret stores; rotate during backend ownership migration. |
| `APP_ORIGIN` | Deployment/origin | Server-only config if introduced | Not currently required by code | Recommended before staging hardening | Recommended before production cutover | Deployment platform | Redirect/origin normalization | Mentioned in architecture checklist; no current code reference found | `rg "APP_ORIGIN" .` | Not implemented yet; decide whether to introduce as canonical origin instead of scattered `window.location.origin` and fallback domains. |
| `VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS` | Feature flags | Client-visible | Optional | Optional | Optional; only if intentionally enabled | Protocol app | Assessment/client UI feature flag | `src/routes/clients_.$clientId.tsx`, `src/routes/intake.$token.tsx`, `.env.example` | `rg "VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS" src .env.example` | Treat as a reversible client flag; confirm desired default before cutover. |
| `VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET` | Feature flags | Client-visible | Optional | Optional | Optional; only if intentionally enabled | Protocol app | Legacy reassessment sheet behavior | `src/routes/clients_.$clientId.tsx`, `.env.example` | `rg "VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET" src .env.example` | Confirm whether the legacy sheet is still part of supported production behavior. |
| `import.meta.env.DEV` | Local/dev only | Client-visible build mode flag | Provided by Vite | No | No | Vite | Development-only routing/i18n behavior | `src/router.tsx`, `src/i18n/index.ts` | `rg "import.meta.env.DEV" src` | No ownership action; keep as build-mode behavior. |
| `ANTHROPIC_API_KEY` | Unknown/needs confirmation | Server-only if reintroduced | No current requirement | No current requirement | No current requirement | AI provider decision pending | Historical/compatibility comment only | `src/server/anthropic-compat.server.ts` | `rg "ANTHROPIC_API_KEY" src scripts .env.example` | Do not add until AI provider strategy is chosen. |

## Security classification

| Classification | Variables | Handling rule |
|---|---|---|
| Public identifier | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `APP_ORIGIN` | Safe to reference by name in docs; do not paste live values in issues or chat. |
| Publishable key | `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` | Expected to be client-usable, but still avoid printing values outside approved config locations. |
| Server secret | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KEY`, `LOVABLE_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY` | Store only in server/runtime secret stores; never expose to browser, logs, docs, or screenshots. |
| Webhook secret | `DIGEST_SECRET` | Store in both caller scheduler and receiving runtime secret store; rotate during cutover. |
| Model routing config | `FORGE_MODEL_STAGE_3` | Not necessarily secret, but keep server-side until provider routing is finalized. |
| Feature flag | `VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS`, `VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET`, `import.meta.env.DEV` | Client-visible behavior controls; validate defaults per environment. |
| Unknown | `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_KEY`, `APP_ORIGIN`, `ANTHROPIC_API_KEY` | Confirm active use and intended owner before relying on them. |

## Local dev requirements

- App shell: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are needed for browser Supabase initialization; `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` may also be needed by server-rendered/auth middleware paths.
- Email/password auth: owned Supabase URL and publishable key variables must point to the same local/staging Supabase project used for auth testing.
- Google OAuth code path: owned Supabase client variables are required, and the Supabase project must have Google OAuth configured manually; the code path now routes through `/auth/callback`, but provider setup is external.
- AI generation: current AI features require `LOVABLE_API_KEY` until the AI gateway is replaced or mocked.
- Billing: `STRIPE_SECRET_KEY` is only required locally when exercising billing functions.
- Digest jobs: `DIGEST_SECRET` and `RESEND_API_KEY` are only required locally when testing the weekly digest hook.

## Staging requirements

Before replaying migrations or testing auth in staging:

- Owned staging Supabase project URL and publishable key variables must be set consistently across client and server runtime surfaces.
- `SUPABASE_SERVICE_ROLE_KEY` must be available only in server-side secret storage for migration validation, admin server clients, and authorized scripts.
- Google OAuth must be configured in Supabase and Google Cloud with staging callback and redirect URLs.
- Storage buckets, RLS policies, auth triggers, `pg_cron`, and `pg_net` must be validated against the staging project before production.
- Stripe and Resend must use staging/test credentials and owned accounts.
- Digest hook caller must store the matching `DIGEST_SECRET` without exposing it in logs.
- AI behavior must be either wired to the current Lovable gateway knowingly or routed through a staging-safe replacement plan.

## Production requirements

Before production cutover:

- Production Supabase ownership, project URL, publishable key, service role key, database password access, auth providers, redirect URLs, storage buckets, RLS policies, and scheduled jobs must be confirmed.
- Production runtime must store server secrets outside the client bundle: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `DIGEST_SECRET`, and any AI provider secret.
- Production origin/domain must be confirmed and reflected in Supabase Auth redirect URLs, Google OAuth client settings, deployment configuration, and any future canonical origin variable.
- Stripe live account ownership, webhook configuration, and billing paths must be confirmed before billing cutover.
- Resend sending domain ownership and weekly digest scheduling must be confirmed before digest cutover.
- `LOVABLE_API_KEY` must either be removed after AI replacement or explicitly treated as a temporary production dependency with an exit gate.

## Lovable independence blockers

- `LOVABLE_API_KEY` keeps AI generation tied to Lovable because multiple server functions call `https://ai.gateway.lovable.dev/v1/chat/completions`.
- `@lovable.dev/cloud-auth-js` remains in the repo and intake auth still references Lovable OAuth behavior in `src/routes/intake.$token.tsx`.
- `@lovable.dev/vite-tanstack-config` remains part of the build configuration through `vite.config.ts`.
- CSP and metadata still allow Lovable domains in `src/routes/__root.tsx`.
- Fallback public URLs such as `https://forge.lovable.app` appear in sharing and billing-related code paths.
- `.lovable` historical archive handling still needs an explicit keep/archive/delete decision, but it should not be removed as part of an env-only PR.

## Validation commands/checks

Safe local commands:

```powershell
npm.cmd test
npm.cmd run build
rg "process\.env|import\.meta\.env" src scripts supabase .env.example
rg "SUPABASE_|VITE_SUPABASE_|LOVABLE_API_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY|DIGEST_SECRET" src scripts .env.example docs/protocol
rg "ai.gateway.lovable.dev|lovable|forge.lovable.app" src package.json vite.config.ts docs/protocol
```

Safe manual checks without exposing secrets:

- Confirm Supabase project owner/admin access, project URL, auth providers, redirect URLs, storage buckets, RLS policies, service role key availability, and scheduled job ownership.
- Confirm Google Cloud OAuth client ownership and allowed callback URLs.
- Confirm Stripe account ownership and whether local/staging/production use separate test/live credentials.
- Confirm Resend account ownership, sending domain, and environment-specific API keys.
- Confirm deployment platform secret placement and production/staging domains.

## Missing human confirmations

- Actual owner/admin of the Supabase project that should become Protocol-owned.
- Whether a new owned Supabase project will be created or an existing project will be transferred.
- Whether the service role key is available to the Protocol owner and where it will be stored.
- Stripe account owner, test/live separation, and production billing cutover criteria.
- Resend account owner, sending domain owner, and digest email sender identity.
- Production domain and staging domain.
- AI provider decision after Lovable gateway removal.
- Digest secret location in both the scheduler/caller and deployed receiving runtime.
- Whether `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_KEY`, `APP_ORIGIN`, and `FORGE_MODEL_STAGE_3` are active requirements or legacy placeholders.

## Recommended next PRs

1. Add a small env validation document or script that checks required variable names by environment without printing values.
2. Introduce an AI provider adapter boundary while keeping the existing Lovable gateway implementation behind it.
3. Audit and remove or replace Lovable-specific build/auth/CSP assumptions one surface at a time after ownership gates are confirmed.
