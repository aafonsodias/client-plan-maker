---
name: Feature MVP one-pager template
description: Required gate before building any new surface > 1 day of work. Forces a leap-of-faith link + falsifiable metric + smallest version. Anti-overbuild guardrail per Lean Startup.
type: preference
---

## Why this exists

We have shipped beautiful surfaces that didn't tie back to a tested hypothesis
(symptom: features used by zero PTs). Before any new surface that takes >1 day
of work, fill out this template. Pin it in the PR description or the round
spec under `.lovable/`.

If you can't answer all 4 sections in <15 min, the feature isn't ready.

## Template

```
# Feature: <name>
# Author: <you> | Date: <YYYY-MM-DD>

## 1. Which leap-of-faith does this test?
Cite the bet from mem://strategy/leap-of-faith.md (1, 2, 3, or 4).
If "none" — STOP. Either add a new bet or don't build this.

## 2. What's the falsifiable metric?
A number we can read off the DB in 4 weeks that says "this worked" or
"this didn't". NOT "users will love it". NOT "increased engagement".
Example: "≥40% of PTs who see the new <X> screen take the primary action
within 7 days."

## 3. Smallest version that produces that signal?
Strip everything that doesn't move the metric. Concierge / Wizard-of-Oz
versions are encouraged. Examples:
- Manual email instead of in-app notification.
- Hardcoded copy instead of i18n until validated.
- One persona / one locale only.
- No animation, no mobile polish, no edge cases.

## 4. Kill criteria
If the metric is below <threshold> at <date>, we remove this surface.
Without this line, dead features pile up.
```

## Where this applies

- Any new top-level route.
- Any new server fn that touches user-visible behaviour.
- Any new dashboard widget or empty-state surface.
- Any new AI pipeline stage or knob.

## Where this does NOT apply

- Bug fixes.
- Copy/i18n sweeps.
- Refactors with no user-visible change.
- Infrastructure (migrations, indexes, audit hooks).

## Anti-patterns this kills

- "It would be cool if…" features with no metric.
- Building polish for a screen we don't know is used.
- Adding 4 variants of a knob when 1 hasn't been validated.
- Re-running AI in stages we already decided are deterministic.