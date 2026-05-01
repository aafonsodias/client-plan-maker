## Findings

**Problem 1 — Already correct in code, not a one-line fix.**
The toast action in `src/routes/clients_.$clientId.tsx` (line 1469–1472) already calls:
```ts
navigate({ to: "/plans/$planId/brief", params: { planId: res.planId } })
```
The route file `src/routes/plans.$planId.brief.tsx` is registered correctly in `routeTree.gen.ts` at `/plans/$planId/brief`. So the navigation target itself is right.

What is likely happening instead:
- The DB has only one phased-eligible plan: `819c0eef…` (legacy plan, `generation_status = in_progress`, title `"… – 4-Week Plan"`).
- `startPhasedPlanDraft` reuses any plan where `generation_status != 'complete'`, so it returns this legacy plan's id and skips synthesis (because `brief` is already non-null).
- Clicking Review **does** go to `/plans/819c0eef…/brief`. Its `brief` JSONB is populated and parses against `BriefSchema`, so the editor should render — unless the user is misreading the screen, or `BriefSchema.safeParse` is silently failing on a field we haven't spotted.

So the real fix is the debug line in Problem 2 — once it's there, we'll know whether `brief` is null/unparseable or whether the user is on the wrong route.

## Changes (one file only)

**`src/routes/plans.$planId.brief.tsx`** — replace the `if (!brief)` empty-state block (lines 93–107) so it shows an unmistakable debug banner with the plan id:

```tsx
if (!brief) {
  return (
    <div className="mx-auto max-w-3xl p-8 text-center">
      <p className="font-mono text-sm text-destructive">
        DEBUG: Brief is null or failed schema parse (plan {planId})
      </p>
      <p className="mt-2 text-muted-foreground">No brief yet.</p>
      <button
        onClick={regenerate}
        disabled={regenerating}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Generate brief
      </button>
    </div>
  );
}
```

Also log to the console inside `load()` so we can see the raw row + parse result:

```ts
console.log('[brief route] planId=', planId, 'raw brief=', (data as any).brief,
            'parsed.success=', parsed.success,
            parsed.success ? null : parsed.error.issues);
```

## What I will report back

After deploying:
1. The exact URL the browser shows after clicking Review.
2. Whether the debug banner appears (Brief is null) or the editor renders.
3. The console output from `[brief route]` so we know whether the JSONB is missing or just failing schema validation.

## Out of scope

- No changes to `clients_.$clientId.tsx` (toast target is already correct).
- No changes to `startPhasedPlanDraft` or any Stage 2–5 logic.
- No DB writes.
