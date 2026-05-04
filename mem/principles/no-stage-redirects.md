---
name: No stage redirects
description: All 5 trainer-journey stages render inline on /clients/$id, never via navigate
type: preference
---
All 5 stages of the trainer journey (Brief, Blueprint, Microcycle, Progressions, PDF) MUST render inline on `/clients/$id` via `expandedBody` on the StageCard. Approval auto-collapses the current stage and auto-expands the next. The `/plans/$planId/*` routes exist only as thin back-compat wrappers around the same panels and must NEVER be `navigate()`d to from the client-page flow. **Why:** the user wants a single uninterrupted assessment → PDF page; jumping to a new route breaks the mental model and the journey thread.
