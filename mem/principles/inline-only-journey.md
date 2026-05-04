---
name: Inline-only client journey
description: All five plan-creation stages (Assessment → Brief → Blueprint → Microcycle → Progressions → PDF) live on /clients/$id. Plans-list rows expand inline, never navigate.
type: preference
---

The trainer never leaves `/clients/$id` while building a plan. Every stage —
Assessment, Brief, Blueprint, Microcycle, Progressions, and the final PDF
hand-off — renders inline on that page via `<StageCard>` + `<MicrocyclePanel>`
+ `<BlueprintEditorPanel>`.

**Why:** Context loss kills review quality. Bouncing to `/plans/$planId/<stage>`
breaks the loop "see brief → see blueprint → see microcycle" because each
window is its own page with its own scroll, its own header, its own state
hydration. One page = one mental model.

**How to apply:**
- Plans-list rows for phased drafts are `<button>` elements that call
  `openPhasedDraft(planId, stage)` — they never use `<Link>`.
- The standalone routes `/plans/$planId/{brief,blueprint,microcycle,progressions}`
  exist only as redirect shells (`navigate({ to: "/clients/$clientId" })`).
  Bookmarks still resolve, but nothing in the app produces them.
- New stage UIs: build them as components consumed inside the StageCard
  expandedBody on `clients_.$clientId.tsx`, never as standalone routes.
- Collapsing the assessment hides ONLY the questionnaire. The green
  "Avaliação completa · X%" chip and the stage cards remain visible below.
