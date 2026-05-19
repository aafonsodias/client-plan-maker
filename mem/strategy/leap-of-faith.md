---
name: Leap-of-faith assumptions
description: The 4 bets that, if false, kill Protocol. Each has a falsifiable metric and a review cadence. Inspired by Ries, "The Lean Startup" (validated learning + innovation accounting).
type: feature
---

## Why this exists

Per Lean Startup: a startup's job is to discover, as fast as possible, whether
its riskiest assumptions are true. Protocol has shipped a lot of craft
(Intensity Cockpit, multi-block, Casa do cliente, R-D adaptation gate). The
book would call several of these "high-quality answers to unvalidated
questions". This file is the single place where we name what we're betting on
and what number would prove us wrong.

Review monthly (15 min). Two flat months on any metric = pivot the knob.

## The 4 bets

### 1. Value — PTs trust an AI-drafted plan if they keep final say
- **Hypothesis**: Portuguese personal trainers will adopt a tool that drafts
  scientifically valid plans in 90s, *provided* the trainer is the decider on
  every prescription and progression (R-D restraint contract).
- **Falsifiable metric**: ≥60% of finalized plans show ≥1 trainer edit between
  Stage 4 output and the published version. If trainers rubber-stamp AI output
  (zero edits), they don't trust the tool — they're just running it.
- **Counter-signal**: ≥30% of `adaptation_proposals` end in `defer` or are
  ignored >14 days → trainers don't engage with the gate.

### 2. Pricing — Starter tier @ €X/mo with 8-client cap is the right entry
- **Hypothesis**: The 8/8 Starter cap is generous enough to convert solo PTs
  but tight enough that growing PTs upgrade to Pro within 3 months.
- **Falsifiable metric**: ≥20% of Starter accounts hit the cap within 90 days
  AND ≥50% of those upgrade vs churn. If neither, pricing is mispriced
  (either too generous or too punitive).

### 3. Engagement — clients log sessions often enough to feed adaptation
- **Hypothesis**: Clients will log ≥80% of prescribed sessions via `/log/$token`,
  giving the adaptation engine enough signal to propose meaningful Block N+1
  evolutions.
- **Falsifiable metric**: Median session-log adherence across active clients
  ≥80% at the 4-week mark. Below this, `proposeNextBlock` is operating on
  garbage and the whole multi-block story collapses.
- **Fallback**: if adherence is structurally <60%, pivot to a "trainer logs
  for client" workflow (in-session capture) and de-emphasize self-log.

### 4. Differentiation — block-to-block evolution is felt vs Trainerize
- **Hypothesis**: PTs perceive the multi-block lineage + capacity-gain card +
  evidence-based adaptation as a category-of-one differentiator, not a nice-to-
  have.
- **Falsifiable metric**: Of PTs who reach Block 2 with a client, ≥70% generate
  Block 3 within 14 days of Block 2 finalization. If they stop at Block 1,
  the "evolution" promise isn't landing.
- **Counter-signal**: NPS-style "what would you miss most?" survey at month 2
  — if multi-block is not in top 3 answers, it's craft we love but they don't.

## What we are explicitly NOT betting on

- Virality. PT → PT word of mouth is a bonus, not the engine.
- Client-side polish driving conversion. Casa do cliente exists for retention
  of the trainer's clients, not as a B2C acquisition surface.
- Mobile-native app. Web on iOS Safari at 375px is the floor.

## Review log

- 2026-05-19 — file created. Baselines not yet measured. First review when
  there are ≥5 paying PTs with ≥2 weeks of usage.