# Backend Ownership Inventory and Migration Plan v1

Historical note: this inventory is a pre-eradication planning artifact. Several Lovable references below describe the repo state at the time this inventory was written and are retained as migration history, not as current runtime/build/browser/package/env requirements. See `docs/protocol/architecture/lovable-eradication-status-v1.md` for current status.

Date: 2026-05-25

Scope: documentation only. No app code, migrations, package files, environment files, remote services, or secrets were changed or accessed.

Evidence used:

- `docs/protocol/architecture/owned-supabase-setup-checklist-v1.md`
- `docs/protocol/architecture/current-domain-source-of-truth-map-v1.md`
- `docs/protocol/audits/protocol-domain-gap-audit-v1.md`
- `supabase/migrations/`
- `package.json`
- `vite.config.ts`
- `wrangler.jsonc`
- `src/integrations/`
- `src/server/`
- `src/routes/`
- `src/components/`
- `src/lib/`

## 1. Executive summary

Protocol has a real backend ownership risk. The codebase is not just a static frontend that can be separated from Lovable by changing a deploy target. It depends on a Supabase project, Supabase Auth, Auth redirects, RLS policies, storage buckets, service-role server access, database migrations, scheduled database jobs, TanStack server functions, Cloudflare/Wrangler deployment assumptions, Stripe, Resend, and AI calls.

Protocol cannot be fully independent from Lovable until ownership is explicit for every backend surface. Today, Lovable remains present in build config, Auth package usage, Google OAuth flow code, AI gateway calls, CSP domains, fallback URLs, and operational error copy. If those are removed before Supabase ownership, Auth configuration, migration parity, deployment secrets, and AI routing are understood, Protocol could end up with a frontend that looks independent but still depends on hidden Lovable-controlled infrastructure.

A new owned Supabase project is likely needed for clean independence. That project should be created only after the current production project, migration history, Auth provider configuration, storage buckets, cron jobs, and data export needs are inventoried. If the current Supabase project can be transferred into Protocol-owned control with full admin access and export rights, that may reduce migration risk, but it still needs the same ownership validation.

The safest path is:

1. Complete ownership inventory and confirm current owners.
2. Reconcile local migrations with production migration history.
3. Replay migrations in an owned staging project.
4. Validate schema, RLS, storage, Auth, scheduled jobs, and server functions in staging.
5. Decide whether data moves by transfer, export/import, or staged re-onboarding.
6. Replace Lovable AI/Auth/build dependencies only after owned backend and deployment paths are proven.
7. Cut over production with rollback criteria.

## 2. Backend surface inventory

