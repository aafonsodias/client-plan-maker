## Applying Lean Startup to Protocol — rough plan (no code yet)

Read the summary you sent. Below is the honest mapping to where we are today, what's already aligned, and a small set of moves that would actually move the needle when you have credits again.

### Where Protocol already matches the playbook

- **Build-Measure-Learn** is literally the R-D loop: `audit_events` + `adaptation_proposals` + `progress_markers` are the "measure" layer; `decideAdaptation` is the "learn → decide" gate. Trainer is the steering wheel.
- **Restraint copy contract** ("Protocol surfaces evidence. You decide.") is the anti-vanity-metric stance — engine output is evidence, not directive.
- **Innovation accounting**: `generation_log` per AI call, `inputs_hash` on markers, append-only audit. We already refuse to fake progress.
- **Small batches**: the 5-stage pipeline (Brief → Blueprint → Microcycle → Progressions → Bulk-fill) is single-piece flow for plan generation. Stage isolation = andon chord.

### Where the book exposes gaps worth fixing

1. **Leap-of-faith assumptions aren't written down.** We have a backlog but no living doc of the 3–5 bets that, if false, kill the product. Candidates: (a) PTs will trust an AI-drafted plan if they keep final say, (b) PTs will pay €X/mo at the Starter cap of 8 clients, (c) clients will log sessions often enough to feed the adaptation engine, (d) block-to-block evolution is a felt differentiator vs. Trainerize. → Lightweight: `mem://strategy/leap-of-faith.md` listing each bet + the metric that would falsify it.

2. **No value vs growth hypothesis split.** Today the landing pitches both at once. The book is blunt: pick one engine. For us realistically = **sticky engine** (churn-driven SaaS), not viral. → Means we should be tracking *plan-finalize → next-block-decide* conversion and *trainer monthly active* as the two numbers that matter, and stop optimizing anything else until those move.

3. **MVP discipline on new features.** We've shipped a lot (Intensity Cockpit, Capacity-Gain, Casa do cliente, multi-block lineage, Tour, Demo Lab…). Each is genuinely good, but the book would call several "high-quality answers to unvalidated questions". Concrete proposal: before the next big surface, write a 1-pager: *which leap-of-faith does this test, what's the falsifiable metric, what's the smallest version that produces that signal.* Pin it in `mem://principles/`.

4. **Concierge MVP for the adaptation review screen.** `/clients/$clientId/adaptation/$proposalId` exists but we don't know if PTs actually decide there vs ignore it. A concierge move: for the first 5 paying PTs, you (or a founder-only Slack/email) deliver the proposal manually, watch what they change, then bake that into the UI. Cheaper than guessing.

5. **Vanity metrics audit.** Dashboard today shows several counts (clients, plans, pending decisions). The book asks: which of these would a trainer change behaviour over? → Probably only "pending decisions" and "intake-submitted-needs-review". The rest can move to a secondary tab. (UI only, low risk.)

6. **Five Whys when things break.** We have generation_log + audit but no ritual. Proposal: when a Stage 3 retry fires or a proposal is `defer`-ed twice, auto-open a `.lovable/post-mortems/{date}.md` template. Forces the systemic fix instead of patching the symptom.

7. **Pivot-or-persevere checkpoint.** Suggest a fixed monthly self-review (15 min) using the 3 metrics from #2. If two consecutive months are flat → pivot a knob (pricing tier, target persona, primary surface). Document at `mem://strategy/pivot-log.md`.

### What I'd actually do, in order, when credits come back

1. Write `mem://strategy/leap-of-faith.md` (30 min, no code).
2. Strip the dashboard down to the 2–3 metrics that map to the sticky engine; demote the rest. (UI-only.)
3. Add a one-pager template at `mem://principles/feature-mvp-template.md` and require it for any new surface > 1 day of work.
4. Wire a tiny `pivot_review` reminder (could just be a calendar event, doesn't need to be in-app).
5. After 4 weeks of data, decide which engine is actually turning (sticky vs paid vs word-of-mouth) and concentrate the next quarter's work there.

### What I would NOT do based on this book

- Don't viral-loop the product (clients invite friends → trainers). Wrong audience; would dilute the PT-only positioning we just locked.
- Don't gut the Intensity Cockpit / Capacity-Gain / multi-block work to "ship MVP" — that craft *is* the differentiator and the early-adopter PT is exactly the persona who notices.
- Don't add growth experiments before we know retention. Per the book, growing a leaky bucket is the classic mistake.

No files touched. Approve and I'll execute (or any subset) next time you have credits.