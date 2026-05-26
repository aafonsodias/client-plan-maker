# Protocol Environment Variable Matrix v1

## Executive Summary

Protocol environment ownership is explicit across Supabase, AI, billing, email, scheduled jobs, and feature flags.

The active AI provider is OpenAI-compatible. The current app no longer requires a Lovable AI key, Lovable AI Gateway URL, Lovable auth package, Lovable build package, or Lovable browser CSP domain.

Client-public variables are expected to be safe to expose to the browser, usually `VITE_*` variables or publishable Supabase keys. Server-private variables must never be exposed to client bundles, logs, docs, screenshots, or issue comments. That group includes service role keys, provider API keys, Stripe secrets, email provider keys, and digest/webhook secrets.

## Environment Variable Matrix

| Variable name | Category | Client-visible or server-only | Required in local | Required in staging | Required in production | Runtime surface | Repo evidence/path | Migration note |
|---|---|---|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase client/public | Client-visible | Yes for browser app and auth flows | Yes | Yes | Browser Supabase client | `src/integrations/supabase/client.ts`, `.env.example` | Must point to the owned Supabase project before auth cutover. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase client/public | Client-visible | Yes for browser app and auth flows | Yes | Yes | Browser Supabase client | `src/integrations/supabase/client.ts`, `.env.example` | Pair with the matching Supabase project URL. |
| `VITE_SUPABASE_PROJECT_ID` | Unknown/needs confirmation | Client-visible if used | Unknown; listed in example only | Unknown | Unknown | Unknown | `.env.example` | Confirm whether deployment tooling still needs this. |
| `SUPABASE_URL` | Supabase server/private | Server-only by intent; client fallback exists in code | Yes for server functions and scripts | Yes | Yes | Server Supabase clients, auth middleware, scripts | `src/integrations/supabase/client.server.ts`, `src/integrations/supabase/auth-middleware.ts`, scripts | Must match the owned project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase client/public | Publishable key; used by server middleware | Yes for server-rendered/auth middleware paths | Yes | Yes | Auth middleware and server/client fallback | `src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/client.ts`, `.env.example` | Safe to expose as publishable key, but avoid logging values. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server/private | Server-only | Optional unless running admin scripts | Yes before staging replay and validation | Yes for production server/admin paths | Server Supabase admin client and smoke/verification scripts | `src/integrations/supabase/client.server.ts`, `scripts/`, `.env.example` | Store only in server secret stores. |
| `SUPABASE_KEY` | Unknown/needs confirmation | Server-only if used | Optional script fallback only | Unknown | Unknown | Verification script fallback | `scripts/verify-consolidation-phase-a.ts` | Confirm whether this is legacy naming. |
| `AI_PROVIDER` | AI/model routing | Server-only | Optional; may be unset or `openai-compatible` | Optional; may be unset or `openai-compatible` | Optional; may be unset or `openai-compatible` | AI provider selection | `src/server/ai/provider-adapter.server.ts`, `scripts/validate-env.mjs` | No alternate provider values are supported. |
| `AI_OPENAI_COMPATIBLE_BASE_URL` | AI/model routing | Server-only | Optional unless testing AI locally | Yes | Yes | OpenAI-compatible provider | `src/server/ai/provider-adapter.server.ts`, `scripts/validate-env.mjs`, `.env.example` | Store as server config; URL may include or omit `/chat/completions`. |
| `AI_OPENAI_COMPATIBLE_API_KEY` | AI/model routing | Server-only | Optional unless testing AI locally | Yes | Yes | OpenAI-compatible provider | `src/server/ai/provider-adapter.server.ts`, `scripts/validate-env.mjs`, `.env.example` | Server secret; never print or expose. |
| `FORGE_MODEL_PRE_STAGE` | AI/model routing | Server-only | Optional | Optional | Optional | Phased model override | `src/server/phased/model-routing.server.ts` | Keep model IDs explicit; do not silently remap. |
| `FORGE_MODEL_STAGE_1` | AI/model routing | Server-only | Optional | Optional | Optional | Phased model override | `src/server/phased/model-routing.server.ts` | Keep model IDs explicit; do not silently remap. |
| `FORGE_MODEL_STAGE_2` | AI/model routing | Server-only | Optional | Optional | Optional | Phased model override | `src/server/phased/model-routing.server.ts` | Keep model IDs explicit; do not silently remap. |
| `FORGE_MODEL_STAGE_3` | AI/model routing | Server-only | Optional | Optional | Optional | Phased model override and smoke script model selection | `src/server/phased/model-routing.server.ts`, `scripts/r2.2-smoke2.ts` | Confirm model availability before changing. |
| `FORGE_MODEL_STAGE_4` | AI/model routing | Server-only | Optional | Optional | Optional | Phased model override | `src/server/phased/model-routing.server.ts` | Keep model IDs explicit; do not silently remap. |
| `FORGE_MODEL_DISCUSS` | AI/model routing | Server-only | Optional | Optional | Optional | Stage 2 discussion model override | `src/server/phased/model-routing.server.ts` | Keep model IDs explicit; do not silently remap. |
| `STRIPE_SECRET_KEY` | Stripe | Server-only | Optional unless billing is exercised | Yes for billing validation with test mode | Yes for production billing | Billing server functions | `src/server/billing.functions.ts`, `.env.example` | Confirm account ownership and test/live separation before production cutover. |
| `RESEND_API_KEY` | Email/Resend | Server-only | Optional unless digest email is exercised | Yes if digest/email is tested | Yes if digest/email is enabled | Weekly digest hook email delivery | `src/routes/api/public/hooks/weekly-digest.ts`, `.env.example` | Confirm account ownership and sending domain. |
| `DIGEST_SECRET` | Digest/scheduled jobs | Server-only | Optional unless testing digest hook | Yes if staging hook is enabled | Yes if production hook is enabled | Weekly digest webhook authorization | `src/routes/api/public/hooks/weekly-digest.ts`, `.env.example` | Store in scheduler and runtime secret stores. |
| `APP_ORIGIN` | Deployment/origin | Server-only config if introduced | Not currently required by code | Recommended before staging hardening | Recommended before production cutover | Redirect/origin normalization | Architecture checklist; no current code reference found | Decide whether to introduce as canonical origin. |
| `VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS` | Feature flags | Client-visible | Optional | Optional | Optional | Assessment/client UI feature flag | `src/routes/clients_.$clientId.tsx`, `src/routes/intake.$token.tsx`, `.env.example` | Treat as reversible client flag. |
| `VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET` | Feature flags | Client-visible | Optional | Optional | Optional | Legacy reassessment sheet behavior | `src/routes/clients_.$clientId.tsx`, `.env.example` | Confirm desired default before production hardening. |
| `ANTHROPIC_API_KEY` | Unknown/needs confirmation | Server-only if reintroduced | No current requirement | No current requirement | No current requirement | Historical/compatibility comment only | `src/server/anthropic-compat.server.ts` | Do not add until provider strategy changes. |

