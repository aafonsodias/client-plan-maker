# Lovable Eradication Status v1

## Executive Summary

This pass migrated public-intake Google OAuth from the Lovable cloud-auth wrapper to the existing Supabase OAuth flow without changing intake token validation, assessment submission, email/password auth, or normal `/auth` Google OAuth.

The remaining Lovable references are intentional blockers. They are either build dependencies, AI-provider environment gates, historical documentation, smoke-report archive paths, an existing historical migration URL, or Git history artifacts. Git history was not rewritten.

Protocol is closer to Lovable independence, but not at zero references yet. The next removals must be done as small PRs because the remaining surfaces include build configuration, historical process/archive references, an existing migration URL, and the default AI provider.

## What Was Removed Or Replaced

| Surface | Change | Runtime impact |
| --- | --- | --- |
| Supabase env errors | Replaced "Connect Supabase in Lovable Cloud" with neutral Protocol Supabase environment copy. | No behavior change. |
| Public share fallback | Replaced `https://forge.lovable.app/` fallback with `/`. | Avoids public Lovable URL fallback. |
| Billing origin fallback | Replaced `https://forge.lovable.app` fallback with request origin, `APP_ORIGIN`, then localhost fallback. | Keeps billing redirect origin deterministic without Lovable fallback. |
| Root metadata image | Replaced `gpt-engineer` uploaded image URL with local `/icon-512.png`. | Removes third-party Lovable-era metadata asset. |
| AI comments and local errors | Reworded safe runtime-adjacent comments/errors to refer to the configured AI provider. | No prompt, schema, model, parsing, retry, cost, logging, billing, or persistence change. |
| Env matrix blocker text | Updated stale `forge.lovable.app` blocker status. | Documentation only. |
| Public-intake Google OAuth | Replaced the Lovable auth wrapper call with `supabase.auth.signInWithOAuth({ provider: "google" })` and a safe `/auth/callback?next=/intake/:token` return. | Preserves the public intake token flow. |
| Lovable auth wrapper | Deleted `src/integrations/lovable/index.ts` after no imports remained. | Removes browser runtime dependency on Lovable cloud auth. |
| Lovable cloud-auth package | Removed `@lovable.dev/cloud-auth-js` from `package.json` and `package-lock.json`. | No runtime imports remain. |
| Lovable CSP domains | Removed `https://api.lovable.app` and `https://*.lovable.app` from browser `connect-src`. | Browser runtime no longer needs these domains for intake OAuth. |

## Current Inventory By Category

| Category | Current status | Evidence |
| --- | --- | --- |
| User-facing UI/metadata | Safe obvious Lovable fallbacks were removed. CSP no longer includes Lovable browser domains. | `src/routes/__root.tsx`, `src/components/ShareAppButton.tsx` |
| Runtime code | Public-intake Google OAuth now uses Supabase OAuth directly and returns through `/auth/callback?next=/intake/:token`. | `src/routes/intake.$token.tsx`, `src/routes/auth_.callback.tsx` |
| Server-only provider implementation | Lovable Gateway remains the default active AI provider behind the adapter. | `src/server/ai/provider-adapter.server.ts` |
| Build/dev tooling | Vite still uses the Lovable TanStack config package. | `vite.config.ts`, `package.json` |
| Environment variables | `LOVABLE_API_KEY` remains required while `AI_PROVIDER` is unset or `lovable`. | `.env.example`, `scripts/validate-env.mjs` |
| Package dependencies | The Lovable auth package was removed. The Lovable Vite/TanStack build package remains because `vite.config.ts` still imports it. | `package.json`, `package-lock.json`, `vite.config.ts` |
| CSP/security headers | Lovable browser domains were removed from the root CSP. | `src/routes/__root.tsx` |
| Docs/process archive | Historical docs intentionally retain prior findings and migration evidence. | `docs/protocol/**`, `.lovable/**` |
| Scripts | Smoke scripts still write historical `.lovable` reports; AI calls route through the adapter. | `scripts/r2.2-smoke*.ts` |
| Generated files | No generated route changes were needed in this pass. | `src/routeTree.gen.ts` unchanged |
| Historical-only or Git-history-only | Some references only exist in history or historical docs. | Git history was not rewritten. |

## What Remains And Why

### Public-Intake OAuth

`src/routes/intake.$token.tsx` now calls Supabase OAuth directly:

- provider: `google`
- redirect: `/auth/callback?next=/intake/:token`
- callback behavior: exchange the Supabase OAuth code, validate that `next` is a same-origin `/intake/...` path, then return to that intake link

On return to `/intake/:token`, the existing intake thank-you effect calls `supabase.auth.getUser()`, rejects trainer self-linking, and links the authenticated client account with the unchanged `linkClientAccount` server function.

If Supabase/Google OAuth is not configured remotely, the flow surfaces the Supabase error and does not fall back to Lovable.

### Lovable CSP Domains

`src/routes/__root.tsx` no longer allows:

- `https://api.lovable.app`
- `https://*.lovable.app`

These domains were removed because no browser runtime path needs the Lovable cloud-auth wrapper after the intake OAuth migration.

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
| Lovable remains default AI provider. | Removing `LOVABLE_API_KEY` would break AI in default production config. | Validate `AI_PROVIDER=openai-compatible` in staging, then switch production deliberately. |

## Package And Build Blockers

| Package/config | Why it remains | Removal gate |
| --- | --- | --- |
| `@lovable.dev/vite-tanstack-config` | Required by `vite.config.ts`. | Owned Vite/TanStack config passes build/dev parity. |
| Transitive Lovable build packages | Pulled by the Vite/TanStack config package. | Remove parent package first. |

## Env Blockers

| Variable | Why it remains | Removal gate |
| --- | --- | --- |
| `LOVABLE_API_KEY` | Required by the default AI provider implementation. | Production no longer uses `AI_PROVIDER=lovable` or unset provider mode. |
| `AI_PROVIDER` default of `lovable` | Preserves production behavior. | Staging validates `openai-compatible` across AI surfaces. |

## Exact Next PRs To Reach Zero Lovable References

1. Replace `@lovable.dev/vite-tanstack-config` with owned Vite/TanStack config and remove the package plus lockfile entries after build/dev parity is documented.
2. Validate `AI_PROVIDER=openai-compatible` in staging, switch production intentionally, then remove the Lovable provider implementation and `LOVABLE_API_KEY`.
3. Decide `.lovable/**` archive policy: keep as legacy evidence, move useful pieces to `docs/protocol/legacy/`, or delete once smoke scripts and docs no longer reference it.
4. Add any required new migration or operational update for scheduled-job URLs instead of editing historical migration files.

## Validation Checklist

- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run check:env`
- `rg -n -i "lovable|forge\\.lovable\\.app|gpt-engineer|@lovable|~oauth" . -g "!node_modules" -g "!dist" -g "!.git"`