| Surface | Repo evidence/path | Current owner/control assumption | Target owner | Runtime criticality | Lovable dependency level | Migration risk | Validation method | Recommended next action |
|---|---|---|---|---|---|---|---|---|
| Supabase project | `src/integrations/supabase/*`, `supabase/migrations/` | Unknown; likely current project connected through Lovable-era setup | Protocol-owned Supabase org/project | Critical | Indirect | High | Confirm project ref, owner, region, backups, API settings without printing keys | Human confirms current project owner/export access |
| Supabase Auth | `src/routes/auth.tsx`, `src/integrations/supabase/client.ts`, migrations with `auth.users` triggers | Supabase-owned runtime, current dashboard ownership unknown | Protocol-owned Supabase Auth config | Critical | Indirect | High | Test sign-in, sign-up, callback, profile trigger in staging | Inventory dashboard settings and redirect allow-list |
| Google OAuth provider | `src/routes/auth.tsx`, `src/routes/intake.$token.tsx`, `src/integrations/lovable/index.ts` | Mixed: trainer auth uses Lovable wrapper, Supabase client also present | Protocol-owned Google Cloud OAuth client plus Supabase provider | Critical if Google login remains | Direct | High | Staging OAuth sign-in with owned callback URL | Confirm OAuth client owner and callback URLs |
| Redirect URLs | `src/routes/auth.tsx`, `src/routes/intake.$token.tsx`, Supabase dashboard | Dashboard state unknown; current `main` constructs `/auth/callback` but no matching route file was found | Protocol-owned Supabase redirect allow-list | Critical | Mixed | High | Local and staging Auth redirect smoke tests | Reconcile `/auth/callback` route ownership before Auth changes |
| Service role key usage | `src/integrations/supabase/client.server.ts`, many `src/server/*.functions.ts` | Secret placement unknown | Protocol deployment secret store | Critical | Indirect | High | Server-only runtime smoke tests; verify key never appears client-side | Inventory all service-role call paths |
| Database migrations | `supabase/migrations/` has 76 files | Repo has candidate migration source; production parity unknown | Protocol repository and migration runbook | Critical | Indirect | High | Staging replay from clean database; compare production schema | Reconcile local migration history with production |
| RLS policies | `supabase/migrations/*` policies for profiles, clients, assessments, plans, sessions, audit, adaptation, storage | Repo-controlled SQL, deployed state unknown | Protocol-owned Supabase policy set | Critical | None direct | High | Staging tests for trainer/client access boundaries | Create RLS validation checklist and fixtures |
| Storage buckets | Migrations create/use `logos`, `client-photos`, `client-documents` | Bucket state and object volume unknown | Protocol-owned Supabase Storage | Critical for uploads/assets | Indirect | Medium-high | Bucket existence, policy, upload/download, signed URL tests | Inventory object counts and export needs |
| Storage policies | `supabase/migrations/20260429224921*`, `20260429224941*`, `20260502140431*`, `20260503000630*`, `20260504011155*`, `20260508235643*` | Repo-controlled SQL, deployed state unknown | Protocol-owned policy set | Critical | None direct | Medium-high | Staging policy tests for trainer/client paths | Validate each bucket policy with test accounts |
| `pg_cron` / `pg_net` | `supabase/migrations/20260430082055_35b3055b-7eb2-4546-9cd0-f3d99ffbdc92.sql` | Requires Supabase plan support and DB-level configuration | Protocol-owned Supabase project | Important | None direct | Medium-high | Confirm extensions and scheduled HTTP call in staging | Verify extension availability before migrations |
| Weekly digest hook | `src/routes/api/public/hooks/weekly-digest.ts`, `DIGEST_SECRET`, `RESEND_API_KEY` | Endpoint/secret placement unknown | Protocol deployment and Supabase cron ownership | Important | None direct | Medium | Staging cron invokes hook with bearer secret | Document hook URL and rotate secret at cutover |
| TanStack server functions | Many `src/server/*.functions.ts` use `createServerFn` and `requireSupabaseAuth` | App-owned code, runtime deployment owner unknown | Protocol-owned deployment | Critical | Indirect through build/deploy | High | Build and smoke-test representative functions | Inventory public vs authenticated function paths |
| Cloudflare/Wrangler deployment | `wrangler.jsonc`, `@cloudflare/vite-plugin` in `package.json` | Cloudflare account/project owner unknown | Protocol-owned Cloudflare account/project | Critical | Indirect | Medium-high | Staging deploy with production-equivalent secrets | Confirm Cloudflare is final host and owner |
| Vite/TanStack Lovable config | `vite.config.ts`, `@lovable.dev/vite-tanstack-config` | Lovable package controls build plugin bundle | Protocol-owned Vite/TanStack config | Critical for builds | Direct | Medium-high | Build parity before/after replacement | Document config responsibilities before removal |
| Lovable auth package | `package.json`, `src/integrations/lovable/index.ts`, `src/routes/auth.tsx`, `src/routes/intake.$token.tsx` | Lovable cloud auth wrapper | Protocol-owned Supabase OAuth flow | Critical for Google OAuth | Direct | High | Staging sign-in for trainer and intake flows | Replace only after Auth settings are owned |
| Lovable AI Gateway | `src/server/phased/ai.server.ts`, `anthropic-compat.server.ts`, `stage2-blueprint.functions.ts`, `intake-ai.functions.ts`, `sessions-ocr.functions.ts`, `atlas.functions.ts`, `concierge.functions.ts`, `demo-judge.functions.ts` | Lovable AI gateway and `LOVABLE_API_KEY` | Protocol-owned AI provider or gateway adapter | Critical for AI features | Direct | High | Golden-path generation/OCR/intake/concierge tests in staging | Create single AI adapter before replacing call sites |
| CSP Lovable domains | `src/routes/__root.tsx` | App code allows Lovable domains | Protocol-owned CSP | Important | Direct | Medium | Browser smoke tests after CSP cleanup | Remove only after runtime paths no longer need Lovable |
| Hardcoded Lovable URLs | `src/server/billing.functions.ts`, `src/components/ShareAppButton.tsx`, AI gateway files, OG image URLs in `src/routes/__root.tsx` | Mixed Lovable fallback/runtime assumptions | Protocol-owned domains/assets | Important | Direct | Medium | Search plus link/callback smoke tests | Replace with explicit app origin and owned assets |
| Stripe secrets | `src/server/billing.functions.ts`, `STRIPE_SECRET_KEY` | Secret placement and account owner unknown | Protocol-owned Stripe account and secret store | Important for billing | None direct | Medium | Staging checkout and portal tests | Confirm Stripe account and webhook ownership |
| Resend/email secrets | `src/routes/api/public/hooks/weekly-digest.ts`, `RESEND_API_KEY` | Secret placement and sender/domain owner unknown | Protocol-owned Resend/email account | Important for digest email | None direct | Medium | Staging email sandbox/test recipient | Confirm sender domain and API key ownership |
| Environment variables | `src/integrations/supabase/*`, `src/server/*`, `src/routes/*` | Placement unknown | Protocol-owned local docs and deployment secret stores | Critical | Mixed | High | Name-only inventory and deployment secret audit | Create environment matrix without values |
| Demo data / demo runs | `demo_runs` migration, `src/server/demo-*`, `src/components/Demo*`, `src/lib/demo-*` | App-owned code and DB state, production policy unknown | Protocol-owned demo data policy | Medium | AI paths may use Lovable | Medium | Staging demo run smoke test; confirm production demo policy | Decide if demo data migrates or can be regenerated |