## Security Classification

| Classification | Variables | Handling rule |
|---|---|---|
| Public identifier | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `APP_ORIGIN` | Safe to reference by name in docs; do not paste live values in issues or chat. |
| Publishable key | `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` | Expected to be client-usable, but still avoid printing values outside approved config locations. |
| Server secret | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KEY`, `AI_OPENAI_COMPATIBLE_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY` | Store only in server/runtime secret stores; never expose to browser, logs, docs, or screenshots. |
| Webhook secret | `DIGEST_SECRET` | Store in both caller scheduler and receiving runtime secret store; rotate during cutover. |
| Model routing config | `AI_PROVIDER`, `AI_OPENAI_COMPATIBLE_BASE_URL`, `FORGE_MODEL_*` | Not necessarily secret, but keep server-side until provider routing is finalized. |
| Feature flag | `VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS`, `VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET`, `import.meta.env.DEV` | Client-visible behavior controls; validate defaults per environment. |
| Unknown | `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_KEY`, `APP_ORIGIN`, `ANTHROPIC_API_KEY` | Confirm active use and intended owner before relying on them. |

## AI Provider Requirements

Local mode is advisory. Developers can run the app shell without AI secrets, but AI calls return missing configuration until the OpenAI-compatible variables are present.

Staging and production require:

- `AI_OPENAI_COMPATIBLE_BASE_URL`
- `AI_OPENAI_COMPATIBLE_API_KEY`

`AI_PROVIDER` is optional. If set, it must be `openai-compatible`. No Lovable provider value is supported.

## Validation Commands

Safe local commands:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run check:env
npm.cmd run smoke:ai-provider
node scripts/validate-env.mjs staging
node scripts/validate-env.mjs production
rg "process\.env|import\.meta\.env" src scripts supabase .env.example
rg "AI_PROVIDER|AI_OPENAI_COMPATIBLE|SUPABASE_|STRIPE_SECRET_KEY|RESEND_API_KEY|DIGEST_SECRET" src scripts .env.example docs/protocol
```

The validation script reads only the current shell environment. It prints variable names, categories, and status labels, never values. Local mode is advisory and exits 0. Staging and production modes fail when required variables are missing or invalid.

Known limitation: this validates local presence/classification only. It does not confirm Supabase project ownership, Google OAuth dashboard settings, Stripe/Resend account ownership, deployed secret placement, redirect URL correctness, scheduled job configuration, or whether a value belongs to the intended environment.

## Remaining Historical References

`LOVABLE_API_KEY` is no longer a current variable. Any remaining mentions should be treated as historical migration evidence, archive material, or existing migration history that must not be rewritten.

The active app, env validation, smoke script, and provider adapter do not require it.
