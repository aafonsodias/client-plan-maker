---
name: 25-item backlog (May 2026)
description: Phase A/B/C/D triage of the 25-item user list. Update statuses as work ships.
type: feature
---
# 25-item backlog

Source: user message 2026-05-02. See `.lovable/plan.md` for the phasing rationale.

## Phase A — IN PROGRESS (this turn)
- [x] #2 Plans status bar reactivity after delete (dashboard PlansStatusBar)
- [x] #7/#8/#15/#16/#18 Brief compaction: collapsible cards (whole-header click), AutoTextarea kills grey scrollbars, expand/collapse-all, conclusion footers, denser spacing
- [x] #10 Brief approved-state confirmation tightened (emerald shadow, PT copy)
- [x] #22 "Phased Plan" → "Plano de treino" (plan title + tooltip)
- [x] #23 partial: deltas guide expanded by default; "Brief aprovado" rail pill = emerald tone
- [x] #25 BrandMark adaptive cream plate when logo luminance < 0.45

## Phase A — DEFERRED (ran out of time this turn, do first next turn)
- [x] #20 partial: MesocycleTableView delete-exercise (across all weeks) via deleteExerciseAcrossWeeks. Add-exercise picker still deferred.
- [x] #23 ProgressionExerciseCard already shows rationale by default + signed-trend coloured sparkline (better than currentColor).
- [x] #24 MesocycleTableView day-row breathability (6px gap), unconditional RPE column (already in place), SS chip in name cell, big amber-gradient Exportar PDF CTA.

## Still pending after this turn
- [x] #20 add-exercise dialog (server fn `addExerciseAcrossWeeks` + dialog with sets/reps/rpe/rest + insert-after picker). Search/autocomplete still backlog.
- [x] #23 day-card colour differentiation in SessionDayView (per-day hue on ghost number, divider gradient, "Day N" chip)

## Phase B turn 1 — DONE
- [x] Founder recognition (AppShell crown chip + DB upgrade for aafonsodias@gmail.com, trial banner suppressed)
- [x] Day rationale expanded by default + full collapse (SessionDayView)
- [x] PrepCluster — colour-coded warmup/activation/dynamic in single collapsible card with duration estimate
- [x] Mobile landing header — overflow menu for currency/lang/theme below sm
- [x] Landing voice rewrite (PT + EN): coaching workbench, no more "à meia-noite" / "90 segundos"
- [x] How-it-works visual: stepper with monoline icons, sketch SVG bg, loop indicator

## Phase B turn 2 — pending your call
- [ ] Drawings/illustrations strategy (6 inline SVGs + 3-tier exercise demo fallback) — awaiting approval

## Phase B — next turn
- [x] #4 Logbook overhaul shipped: set-by-set check-off, autosave/restore, PR detection, streak chip, week confetti. Trainer quick-mark from SessionDayView still backlog.
- [x] #3 MEV/MAV/MRV intelligence + spider chart (per week, on /plans/$id). Counting policy: 1.0 primary + 0.5 secondary. Landmarks: single intermediate profile (Helms/Israetel). Diagnostic only — no auto-edits. Personalisation by experience_level deferred.
- [x] #24 tail: PDF write-in zone already exists in pdf.ts (S1/S2/S3 reps×load@RPE blanks + notes). OCR ingestion shipped via extractSessionFromImage (Gemini 2.5 Pro vision + tool-call) and ImportFromPhotoButton in /log/$token. Positional merge respects user-typed values; confidence + per-row preview before apply.

## Phase C — following turn
- [ ] #1 Landing revamp (first-time-visitor pass)
- [x] #5 Manual + FAQ + Contacto: consolidados numa só rota `/manual` com 3 modos (Manual, FAQ, Contacto). Sem novas rotas para manter, sem nav extra. Contacto usa `mailto:` (sem backend novo).
- [~] #9 Assessment **fade-section** done (modo focado: 1 secção de cada vez, fade + nav prev/next + tab pills, persistido por cliente, default ON). History pills ainda por fazer.
- [ ] #6 + #11 Synthesis enrichment + "digitalizar documento" upload
- [ ] #14 Speed: Promise.all per-day + Haiku for stage 3

## Phase D — R&D
- [ ] #17 + #19 coach_corrections few-shot + golden-standard guardrails (Helms/Israetel/Schoenfeld)
- [ ] #24 PDF beauty pass (color, ≤15% ink coverage)

## Won't address again unless raised
- #12, #13, #21 — meta principles, applied throughout work above (not discrete tasks).