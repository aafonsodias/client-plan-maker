---
name: Evidence source ethics
description: Rules for citing studies anywhere in the app — StudiesFeed, plan rationale, knowledge route. Required fields, forbidden patterns, conflict-of-interest discipline.
type: preference
---

# Evidence source ethics

Binds: `src/components/StudiesFeed.tsx`, plan rationale surfaces (BriefEditor, ProgressionExerciseCard), `src/routes/knowledge.tsx`, any future "research" or "why this works" copy.

## Why

Trainers stake their reputation on what we put in front of them. A vague "studies show…" with no reference is worse than no claim — it teaches the trainer to repeat unverifiable folklore to clients. We do not ship folklore.

## Required for every cited study

- **Full citation** — authors (first three + et al), year, journal, DOI or stable URL.
- **Sample size** (`n=`) and population (sex, age band, training status).
- **Effect size** when reported by the original paper (Cohen's d, %, mean diff with units). If the paper didn't compute one, say so.
- **Conflict-of-interest flag** — was the study funded by a supplement / equipment vendor whose product the conclusion favours? If yes, it must be visibly tagged.
- **Translation date** — when did we read the abstract / paper into this app, so a stale claim can be re-checked.

## Forbidden

- Paraphrased "studies show that…" / "research suggests…" with no reference.
- Vendor-funded studies cited as independent evidence (e.g. a creatine brand's own RCT cited without the funding flag).
- Pilot work with **n < 10** cited as evidence rather than as exploratory.
- Animal-model results cited as guidance for human training without explicit "animal model" tag.
- Single-paper claims framed as consensus ("the science is clear" / "it's well established") without a meta-analysis or systematic review backing.
- Conference abstracts cited as if they were peer-reviewed full papers.

## Display rule

If any required field is missing, the surface must either (a) show the citation with a `needs_evidence` chip, or (b) not show the claim at all. Never silently drop the requirements to keep the copy clean.

## Trainer override

Trainers can pin their own citations (future feature). Same rules apply — the app validates the required fields before letting them publish a claim into client-facing material.