# Lovable Eradication Status v1

## Executive Summary

This pass removed safe Lovable traces from app-facing and runtime-adjacent surfaces without changing production behavior.

The remaining Lovable references are intentional blockers. They are either active runtime dependencies, build dependencies, environment gates, historical documentation, smoke-report archive paths, or Git history artifacts. Git history was not rewritten.

Protocol is closer to Lovable independence, but not at zero references yet. The next removals must be done as small PRs because the remaining surfaces include public-intake OAuth, build configuration, CSP, and the default AI provider.

## What Was Removed Or Replaced

| Surface | Change | Runtime impact |
| --- | --- | --- |
| Supabase env errors | Replaced "Connect Supabase in Lovable Cloud" with neutral Protocol Supabase environment copy. | No behavior change. |
| Public share fallback | Replaced `https://forge.lovable.app/` fallback with `/`. | Avoids public Lovable URL fallback. |
| Billing origin fallback | Replaced `https://forge.lovable.app` fallback with request origin, `APP_ORIGIN`, then localhost fallback. | Keeps billing redirect origin deterministic without Lovable fallback. |
| Root metadata image | Replaced `gpt-engineer` uploaded image URL with local `/icon-512.png`. | Removes third-party Lovable-era metadata asset. |
| AI comments and local errors | Reworded safe runtime-adjacent comments/errors to refer to the configured AI provider. | No prompt, schema, model, parsing, retry, cost, logging, billing, or persistence change. |
| Env matrix blocker text | Updated stale `forge.lovable.app` blocker status. | Documentation only. |

## Current Inventory By Category

| Category | Current status | Evidence |
| --- | --- | --- |
| User-facing UI/metadata | Safe obvious Lovable fallbacks were removed. CSP still includes Lovable domains. | `src/routes/__root.tsx`, `src/components/ShareAppButton.tsx` |
| Runtime code | Public-intake Google OAuth still imports the Lovable auth wrapper. | `src/routes/intake.$token.tsx`, `src/integrations/lovable/index.ts` |
| Server-only provider implementation | Lovable Gateway remains the default active AI provider behind the adapter. | `src/server/ai/provider-adapter.server.ts` |
| Build/dev tooling | Vite still uses the Lovable TanStack config package. | `vite.config.ts`, `package.json` |
| Environment variables | `LOVABLE_API_KEY` remains required while `AI_PROVIDER` is unset or `lovable`. | `.env.example`, `scripts/validate-env.mjs` |
| Package dependencies | Lovable auth and build packages remain because imports still exist. | `package.json`, `package-lock.json` |
| CSP/security headers | Lovable domains remain because public-intake auth still uses the wrapper and removal has not been browser-smoked. | `src/routes/__root.tsx` |
| Docs/process archive | Historical docs intentionally retain prior findings and migration evidence. | `docs/protocol/**`, `.lovable/**` |
| Scripts | Smoke scripts still write historical `.lovable` reports; AI calls route through the adapter. | `scripts/r2.2-smoke*.ts` |
| Generated files | No generated route changes were needed in this pass. | `src/routeTree.gen.ts` unchanged |
| Historical-only or Git-history-only | Some references only exist in history or historical docs. | Git history was not rewritten. |

## What Remains And Why

### Public-Intake OAuth

`src/routes/intake.$token.tsx` still calls `lovable.auth.signInWithOAuth("google", ...)` through `src/integrations/lovable/index.ts`.

This was not removed because it is a runtime auth path. Removing it safely requires an owned Supabase OAuth callback flow for public intake, redirect URL verification, and staging tests. Until that is done, `@lovable.dev/cloud-auth-js` must remain installed.

### Lovable CSP Domains

`src/routes/__root.tsx` still allows:

- `https://api.lovable.app`
- `https://*.lovable.app`

These were not removed because the public-intake OAuth wrapper remains. Remove them only after the intake OAuth path is migrated and browser validation confirms no runtime request still needs these domains.

### Lovable Vite/TanStack Config

`vite.config.ts` still imports `defineConfig` from `@lovable.dev/vite-tanstack-config`.