## 3. Environment variable inventory

Variable names only. Values must not be printed in docs, logs, commits, screenshots, or build output.

### Supabase client/public

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Notes:

- `src/integrations/supabase/client.ts` accepts Vite-prefixed and non-prefixed names.
- Browser-safe variables must never include service-role privileges.

### Supabase server/private

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Notes:

- `src/integrations/supabase/client.server.ts` creates the admin client from these names.
- The service role key must exist only in server runtime secret storage.

### Lovable-specific

- `LOVABLE_API_KEY`

Notes:

- Used by AI gateway call paths.
- Must be replaced by Protocol-owned AI provider or gateway secrets before Lovable independence.

### AI/model routing

- `LOVABLE_API_KEY`

Notes:

- Model routing is currently code-owned in files such as `src/server/phased/model-routing.server.ts` and gateway wrappers.
- No separate owned provider key was found in code.

### Stripe

- `STRIPE_SECRET_KEY`

Notes:

- Used by `src/server/billing.functions.ts`.
- Stripe account, webhook, product/price, and portal ownership need confirmation.

### Email/digest

- `DIGEST_SECRET`
- `RESEND_API_KEY`

Notes:

- Used by `src/routes/api/public/hooks/weekly-digest.ts`.
- `DIGEST_SECRET` gates the public hook expected to be called by `pg_cron`.

### Deployment/origin

- No explicit `APP_ORIGIN` variable was found.

Notes:

- Some code constructs origins from `window.location.origin`.
- `src/server/billing.functions.ts` and `src/components/ShareAppButton.tsx` contain Lovable fallback origins.
- A future `APP_ORIGIN` or equivalent should be considered for server-side redirects and billing URLs.

### Feature flags

- `VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS`
- `VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET`

### Local/dev only

- `import.meta.env.DEV`

Notes:

- Used for development-only rendering/logging behavior.

### Unknown/needs confirmation

- Whether Cloudflare dashboard has additional secrets not referenced in source.
- Whether Supabase dashboard has Auth email template, redirect, SMTP, webhook, or provider secrets.
- Whether Stripe webhooks or Resend domain secrets exist outside this repo.
- Whether Lovable Cloud injects any additional variables not represented in code.

## 4. Supabase migration plan

### A. Discovery

