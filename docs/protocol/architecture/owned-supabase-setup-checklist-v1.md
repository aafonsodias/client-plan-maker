# Owned Supabase Setup Checklist v1

Historical note: this checklist is a pre-eradication planning artifact. Several Lovable references below describe the repo state at the time this checklist was written and are retained as migration history, not as current runtime/build/browser/package/env requirements. See `docs/protocol/architecture/lovable-eradication-status-v1.md` for current status.

Date: 2026-05-25

Scope: planning and documentation only. No app code, database schema, migrations, environment files, package files, or remote services were changed.

Repo evidence used:

- `docs/protocol/audits/protocol-domain-gap-audit-v1.md`
- `docs/protocol/architecture/current-domain-source-of-truth-map-v1.md`
- `supabase/migrations/` with 76 migration files
- `package.json`, `vite.config.ts`, `wrangler.jsonc`
- `src/integrations/`, `src/server/`, and `src/routes/`

## 1. Executive summary

Protocol can become independent from Lovable only when Protocol owns the backend, not just the frontend repository. In this repo, Lovable is currently present in build/auth configuration, AI gateway calls, runtime error copy, CSP domains, and production URL assumptions. Supabase is also a real backend dependency, with migrations, Auth-triggered profile creation, RLS policies, storage buckets, service-role server access, scheduled job support, and client/server integration code.

Backend ownership matters because Protocol cannot safely remove Lovable while database ownership, Auth providers, redirect URLs, service-role access, storage policies, cron/webhook behavior, deployment secrets, and AI routing are still controlled by or coupled to Lovable. A frontend-only removal would leave hidden operational dependency on a backend Protocol does not fully control.

The main blockers to Lovable independence are:

- Supabase project ownership and export access are not documented here.
- `vite.config.ts` imports `@lovable.dev/vite-tanstack-config`.
- `package.json` includes `@lovable.dev/cloud-auth-js` and `@lovable.dev/vite-tanstack-config`.
- `src/integrations/lovable/index.ts` wraps Lovable cloud auth and is used by public intake Google OAuth.
- Several server files call `https://ai.gateway.lovable.dev/v1/chat/completions` with `LOVABLE_API_KEY`.
- Runtime messages still instruct maintainers to connect Supabase in Lovable Cloud.
- `src/routes/__root.tsx` allows Lovable domains in CSP.
- `wrangler.jsonc` exists, so Cloudflare deployment assumptions must be confirmed and moved under Protocol ownership.

Before migration, Protocol must have an owned Supabase staging project, an owned production project plan, verified Auth settings, verified migration replay, storage buckets and RLS validated in staging, scheduled jobs recreated under Protocol control, deployment secrets placed in the deployment platform, and a single replacement boundary for the Lovable AI Gateway.

## 2. Required Supabase ownership checklist

- [ ] Protocol has owner/admin access to the target Supabase organization and projects.
- [ ] Project ownership is tied to a durable Protocol-controlled account, not Lovable or a personal account.
- [ ] Owned staging and production project URLs are documented without exposing secrets.
- [ ] Publishable key is available for browser-safe client configuration.
- [ ] Service role key is available only to server-side runtime code and secret managers.
- [ ] Database password is available only for approved migration, backup, restore, or direct admin workflows.
- [ ] Auth provider settings are controlled directly in the owned Supabase dashboard.
- [ ] Redirect URL settings are controlled directly in the owned Supabase dashboard.
- [ ] Migrations from `supabase/migrations/` can be replayed in order in an owned staging project.
- [ ] RLS policies are validated for trainer-owned and client-owned data boundaries.
- [ ] Auth trigger `on_auth_user_created` / `handle_new_user` behavior is verified after migration.
- [ ] Storage buckets are recreated and policies verified.
- [ ] Required buckets from migrations are inventoried: `logos`, `client-photos`, and `client-documents`.
- [ ] Scheduled database jobs are inventoried and recreated under Protocol-owned secrets.
- [ ] Required Postgres extensions are available in the target plan.
- [ ] Edge/server routes that depend on service role access are inventoried.
- [ ] Backup, restore, and deletion permissions are limited to approved Protocol maintainers.

Supabase evidence in this repo includes RLS policies on core tables such as `profiles`, `clients`, `assessments`, `workout_plans`, `subscribers`, `screening_evaluations`, `audit_events`, `adaptation_proposals`, `adaptation_decisions`, and `progress_markers`. The migrations also create storage policies and append-only audit/adaptation decision triggers.

## 3. Auth setup checklist