This was not removed because the package controls build-time behavior. Replacing it requires a parity PR that documents the current plugin behavior, creates owned Vite/TanStack config, and proves build/dev parity.

### Lovable AI Provider

`src/server/ai/provider-adapter.server.ts` still contains the Lovable Gateway implementation and defaults to `lovable` when `AI_PROVIDER` is unset.

This is intentional. All known runtime AI callers route through the adapter, but production behavior must not silently switch providers. `LOVABLE_API_KEY` can be removed only after `AI_PROVIDER=openai-compatible` is validated in staging and production cutover is approved.

### Environment References

`LOVABLE_API_KEY` remains in `.env.example`, `scripts/validate-env.mjs`, and architecture docs.

This is required while Lovable remains the default active provider. The validation script must keep checking the key for default Lovable mode so missing configuration fails clearly without printing values.

### `.lovable` Archive

`.lovable/**` was kept.

The directory appears to contain historical prompts, feedback, planning evidence, and smoke-report output. It is also referenced by smoke scripts and docs. Deleting it in this pass would hide migration evidence and could break existing maintenance scripts that append historical reports.

### Existing Migrations

Historical Supabase migrations were not edited. Any Lovable-linked scheduled-job URL in an existing migration must be handled by a new migration or operational change after ownership is confirmed, not by rewriting migration history.

## Runtime Blockers

| Blocker | Why it blocks zero Lovable references | Smallest safe next move |
| --- | --- | --- |
| Public-intake Google OAuth still uses the Lovable auth wrapper. | The route is runtime-facing and may be the only Google OAuth path for intake users. | Add a Supabase-owned `/auth/callback` or intake-specific callback flow and staging-test it. |
| CSP still permits Lovable domains. | Removing CSP before auth migration could break intake OAuth. | Remove after intake OAuth no longer calls the Lovable wrapper. |
| Lovable remains default AI provider. | Removing `LOVABLE_API_KEY` would break AI in default production config. | Validate `AI_PROVIDER=openai-compatible` in staging, then switch production deliberately. |

## Package And Build Blockers

| Package/config | Why it remains | Removal gate |
| --- | --- | --- |
| `@lovable.dev/cloud-auth-js` | Required by `src/integrations/lovable/index.ts`. | No runtime imports remain after intake OAuth migration. |
| `@lovable.dev/vite-tanstack-config` | Required by `vite.config.ts`. | Owned Vite/TanStack config passes build/dev parity. |
| Transitive Lovable build packages | Pulled by the Vite/TanStack config package. | Remove parent package first. |

## Env Blockers

| Variable | Why it remains | Removal gate |
| --- | --- | --- |
| `LOVABLE_API_KEY` | Required by the default AI provider implementation. | Production no longer uses `AI_PROVIDER=lovable` or unset provider mode. |
| `AI_PROVIDER` default of `lovable` | Preserves production behavior. | Staging validates `openai-compatible` across AI surfaces. |

## Exact Next PRs To Reach Zero Lovable References

1. Migrate public-intake Google OAuth off `src/integrations/lovable/index.ts` and onto owned Supabase OAuth callback handling. Then remove `@lovable.dev/cloud-auth-js` if no imports remain.
2. Remove Lovable CSP domains after intake OAuth is confirmed to no longer require them and browser smoke tests pass.
3. Replace `@lovable.dev/vite-tanstack-config` with owned Vite/TanStack config and remove the package plus lockfile entries.
4. Validate `AI_PROVIDER=openai-compatible` in staging, switch production intentionally, then remove the Lovable provider implementation and `LOVABLE_API_KEY`.
5. Decide `.lovable/**` archive policy: keep as legacy evidence, move useful pieces to `docs/protocol/legacy/`, or delete once smoke scripts and docs no longer reference it.
6. Add any required new migration or operational update for scheduled-job URLs instead of editing historical migration files.

## Validation Checklist

- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run check:env`
- `rg -n -i "lovable|forge\\.lovable\\.app|gpt-engineer|@lovable|~oauth" . -g "!node_modules" -g "!dist" -g "!.git"`