- Confirm current Supabase project owner, organization, project ref, region, and billing owner.
- Confirm whether the current project can be transferred to Protocol ownership or must be recreated.
- Compare the 76 files in `supabase/migrations/` with the production migration history.
- Inventory tables, functions, triggers, extensions, storage buckets, RLS policies, Auth settings, scheduled jobs, and API settings.
- Inventory data volume, including Auth users and Storage objects.
- Identify any production data that can be regenerated, such as demo data, versus data that must migrate.

### B. Staging replay

- Create an owned staging Supabase project only after discovery confirms the target region and plan requirements.
- Replay migrations from a clean database in order.
- Confirm `pg_cron` and `pg_net` support before applying the cron migration.
- Record migration failures, manual steps, extension requirements, and drift from production.
- Do not run migrations against production first.

### C. Schema/RLS/storage validation

- Validate core trainer-owned tables with at least two trainer accounts.
- Validate client-readable policies with linked client accounts and public-token flows.
- Validate `audit_events` append-only behavior.
- Validate `adaptation_decisions` append-only behavior.
- Validate the known `screening_evaluations` delete immutability gap before relying on it as append-only.
- Validate `logos`, `client-photos`, and `client-documents` buckets.
- Validate signed URL and upload paths for documents/photos.
- Validate public intake policies and public session logging policies.

### D. Auth provider setup

- Configure email/password behavior in owned Supabase.
- Configure Google provider with a Protocol-owned Google Cloud OAuth client if Google login remains.
- Configure local, staging, and production redirect URLs.
- Reconcile `/auth/callback` route expectations before touching production. Current `main` constructs this redirect, but only `src/routes/auth.tsx` was found by route-file search.
- Verify `handle_new_user` and any trial-related cleanup migrations in staging.

### E. Data export/import decision

- Decide between project transfer, database dump/restore, table-by-table import, or user re-onboarding.
- Decide whether Auth users are migrated or re-invited.
- Decide whether storage objects migrate or stale assets are regenerated.
- Decide whether demo data migrates or is regenerated through demo tooling.
- Create checks for safety-critical and audit-critical data after import.

### F. Production cutover

- Freeze writes or define a read-only window if existing production users exist.
- Back up current database and storage.
- Apply the chosen migration/import path.
- Configure production env vars and secrets in the deployment platform.
- Smoke-test Auth, core CRUD, plan generation, public intake, public logging, storage, billing, digest, and AI flows.
- Monitor errors and failed server functions before declaring cutover complete.

### G. Rollback plan

- Preserve the old production backend until new production passes smoke tests and a defined soak period.
- Keep DNS/deployment rollback instructions ready.
- Keep database backup restore instructions ready.
- Keep storage object backup and restore instructions ready.
- Define which writes can be replayed if rollback occurs after partial usage.
- Do not delete Lovable dependencies until rollback no longer depends on them.

## 5. Auth migration plan

Email/password behavior:

- `src/routes/auth.tsx` uses `supabase.auth.signInWithPassword` and `supabase.auth.signUp`.
- Sign-up redirects to `/welcome`.
- Public intake sign-up redirects back to `/intake/:token`.
- Email confirmation, password reset, and template ownership must be checked in the Supabase dashboard.

Google OAuth behavior:

- Trainer Google sign-in currently calls the Lovable auth wrapper in `src/routes/auth.tsx`.
- Public intake Google sign-in also calls the Lovable auth wrapper in `src/routes/intake.$token.tsx`.
- `src/integrations/lovable/index.ts` uses `@lovable.dev/cloud-auth-js` and then sets the Supabase session.
- This is a direct Lovable dependency and should not be removed until owned Supabase OAuth is configured and tested.

Supabase callback URL:

- The Supabase dashboard callback URL must be copied from the owned Supabase project into the Protocol-owned Google Cloud OAuth client.
- The dashboard redirect allow-list must include local, staging, and production app origins.

App `/auth/callback` redirect:

- `src/routes/auth.tsx` constructs a Google redirect to `/auth/callback`.
- The route file shape must be verified before Auth migration, because route naming and generated route tree behavior determine the actual callback URL. Current `main` does not show a dedicated callback route file.
- This PR does not change routes.

Local redirect URLs:

- Confirm local Vite/TanStack dev origin.
- Add local Auth redirects for sign-up, sign-in, and intake token return paths.

Production redirect URLs:

- Confirm final Protocol production origin.
- Add production Auth redirects for sign-up, sign-in, `/welcome`, `/auth/callback`, and `/intake/:token` if needed.

Existing users migration question:

- Decide whether existing Auth users are exported/imported, transferred with the project, or re-invited.
- Confirm whether linked `profiles.user_id`, `clients.user_id`, `subscribers.user_id`, and client account links can survive the chosen approach.

Manual confirmations before touching Auth again:

- Current Supabase project ownership and provider settings.
- Current Google Cloud OAuth client owner.
- Current redirect allow-list.
- Current production and staging app origins.
- Auth email template ownership.
- User migration policy.

## 6. Lovable removal plan

### Auth removal

- Replace `src/integrations/lovable/index.ts` call sites with owned Supabase OAuth flows.
- Remove `@lovable.dev/cloud-auth-js` only after trainer and intake Google OAuth pass in staging.
- Keep email/password behavior stable while changing Google OAuth.

### Build config removal

- Document what `@lovable.dev/vite-tanstack-config` currently provides.
- Rebuild equivalent owned Vite/TanStack/Cloudflare config in a separate PR.
- Run build, preview, and smoke tests before removing the Lovable config package.

### AI Gateway replacement

- Create one Protocol-owned AI adapter boundary.
- Move model routing, headers, logging, cost metadata, and error mapping behind that boundary.
- Replace call sites after the adapter is tested against generation, intake AI, OCR, Atlas, concierge, and demo judge flows.
- Rotate/remove `LOVABLE_API_KEY` after cutover.

### Hardcoded URL cleanup

- Replace `https://forge.lovable.app` fallbacks with an explicit Protocol origin.
- Replace Lovable AI gateway URLs through the adapter.
- Replace Lovable/gpt-engineer OG image URLs with owned assets if still used.

### CSP cleanup

- Remove `https://api.lovable.app` and `https://*.lovable.app` from `src/routes/__root.tsx` only after Auth, AI, and hardcoded URL paths no longer depend on Lovable.
- Keep Supabase, owned AI provider, Stripe, Resend, and required public API domains explicit.

### Historical `.lovable` archive handling

- If a `.lovable` directory or Lovable-generated archive exists outside this inventory, preserve it until migration evidence is complete.
- After cutover, decide whether it should be deleted, ignored, or moved to a historical archive.

## 7. Risk register

| Risk | Severity | Evidence | Mitigation | Owner confirmation needed |
|---|---|---|---|---|
| Current Supabase project ownership is unknown | Critical | Supabase integrations and migrations exist, but no owner record in repo | Confirm owner/export/admin access before creating or migrating anything | Supabase project owner and export permissions |
| Lovable Auth wrapper controls Google OAuth flows | Critical | `src/integrations/lovable/index.ts`, `src/routes/auth.tsx`, `src/routes/intake.$token.tsx` | Configure owned Supabase OAuth in staging before replacing wrapper | Google Cloud OAuth client owner |
| Lovable AI Gateway is used in multiple server paths | Critical | `ai.gateway.lovable.dev` in AI, OCR, intake, Atlas, concierge, demo judge paths | Create single owned adapter and validate feature parity | AI provider/gateway choice |
| Migration history may not match production | Critical | 76 local migrations, production history not confirmed | Reconcile migration table/history before staging replay and production cutover | Production Supabase migration state |
| RLS or storage policies may drift from repo | High | Many RLS/storage migrations, deployed state unknown | Staging replay plus policy tests for trainer/client accounts | Supabase dashboard access |
| Service role key placement is unknown | High | `SUPABASE_SERVICE_ROLE_KEY` used in server admin client | Put only in server secret store; audit deployment variables | Deployment secret owner |
| Cron/digest depends on DB extensions and secret | High | `pg_cron`, `pg_net`, weekly digest hook, `DIGEST_SECRET` | Verify extensions and rotate secret in owned project | Supabase plan and deployment owner |
| Auth callback path may be inconsistent | High | Code redirects to `/auth/callback`; route file behavior must be verified | Test local/staging OAuth callback before production Auth changes | App origin and callback route owner |
| Hardcoded Lovable origin affects billing/share URLs | Medium | `forge.lovable.app` in billing/share code | Introduce owned origin strategy in a later PR | Production domain owner |
| Demo flows may use AI and production data paths | Medium | `demo_runs`, `src/server/demo-*`, `Demo*` components | Decide whether demo data migrates or regenerates; validate AI adapter | Product owner |
| Audit-critical data may be mutable or incomplete | High | Domain audit notes audit coverage gaps and `screening_evaluations` delete gap | Validate append-only tables and prioritize audit coverage PRs | Product/legal decision owner |
| Stripe/Resend account ownership unknown | Medium | `STRIPE_SECRET_KEY`, `RESEND_API_KEY` used in server paths | Confirm accounts, domains, webhooks, and secret placement | Operations owner |

