# Lovable Eradication Status v1

## Executive Summary

Protocol no longer has an active Lovable runtime, browser, build, package, script-output, or current env dependency.

This pass removed the final active AI dependency by deleting the Lovable Gateway provider implementation from `src/server/ai/provider-adapter.server.ts` and making the OpenAI-compatible provider the only supported adapter provider.

Remaining Lovable references are historical or archival only. Git history and existing migration history were not rewritten.

## What Was Removed Or Replaced

| Surface | Current status | Runtime impact |
| --- | --- | --- |
| Public-intake Google OAuth | Uses Supabase OAuth directly and returns through `/auth/callback?next=/intake/:token`. | No Lovable auth runtime dependency. |
| Lovable auth wrapper | Deleted previously after no imports remained. | No browser runtime dependency on Lovable cloud auth. |
| Lovable cloud-auth package | Removed previously from package files. | No runtime imports remain. |
| Lovable CSP domains | Removed previously from browser `connect-src`. | Browser runtime no longer allows Lovable domains. |
| Vite/TanStack config | Uses owned explicit Vite config. | Build/dev no longer depends on Lovable tooling. |
| Lovable build package | Removed previously from package files. | No Lovable build dependency remains. |
| Lovable AI provider | Removed from `src/server/ai/provider-adapter.server.ts`. | AI runtime now uses OpenAI-compatible provider only. |
| Lovable AI env key | Removed from `.env.example` and `scripts/validate-env.mjs`. | `LOVABLE_API_KEY` is no longer required by the current app. |
| R2.2 smoke output path | Moved from `.lovable/r2.2-smoke-report.md` to `docs/protocol/architecture/r2.2-smoke-report.md`. | Active scripts write to a Protocol-owned path. |

## Current Inventory By Category

| Category | Current status | Evidence |
| --- | --- | --- |
| Runtime AI code | OpenAI-compatible provider only. | `src/server/ai/provider-adapter.server.ts` |
| AI callers | All known AI callers route through the adapter. | `src/server/**`, `scripts/r2.2-smoke2.ts` |
| Environment variables | OpenAI-compatible provider variables are the current AI env surface. | `.env.example`, `scripts/validate-env.mjs` |
| Tests | Mocked tests cover provider selection, missing config, request forwarding, and phased contract behavior without network calls. | `test/ai-provider-adapter.test.ts`, `test/phased-ai-contract.test.ts` |
| Scripts | Current smoke/config scripts no longer require Lovable. | `scripts/ai-provider-smoke.mjs`, `scripts/r2.2-smoke*.ts` |
| Package dependencies | No Lovable package dependency remains. | `package.json`, `package-lock.json` |
| Browser/CSP | No Lovable browser domain is required. | `src/routes/__root.tsx` |
| Archive/history | Historical references remain intentionally. | `.lovable/**`, historical docs, existing migrations, Git history |

## Current AI Provider

The active provider is OpenAI-compatible.

Required for staging and production AI runtime:

- `AI_OPENAI_COMPATIBLE_BASE_URL`
- `AI_OPENAI_COMPATIBLE_API_KEY`

Optional:

- `AI_PROVIDER=openai-compatible`

No `AI_PROVIDER` value besides `openai-compatible` is supported. If `AI_PROVIDER` is unset, the adapter still selects OpenAI-compatible.

## `.lovable` Archive

`.lovable/**` was kept as historical archive material.

Active scripts no longer write there. The current R2.2 smoke report output path is:

```text
docs/protocol/architecture/r2.2-smoke-report.md
```

Deleting or relocating the historical `.lovable/**` archive is now a separate archive-policy decision, not an active runtime removal blocker.

## Existing Migrations

Historical Supabase migrations were not edited. Any Lovable-linked scheduled-job URL in an existing migration must be handled by a new migration or operational change after ownership is confirmed, not by rewriting migration history.

## Remaining References

Remaining Lovable references are classified as:

- historical architecture docs describing earlier migration state
- `.lovable/**` archive content
- existing migration history
- Git history

No remaining reference is an active AI provider, required env variable, package dependency, build dependency, browser runtime dependency, or active script output path.

## Validation Checklist

- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run check:env`
- `npm.cmd run smoke:ai-provider`
- `rg -n -i "lovable|forge\\.lovable\\.app|gpt-engineer|@lovable|~oauth" . -g "!node_modules" -g "!dist" -g "!.git"`

## Next Exact PR To Reach Absolute Zero References

Decide archive/history policy:

1. Move useful `.lovable/**` archive material into a neutral historical docs location or delete it if no longer needed.
2. Rewrite or supersede stale historical architecture docs that describe earlier migration states.
3. Add a new migration or operational update for any historical scheduled-job URL instead of editing existing migration files.

Do not rewrite Git history.