- [ ] Email/password Auth is configured for trainer sign-in and sign-up.
- [ ] Supabase email confirmation and password reset behavior are verified.
- [ ] Google OAuth provider is configured directly in owned Supabase if trainer Google sign-in remains in scope.
- [ ] Google Cloud OAuth client is owned by Protocol.
- [ ] Google Cloud OAuth client includes the owned Supabase callback URL.
- [ ] Supabase Auth redirect allow-list includes local, staging, and production app URLs.
- [ ] App route callback behavior is reconciled before migration: `src/routes/auth.tsx` redirects Google OAuth to `/auth/callback`, while this repo contains `src/routes/auth_.callback.tsx` for `/auth_/callback`.
- [ ] Public intake Google OAuth is migrated away from `src/integrations/lovable/index.ts` and Lovable cloud auth.
- [ ] Intake email sign-up redirect to `/intake/:token` is validated.
- [ ] Required local env variable names are documented by name only.
- [ ] Required production env variable names are stored in the deployment platform, not committed.
- [ ] Service role keys are never exposed through `VITE_*`, browser bundles, logs, or docs.

Current env variable names found in code:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`
- `DIGEST_SECRET`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS`
- `VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET`

`LOVABLE_API_KEY` must be replaced by Protocol-owned AI provider or gateway secrets before Lovable independence is complete.

## 4. Migration checklist

- [ ] Treat `supabase/migrations/` as the candidate canonical migration source and verify all 76 files against the current production project.
- [ ] Replay migrations in an owned staging Supabase project first.
- [ ] Verify migration order, checksums, and any migrations already applied to the Lovable-linked project.
- [ ] Verify `pg_cron` and `pg_net`; migration `20260430082055_35b3055b-7eb2-4546-9cd0-f3d99ffbdc92.sql` creates both and schedules an HTTP job.
- [ ] Recreate the weekly digest schedule and its `DIGEST_SECRET` authorization path under Protocol control.
- [ ] Verify Auth triggers, especially profile creation through `handle_new_user`.
- [ ] Verify RLS policies on all trainer-owned and client-readable tables.
- [ ] Verify append-only behavior for `audit_events` and `adaptation_decisions`.
- [ ] Verify the known audit gap from the domain audit: `screening_evaluations` blocks updates, but delete immutability needs confirmation.
- [ ] Verify buckets and policies for `logos`, `client-photos`, and `client-documents`.
- [ ] Identify hardcoded Lovable URLs and project assumptions before migration.
- [ ] Identify all data export/import needs from the current Supabase project.
- [ ] Rehearse export/import in staging before production data moves.
- [ ] Create integrity checks for safety-critical and audit-critical records.
- [ ] Document rollback and read-only windows before production migration.

Production migrations must not be run until staging replay, Auth validation, RLS validation, storage validation, scheduled job validation, and import rehearsal pass.

## 5. Deployment checklist

- [ ] Confirm Cloudflare is the intended deployment target. `wrangler.jsonc` exists with `nodejs_compat`.
- [ ] Confirm Cloudflare account, project, routes, preview behavior, and domain ownership are Protocol-controlled.
- [ ] Confirm TanStack Start deployment assumptions with Cloudflare and Vite.
- [ ] Remove or replace Lovable-specific Vite config only after owned deployment works.
- [ ] Define client-safe env vars for the app bundle.
- [ ] Define server-only secrets for Supabase service role, AI provider, Stripe, Resend, and digest hook.
- [ ] Define `APP_ORIGIN` or equivalent canonical origin if the deployment needs stable redirect construction.
- [ ] Ensure Supabase Auth redirect URLs match local, staging, and production origins.
- [ ] Place secrets in Cloudflare/deployment secret storage, never in committed files.
- [ ] Update CSP after Lovable dependencies are replaced. Current CSP allows Supabase, Lovable, OpenAI, Anthropic, and other external APIs.
- [ ] Run `npm run build` before deployment.
- [ ] Run the configured test script before routing users to the owned deployment.
- [ ] Smoke-test sign-in, sign-up, OAuth callback, public intake, public log, service-role server functions, weekly digest route, storage upload/download, and AI calls in staging.

Do not change package files in this PR. Package/config removal belongs in a later implementation PR after staging proves the owned backend and deployment path.

## 6. Lovable dependency removal checklist

- [ ] Auth dependencies: replace `@lovable.dev/cloud-auth-js` and `src/integrations/lovable/index.ts` public-intake Google OAuth with owned Supabase OAuth.
- [ ] Vite/TanStack Lovable config: replace `@lovable.dev/vite-tanstack-config` with an owned Vite/TanStack configuration after deployment parity is known.
- [ ] Lovable AI Gateway: replace all `https://ai.gateway.lovable.dev/v1/chat/completions` calls through one Protocol-owned AI adapter.
- [ ] `LOVABLE_API_KEY`: replace with owned provider/gateway secrets and rotate/remove after cutover.
- [ ] Lovable hardcoded URLs: replace `https://forge.lovable.app`, Lovable API domains, and Lovable-specific runtime messages.
- [ ] Lovable CSP domains: remove `https://api.lovable.app` and `https://*.lovable.app` once no runtime path needs them.
- [ ] `gpt-engineer`/Lovable uploaded OG image URLs: replace with Protocol-owned assets if they are still used.
- [ ] Runtime copy: remove "Connect Supabase in Lovable Cloud" errors after env ownership is moved.
- [ ] `.lovable` or generated historical archive: preserve until migration evidence is complete, then decide whether to archive, ignore, or remove.
- [ ] Billing origin fallback: replace Lovable app fallback origin with Protocol production origin.

