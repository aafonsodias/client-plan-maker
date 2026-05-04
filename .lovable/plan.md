## What I found

You are stuck on Stage 2 because the latest Blueprint calls are failing before a draft is saved.

The generation log already records cost, tokens, duration, model, retries, and errors. For the stuck plan, the two latest Blueprint attempts both failed with:

```text
Stage: stage2:blueprint
Model: openai/gpt-5-mini
Error: Schema validation failed after retry
Internal detail: Model did not call the required tool
Cost: about $0.006789 each
Time: about 32–34 seconds each
```

So the “money/time panel” is not hard. The data is already there; it mostly needs a clean server function and founder-only UI. The urgent issue is that Blueprint is currently using a model/config that is not reliably following the required tool-call contract.

## Plan

### 1. Unblock Stage 2 Blueprint first

Fix `src/server/phased/stage2-blueprint.functions.ts` so Blueprint generation becomes reliable again:

- Change Stage 2’s default model away from the current `openai/gpt-5-mini` path that is failing tool-calls.
- Use the app’s working Lovable AI default model for this structured step unless an env override is intentionally set.
- Add a deterministic fallback for Blueprint if the AI still fails:
  - use the approved brief’s mesocycle length and session frequency;
  - create simple session archetypes from goal/equipment/tier;
  - build a valid `week_to_session_map`;
  - save it as a draft with a clear metadata note that this Blueprint was “safe fallback generated,” not fully AI-authored.
- Keep logging the failed AI attempt to `generation_log`, then log the deterministic fallback as a zero-cost recovery row.

This means the button should stop dead-ending. Worst case, you get a conservative editable Blueprint instead of being blocked.

### 2. Make the generation buttons explain what is happening

Improve the StageCard / client detail generation UI:

- Replace rudimentary “Generate Blueprint” states with a small “under the hood” strip:
  - model or method used;
  - current action: “calling AI,” “validating schema,” “saving draft,” “fallback used”;
  - elapsed time while running;
  - last error if it failed;
  - “view details” line for founder mode.
- Make failures actionable:
  - show the friendly error;
  - if available, show the internal validation reason (`zodError`) in a small founder-only detail area;
  - leave the user on the page with a retry button and a path forward.

### 3. Add founder-only cost/time chips next to calculation/generation stages

For `aafonsodias@gmail.com` only:

- Add a tiny colorful chip beside each StageCard action:
  - latest cost for that stage;
  - average duration for that stage;
  - failure count if relevant.
- Example display:

```text
Blueprint     $0.0056 avg · 5.5s
Microcycle    $0.052 avg · 51s/day
Progressions  $0.014 avg · 11s
```

This keeps the product light for real users, but gives you founder visibility while building.

### 4. Add a compact founder telemetry panel

Add a founder-only panel on the client detail page, near the generation stages:

```text
AI spend for this plan
Stage                  Calls   Cost     Avg time   Failures
Brief                  1       $0.0003  2.7s       0
Blueprint              2       $0.0136  33.2s      2
Pre-analysis total     14      $0.0200  1.2s       3
```

Also include an account-level summary for recent runs:

```text
Last 7 days: $X.XXXX · N calls · avg Ys · F failures
```

Important: this panel will read from existing `generation_log`; no new database tables are needed.

### 5. Add server-side telemetry readers

Create a small authenticated server function file, likely `src/server/generation-telemetry.functions.ts`, with functions such as:

- `getPlanGenerationTelemetry(planId)`
  - verifies the trainer owns the plan;
  - returns grouped cost/duration/error stats for that plan.
- `getTrainerGenerationTelemetry()`
  - returns recent aggregate totals for the logged-in trainer.

Use the existing row-level protections and authenticated server function pattern. No client-side secret access.

### 6. Fix the missing translation warning

Add the missing key in both assessment translation files:

- `assessment:generate.brief_coverage` in English
- `assessment:generate.brief_coverage` in Portuguese

This removes the repeated console warning.

### 7. Update backlog / plan notes honestly

Update `.lovable/backlog.md` to close this round as:

- Stage 2 Blueprint unblock
- Founder AI spend/time telemetry
- Generation buttons explain under-the-hood state
- Missing i18n key fix

And leave the larger knowledge-roadmap items parked, because they are not the right move while the pipeline itself is blocked.

## What I will not do in this pass

- No new billing/subscription logic.
- No public AI-cost dashboard for normal users.
- No new database table unless a hidden schema issue appears.
- No resurrecting Demo Lab UI.
- No heavy analytics page; keep it tiny and founder-only.

## Expected result

After implementation:

- You should be able to click Stage 2 Blueprint and get unstuck.
- If AI fails, the app saves a conservative editable fallback instead of wasting time and money repeatedly.
- Founder mode shows small, useful cost/time telemetry next to generation stages.
- The software better justifies itself by showing what it is doing under the hood without making the main UI heavy.