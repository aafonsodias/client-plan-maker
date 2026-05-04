# Round 32 — Stop the redirects, hide the noise, make Stage 3 fast

The user is right on all three counts:

1. **Stage 3 still navigates away** to `/plans/$planId/microcycle`. The whole journey (Brief → Blueprint → Microcycle → Progressions → PDF) must stay on `/clients/$id`.
2. **Documents and Intake link panels** still take the full width above the assessment, even when there is nothing to see. They should be small corner icons that expand on click.
3. **Microcycle generation hangs**. We're calling `openai/gpt-5` per day with a 1× FITT-VP retry, behind concurrency=5 — for 5 sessions that's 5 sequential heavy GPT-5 calls + retries, easily 200s+ with no progress signal.

Below is a tight plan to fix all three in one round.

## 1. Inline Stage 3 microcycle on the client page (P0)

Create `src/components/MicrocyclePanel.tsx` — extract the body of `MicrocycleReview` from `src/routes/plans.$planId.microcycle.tsx` (load plan, days, realtime subscription, `kickWeek`, regen, approve). Same UI, but:

- Drop `AppShell`, `BriefContextRail`, `BriefSheetButton` — those are the page chrome the user does NOT want.
- Drop `navigate({to: "/plans/$planId/progressions"})` after approve. Instead expose an `onApproved()` callback so `clients_.$clientId.tsx` can `setExpandedStage("progressions")` and kick Stage 4.
- Keep the per-day skeleton cards + ETA bar already added in Round 31.

Wire it into `clients_.$clientId.tsx` Stage 3 `StageCard` (around line 2389):

- Add `expanded={expandedStage === "microcycle"} onToggleExpanded={...}`
- Add `expandedBody={<MicrocyclePanel planId={planId} onApproved={() => { void refreshPlans(); setExpandedStage("progressions"); void runStage("progressions", false); }} />}` when `hasMicrocycleDraft || microcycleApproved`.
- Change `onApprove` so once Blueprint is approved, clicking "Generate Microcycle" calls `runStage("microcycle", false, { skipNavigate: true })` then `setExpandedStage("microcycle")` — never navigate.
- Apply the same "expand inline, no nav" pattern to Stage 4 Progressions for consistency (the route still exists for back-compat, but the client page never navigates there).

Keep `/plans/$planId/microcycle` route as a thin back-compat wrapper that just renders `<MicrocyclePanel planId={...} />` inside `AppShell` (in case an old link is shared) — but the primary entry is inline.

## 2. Documents → corner icon (P1)

Refactor `ClientDocuments.tsx` into a slim icon button:

- Default render: a single `<button>` with a `Stethoscope` icon (lucide), sized `h-9 w-9`, outline + clinical-teal accent (`text-[oklch(0.78_0.10_200)]`). When `items.length > 0` show a tiny count badge in the top-right corner of the button.
- Click opens a shadcn `<Sheet side="right">` containing the existing list + upload UI verbatim.
- In `clients_.$clientId.tsx`, move `<ClientDocuments />` from its full-width row (line 1356) into the header action row alongside `Download PDF` / `Ver como cliente` (line 1358).

Add a `tone-clinical` token to `src/lib/status-tone.ts` so the color is reusable.

## 3. Intake link → corner icon, but only when relevant (P0)

In `clients_.$clientId.tsx`, gate `<IntakeLinkPanel />` (line 1394):

- If `client.intake_status === "submitted"` OR `client.intake_status === "reviewed"` OR an assessment has been saved (`lastSavedAt` exists), DO NOT render the panel inline. Instead render a small `<Send>`-icon button next to Documents in the header action row, labeled "Pedir nova avaliação" on hover. Click opens a `<Sheet>` containing the existing IntakeLinkPanel (which already collapses opened links to a chip).
- Only render the panel inline when the client truly hasn't been assessed yet AND no intake link exists — the original "first-time onboarding" path.

This solves the user's complaint: "I had already filled and opened up the client" → the link panel disappears once the assessment exists, available on demand from a corner icon.

## 4. Make microcycle generation actually fast + visible (P0)

Three changes in `src/server/phased/stage3-microcycle.functions.ts`:

- **Switch model**: change `resolveModel("FORGE_MODEL_STAGE_3", "openai/gpt-5")` (line 446) to `"google/gemini-2.5-flash"`. ~3–5× faster, same tool-call schema. GPT-5 stays available via env override for users who want it.
- **Skip the FITT-VP retry on first generation**: the retry doubles latency for marginal quality gain. Run it only when `prescriptionParameters` AND `priorPool.length > 0` (i.e. block N≥2 where stale-rotation matters most). For block 1, accept first-pass output.
- **Increase concurrency to 7** (one per max session count) so all days fire in parallel instead of in two waves.

Combined ETA estimate update in `plans.$planId.microcycle.tsx` / `MicrocyclePanel.tsx`: change `(sessionsPerWeek - doneCount) * 40` to `* 15` to match Flash latency.

Add a server-side log line at the top of `generateMicrocycleDays` handler so we can confirm in `stack_modern--server-function-logs` that the call landed (the user reported "stayed spinning for a long time without any response" — we need observability).

## 5. Backlog + memory (P2)

Append to `.lovable/backlog.md`:
- Round 32 done: inline Stage 3, corner-icon Documents/Intake, Flash for Stage 3.
- P1 deferred: drag-to-reorder days, per-exercise inline AI comments on edit, searchable warmup catalog.

Save `mem://principles/no-stage-redirects.md`:
> "All 5 stages of the trainer journey (Brief, Blueprint, Microcycle, Progressions, PDF) MUST render inline on `/clients/$id` via expandedBody on the StageCard. Approval auto-collapses the current stage and auto-expands the next. The `/plans/$planId/*` routes exist only for back-compat deep links and must never be `navigate()`d to from the client page flow."

Update `mem://index.md` Memories list.

## Files touched

- new: `src/components/MicrocyclePanel.tsx`
- edited: `src/routes/clients_.$clientId.tsx` (Stage 3 expandedBody, inline Documents/Intake icons, drop Stage 3 navigation)
- edited: `src/components/ClientDocuments.tsx` (collapse to icon + Sheet)
- edited: `src/components/IntakeLinkPanel.tsx` (no internal change unless needed for Sheet)
- edited: `src/routes/plans.$planId.microcycle.tsx` (thin wrapper around new MicrocyclePanel; ETA constant update)
- edited: `src/server/phased/stage3-microcycle.functions.ts` (model swap, conditional FITT-VP retry, concurrency 7, log line)
- edited: `src/lib/status-tone.ts` (add `tone-clinical`)
- edited: `.lovable/backlog.md`, `mem/index.md`
- new: `mem/principles/no-stage-redirects.md`

## Out of scope (explicit)

- Drag-to-reorder days, AI inline comments on per-exercise edit, warmup catalog search — Round 33.
- Touching Brief / Blueprint stage internals (already inline and working).