No Lovable dependency should be removed until owned Supabase, owned deployment, Auth, storage, scheduled jobs, and AI replacement are validated in staging.

## 7. Decision gates

### Before creating owned Supabase project

- Current Supabase project owner, project ref, region, Auth providers, storage buckets, extensions, cron jobs, and export access are known.
- The target staging and production project ownership model is approved.
- Migration replay and data export/import strategy is written.
- Deployment target and expected app origins are known.

### Before applying migrations

- The 76 migrations in `supabase/migrations/` are confirmed as canonical or reconciled with production history.
- `pg_cron` and `pg_net` support are confirmed in the target Supabase plan.
- Storage bucket creation and RLS policies are reviewed.
- Staging project exists and is disposable.
- Production is not the first migration target.

### Before migrating auth

- Email/password policy is decided.
- Google OAuth client is owned by Protocol if Google sign-in remains.
- Supabase callback URL and app redirect URLs are configured for local, staging, and production.
- `/auth/callback` versus `/auth_/callback` route behavior is reconciled.
- Existing users, identities, profiles, and client-linked accounts have a migration plan.

### Before migrating data

- Export source and permissions are confirmed.
- Tables, storage objects, Auth users, and bucket files have an import plan.
- RLS is validated before exposing imported records.
- Audit-critical tables have integrity checks.
- Rollback and downtime/read-only policy are documented.

### Before replacing AI gateway

- All Lovable AI Gateway call sites are inventoried.
- A single Protocol-owned AI adapter or gateway boundary is selected.
- Provider keys are stored server-side.
- Model routing, cost logging, error messages, and generation logging are updated in one path.
- Staging proves equivalent generation, OCR, intake AI, concierge, and demo judge flows.

### Before deleting Lovable dependencies

- Owned Supabase serves Auth, database, storage, cron, and service-role flows.
- Owned deployment serves the app with correct secrets and CSP.
- AI gateway replacement is active.
- Production smoke tests pass.
- Rollback path is documented.
- Lovable packages, URLs, CSP entries, and generated integration files are no longer operationally required.

## 8. What not to do

- Do not create a random Supabase project without a migration and ownership plan.
- Do not run migrations against production first.
- Do not expose secrets in docs, logs, screenshots, commits, build output, or browser bundles.
- Do not keep configuring a hidden Lovable backend as the long-term fix.
- Do not replace all AI calls one by one without an adapter.
- Do not delete Lovable packages or config before owned staging proves parity.
- Do not use the Supabase service role key in `VITE_*` variables or any client-readable context.
- Do not assume OAuth works until callback routes and redirect allow-lists are reconciled.
- Do not migrate data before RLS, storage policies, and Auth user mapping are tested.

## 9. Missing information requiring human confirmation

- Current Lovable-linked Supabase project owner, project ref, region, and export permissions.
- Whether the 76 local migrations exactly match production migration history.
- Current production domain, staging domain, and final Protocol-owned app origin.
- Whether Cloudflare is the confirmed long-term host.
- Current Supabase Auth provider settings and redirect allow-list.
- Google Cloud OAuth client ownership and callback configuration.
- Whether Auth users must be exported/imported or users will be invited to reauthenticate.
- Current storage object volume for `logos`, `client-photos`, and `client-documents`.
- Current weekly digest endpoint URL and `DIGEST_SECRET` placement.
- AI provider/gateway choice after Lovable.
- Whether Stripe and Resend production secrets are already Protocol-owned.

## 10. Recommended next PR

Create a docs-only backend inventory and migration plan PR. It should map every backend surface to current owner, target owner, and validation method:

- Supabase project, region, Auth providers, redirect URLs, and OAuth clients.
- Migration file history versus production history.
- Tables, RLS policies, triggers, functions, and extensions.
- Storage buckets, policies, and object export/import needs.
- `pg_cron` / `pg_net` weekly digest job and webhook target.
- Server-only secrets and deployment platform placement.
- Lovable AI Gateway call sites and proposed Protocol-owned adapter boundary.
- Cloudflare/Wrangler deployment ownership and required origins.

That PR should still avoid app-code changes, migration execution, remote dashboard changes, and secret disclosure.
