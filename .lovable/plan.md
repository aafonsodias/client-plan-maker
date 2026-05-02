
# Plan: Triage 25 requests, ship in 4 phases

You gave me 25 items. Trying to do them all in one turn would mean each one is half-done. Instead I'm grouping by **impact ÷ effort** and proposing we ship **Phase A** now, then come back for B/C/D in later turns. You can re-order at any time.

I'm also creating a persistent task list so nothing is forgotten between turns (item #21).

---

## Phase A — Ship NOW (high impact, low effort, ~1 turn)

These are the "polish + intuitiveness" wins that touch many of your 25 items at once.

**A1. Brief stage compaction & UX (items #7, #8, #15, #16, #18, #10)**
- Tighten vertical spacing on `plans.$planId.brief.tsx` and `BriefEditor.tsx` by ~30% (smaller padding on cards, smaller gaps, denser inputs).
- Replace fixed-height textareas (the ones with grey scrollbars in "Sinais de alerta" and "Segurança e equipamento") with `AutoTextarea` so content always shows in full.
- Add **"Expandir tudo / Colapsar tudo"** controls at top of brief, mirroring the assessment page.
- Make the entire section header clickable (not just the chevron) for collapse/expand.
- After Brief is approved: swap the `[Regenerate] [Approve]` button row for `[✓ Aprovado · há Xm] [Editar] [→ Próximo: Blueprint]`.
- **Add a "Conclusão para a programação" footer to each brief section** — 1–2 line AI-generated takeaway (e.g. "Priorizar movimento unilateral por instabilidade do joelho direito").

**A2. Plans list reactivity (item #2)**
- After delete in `plans.index.tsx`, optimistically remove the row + recompute the quota bar without a refresh.

**A3. Rename "Phased Plan" everywhere (item #22)**
- Rename to **"Plano Faseado"** / **"Phased build"** → just **"Plano de treino"** in user-facing strings. Internal route names stay (`plans.$planId.microcycle` etc.).
- Update i18n keys in `plan.json` (en + pt) and any visible labels.

**A4. Day-level UX in microcycle (items #20 partial, #23 partial)**
- On each exercise row in `SessionDayView.tsx`, add a small `×` (circled) on hover to delete it (we already have the server fn `microcycle-edit.functions.ts`).
- Add a `+ Adicionar exercício` button at the bottom of the day with a search input (filters by name/muscle/equipment from a static list — no AI call).
- Day cards get a subtle alternating accent stripe (Day 1 amber-tinted left border, Day 2 emerald, Day 3 sky) so they're visually distinct.

**A5. Deltas page polish (item #23)**
- "Como ler estes deltas" → expanded by default, button flips to "Colapsar".
- Fix the broken-looking black sparkline in `ProgressionExerciseCard` (use `currentColor` + theme-aware stroke).
- Add a per-exercise rationale line (already in schema as `notes`/`rationale` — just render it).
- Make "Brief aprovado" pill on the right rail use the success-emerald tone (`status-tone.ts`), not muted grey.

**A6. BrandMark adaptive contrast (item #25)**
- `BrandMark.tsx` currently uses a fixed amber glow plate. Detect logo luminance once at upload (or accept a `tone="light"|"dark"` prop) and switch the plate background:
  - dark logo on dark mode → cream/parchment plate
  - light logo on dark mode → keep current dark plate
- Default heuristic: if logo's average luminance < 0.4, use a light plate in dark mode.

**A7. View page breathability + PDF button (item #24 partial)**
- `MesocycleTableView.tsx`: add `mt-6` between day rows, render RPE column unconditionally (currently hidden when undefined — show `—`), show a "SS" chip on grouped supersets in subtitles.
- Promote the "Export PDF" button to a large gradient amber CTA with the BrandMark icon.

---

## Phase B — Next turn (high impact, medium effort)

**B1. Logbook overhaul (item #4) — your "coaching station"**
- Redesign `log.$token.tsx`:
  - Big satisfying check-off interaction (haptic-style animation + tone) on each set logged.
  - Streak counter, weekly compliance ring, "logged X/Y sets this week".
  - History timeline per exercise with mini-line chart of weight×reps progression.
  - "Quick log" mode: tap-to-fill last week's values, then adjust.
- New `client_logs` summary view with PR detection (auto-flag "🏆 PR!" when actuals > previous best).

**B2. Volume / MEV intelligence + spider charts (item #3, #24)**
- New `src/lib/muscle-volume.ts`:
  - Exercise → muscle map (primary 1.0 / secondary 0.5 / stabilizer 0.25 weights).
  - Compute weekly sets per muscle group, compare against MEV/MAV/MRV thresholds (Israetel-style table).
- New `<MuscleVolumeRadar />` and `<MesoFocusRadar />` components — render in:
  - View page (per week + per meso)
  - Microcycle page (per session)
  - Dashboard ("Esta semana")
- Volume vs MEV bar with green/amber/red tone via `status-tone.ts`.

**B3. Logbook camera ingestion (item #24 last sub-bullet)**
- Print PDF gets a "write-in" zone (sets done / RPE / notes columns left blank with thick rules).
- New flow: upload photo of marked-up sheet → Lovable AI vision (gemini-2.5-flash) → parse handwritten cells → preview & confirm → bulk insert into `session_actuals`. Single feature, single edge function.

---

## Phase C — Following turn (medium impact, larger effort)

**C1. Landing/website overhaul + manual + FAQ (items #1, #5)**
- Rewrite `index.tsx` with a 5-stage journey hero, a proper "Como funciona" section, screenshots, social proof slot.
- New routes: `/manual` (step-by-step from signup → first plan), `/faq`, `/contacto` (contact form → emails you / inserts into `feedback` table).

**C2. Assessment fade-section flow + history (item #9)**
- One-section-at-a-time scroll with framer-motion fade transitions; completed sections collapse to gold pill with date.
- "+" button on left to start a new assessment, with auto-recommended next-assessment date.

**C3. Synthesis enrichment (items #6, #11)**
- Add empty-state graphs for Blood pressure, Resting HR, Body composition trend, etc. — placeholders with "Adicionar dados" CTA so the user is guided to capture more.
- "Digitalizar documento" upload in security-review (PDF/photo of medical clearance) → stored in `client_documents` for legal cover.

**C4. Speed up day generation (item #14)**
- Move from sequential per-day Anthropic calls to a single parallelized batch using `Promise.all`, with shared system-prompt cache. Switch Stage 3 to Haiku for the per-day draft (Sonnet only for blueprint + critic). Should cut wall-time ~50%.

---

## Phase D — Deeper R&D (item #17, #19, #3 deep)

**D1. AI training-data improvements (#17, #19)**
- Add a `coach_corrections` table — every time you edit an exercise/delta, store the diff. Use as few-shot examples in future prompts.
- Codify "golden standard" progression heuristics (Helms/Israetel/Schoenfeld) into `src/server/phased/programming-defaults.ts` as deterministic guardrails the AI must respect.
- Periodic "exercise library refresh" — pull a curated list with primary/secondary/stabilizer tagging.

**D2. PDF beauty pass (#24 PDF tail)**
- Add tasteful color (1 accent + 2 muscle-group tones), print-cost-aware (≤15% ink coverage). Keep one-page-per-workout rule.

---

## Task tracking (item #21)

I'll create a `mem://tasks/backlog.md` file holding all 25 items with status `done | in-progress | next | backlog` so we never lose context across turns. Each phase ship will update statuses.

---

## What I need from you

Reply with one of:
- **"go"** → I ship **Phase A** (items 2, 7, 8, 10, 15, 16, 18, 20-partial, 22, 23, 24-partial, 25). One turn, ~10 files.
- **"go + B1"** → Phase A plus the logbook overhaul (heavier turn, ~15 files).
- **re-order** → tell me which item from B/C/D you want pulled into Phase A, and which Phase A item to drop.

Recommended: just say **"go"** so we land a clean polish pass and then attack the logbook + MEV charts with full attention next turn.