## 8. Decision gates

Before creating owned Supabase project:

- Current project owner, region, project ref, export access, and billing owner are known.
- Target region, plan requirements, storage needs, and extension requirements are known.
- Decision made: transfer existing project or create new project.

Before replaying migrations:

- Local 76 migrations are reconciled with production history.
- Required extensions are confirmed.
- Staging project is disposable.
- Storage and Auth assumptions are documented.

Before migrating Auth:

- Email/password policy is confirmed.
- Google OAuth client owner is Protocol.
- Redirect allow-list is known for local, staging, and production.
- User migration/reinvite plan is approved.
- Callback route behavior is tested in staging.

Before migrating data:

- Export source and access are confirmed.
- Auth user strategy is approved.
- Storage object migration plan is approved.
- RLS validation has passed in staging.
- Rollback and write-freeze plan is approved.

Before replacing AI Gateway:

- All Lovable AI call sites are inventoried.
- Owned provider/gateway is selected.
- Adapter contract, model routing, logging, and error behavior are defined.
- Staging proves the main AI flows.

Before removing Lovable packages:

- Auth no longer uses Lovable wrapper.
- Build config replacement passes build and smoke tests.
- AI Gateway is replaced.
- CSP and hardcoded URL cleanup has passed browser smoke tests.

Before changing deployment:

- Cloudflare account/project ownership is confirmed.
- Required secrets are placed in the target environment.
- `APP_ORIGIN` or equivalent origin strategy is decided.
- Build, server functions, Auth, storage, billing, digest, and AI smoke tests pass in staging.

## 9. First 5 small PRs after this inventory

1. Environment variable matrix doc
   - Add a docs-only matrix of variable names, client/server visibility, required environments, owning service, and validation command.
   - Reversible: docs-only.
   - Testable: review against `rg` output.
   - Hidden Lovable access required: no.

2. Backend ownership confirmation template
   - Add a docs-only checklist for humans to fill in Supabase, Cloudflare, Google OAuth, Stripe, Resend, and AI provider owners.
   - Reversible: docs-only.
   - Testable: review for complete owner fields.
   - Hidden Lovable access required: no, but completion does.

3. Supabase migration replay runbook
   - Add a docs-only runbook for staging replay, including preconditions, commands to run manually, expected evidence, and rollback notes.
   - Reversible: docs-only.
   - Testable: dry review against migration files.
   - Hidden Lovable access required: no.

4. Lovable AI Gateway call-site inventory doc
   - Add a docs-only inventory of AI call sites, inputs, outputs, model assumptions, and logging requirements before creating an adapter.
   - Reversible: docs-only.
   - Testable: compare against `rg "ai.gateway.lovable.dev|LOVABLE_API_KEY"`.
   - Hidden Lovable access required: no.

5. Auth redirect and OAuth route verification doc
   - Add a docs-only route and dashboard checklist for `/auth/callback`, intake redirects, Google OAuth callback URL, and local/staging/production origins.
   - Reversible: docs-only.
   - Testable: route/code review and later manual staging smoke tests.
   - Hidden Lovable access required: no for draft, yes for dashboard completion.

Recommended first PR: environment variable matrix doc. It is the smallest non-invasive step and gives later migration, deployment, Auth, billing, digest, and AI work a shared vocabulary without touching runtime behavior.
