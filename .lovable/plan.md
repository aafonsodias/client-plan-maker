# Round 2 continuation — A0/A0a prerequisites + A1→B4

The foundation work from the previous turn (migration, libs, `MovementPatternCard`, schema, prompt block) is in place. Before resuming the wired-up UI work in `.lovable/plan.md`, two responsive fixes go in first because they affect every screen we'll review at the stop point.

Order is strict. Typecheck after each step. Stop after B4 with 5 viewport screenshots.

---

## A0 — Responsive nav with hamburger (`src/components/AppShell.tsx`)

The current header packs Logo · Dashboard · Clientes · Marca · pt/en buttons · Faturação · Página inicial · Terminar sessão into one row. It clips on desktop and loses items on mobile.

Changes inside `AppShell.tsx`:

- Add a unified `navItems` array combining the existing primary nav (Dashboard, Clientes, Marca) plus secondary actions (Faturação → `/billing`, Página inicial → `/`, Terminar sessão → `signOut`). Each item gets `{ to|onClick, label, icon, active }`.
- **≥ md (768px)**: keep horizontal layout, but
  - wrap the row in `max-w-screen-xl mx-auto` with `gap-2`;
  - replace the inline `LanguageSwitcher` (two pill buttons) with a compact `DropdownMenu` triggered by a `Globe` icon (saves ~80px). Menu items: `Português` / `English`, current locale checked.
  - apply `truncate` + `min-w-0` to every label span so long translations clip cleanly instead of overflowing.
- **< md**: hide the inline nav and the inline secondary buttons. Show a `Menu` (Lucide) `Button variant="ghost" size="icon"`. On click it opens a shadcn `Sheet` (`side="right"`) with:
  - full-width tappable rows for every nav item, active route highlighted with `bg-secondary`;
  - the `Globe` locale picker as the last item before Terminar sessão;
  - the trial banner stays at the top of the page (unchanged).
- The ⚡ FORGE Logo + brand name stays left-aligned at every width.
- Founder badge (queued for later) renders inside the Sheet header / a `DropdownMenu` user chip — not back on the nav row.

Acceptance:
- 375px → only Logo + hamburger visible; sheet exposes every item.
- 1280px → all items visible with no clipping; locale is a single icon trigger.

---

## A0a — Mobile horizontal-scroll audit on `/clients/$clientId`

User reports a horizontal scrollbar at 375px on the assessment page. Targeted sweep across `src/routes/clients_.$clientId.tsx`, `src/components/IntakeLinkPanel.tsx`, and `src/components/AppShell.tsx`:

- Remove any `overflow-x-auto` on the top header container (the new hamburger makes it unnecessary and it currently masks overflow).
- Add `min-w-0` to every flex child that holds text (section headers, brief card rows, stage card rows) so flex items can shrink.
- `<input>`, `<select>`, `<textarea>` inside section cards: enforce `w-full max-w-full`.
- Every grid in `SectionBlock` that uses `md:grid-cols-2|3` must set a `grid-cols-1` base. Audit each grid declaration in the route file and patch the missing bases.
- Long textarea content (e.g. "Lesões"): apply `whitespace-pre-wrap break-words` to the rendered/preview spans.
- Setup section's Equipment pill row → `flex flex-wrap gap-2`.
- `IntakeLinkPanel`: header stack becomes `flex-col gap-2 sm:flex-row sm:items-center`; "Generate intake link" button gets `w-full sm:w-auto` and `whitespace-normal text-left`.
- Outer page container in the route: ensure `max-w-full overflow-x-hidden` on the root wrapper and remove any fixed `min-w-[…]` left over from earlier iterations.

Acceptance: zero horizontal scrollbar at 375px on `/clients/$clientId`. Section cards never exceed container width.

QA at 5 viewports via `browser--set_viewport_size`: 375, 414, 768, 1024, 1280. Screenshots taken at the stop point.

---

## Then resume the queued work from `.lovable/plan.md`

Same order, same acceptance criteria as written there. No changes to scope; just re-listing for traceability:

1. **A1** — remove `ClientSnapshotCard`, add inline "Última avaliação · DD/MM/YYYY →" link in the route header that smooth-scrolls to `#sintese-da-avaliacao`.
2. **A2** — server: extend `analyzeAssessmentSection` `InputSchema` with `locale`, persist into `section_analyses_locale`, expose `analyses_locale` in coverage. Client: stale-locale detection + "Re-analisar avaliação" button (sequential 14-section loop with `N/14` progress + cost-confirmation dialog).
3. **A3** — pt-PT sweep using `src/lib/brief-labels.ts` + i18n keys: `IntakeLinkPanel`, `StageCard` (label props default EN, all call sites pass pt-PT: `Regenerar` / `Aprovar` / `A gerar…` / placeholder / `Etapa N — {title}`), `BriefEditor`, leftover EN literals in `clients_.$clientId.tsx` and `AppShell`.
4. **A4** — in `SectionBlock`, hide the deterministic stub when `sectionAnalyses[id]` exists; render only `SectionAnalysisCard`. Fall back to deterministic stub when no AI insight.
5. **A5** — Risk Stratification gets sBP/dBP number inputs + "Como medir" tooltip. `categorizeBp` (already in `src/lib/blood-pressure.ts`) drives a colored category pill. `stage1+` auto-toggles `risk.hypertension` (locked while measured BP indicates HTN). `crisis` renders red banner and disables "Gerar rascunho do plano". BP added to `pickSectionPayload('risk')` and surfaced in synthesis ACSM caption ("…TA 118/76"). Brief AI prompt extended with stage2/crisis branches.
6. **B1** — replace the 4 `<ScreenItem>`s with 6 `<MovementPatternCard>`s (squat / hinge / push / pull / carry / lunge). Hydrate `<pattern>_form_criteria`, `<pattern>_capacity`, `screen_not_assessed` from assessment row; persist via `buildAssessmentPayload`. `PROV_SECTION_FIELDS.screen` updated to the 12 new fields + `screen_not_assessed`. Legacy `*_score` columns kept in DB but no longer read/written.
7. **B3** — Setup section: 1–10 slider for `current_capacity_vs_pb` with rebuild copy + tooltip. `pickSectionPayload('training')` includes it. `BriefEditor` "Schedule & emphasis" card renders an inline pill ("Capacidade actual: 4/10 — modo reconstrução"). Schema already allows it.
8. **B4** — rewrite `MovementCompetencyRadar` to read form scores (`count(checked)/5`) and capacity scores via `src/lib/capacity-thresholds.ts`. Render a solid orange polygon (form) + dashed grey polygon (capacity). Patterns flagged `not_assessed` (or with no data on either layer) render a dashed grey radial line and no dot. Caption: `Forma vs Capacidade · {N}/6 padrões avaliados`. Skip the dashed polygon entirely if no capacity points exist.

**STOP after B4.** Do not start the reduced Item 7 (HowToAssess for non-screen sections) yet.

---

## Stop-point acceptance (must all pass before reporting back)

(a) `ClientSnapshotCard` gone; inline arrow link in header scrolls to synthesis.
(b) Page renders fully in pt-PT after re-analysis runs — no English bleeds in section analyses, brief, or stage card buttons.
(c) Stage card buttons render `Regenerar` / `Aprovar` / `A gerar…`.
(d) Movement Screen renders 6 `MovementPatternCard`s with checkbox criteria; no 1–5 sliders remain.
(e) Capacity inputs render below criteria for each pattern.
(f) `current_capacity_vs_pb` slider visible in Setup; pill visible in brief.
(g) Radar shows form (solid) + capacity (dashed) layers with dashed-only axes for unassessed patterns.
(h) Zero horizontal scroll at 375px and 414px on `/clients/$clientId`.
(i) < 768px shows hamburger nav with full sheet menu; ≥ 768px shows full nav with no clipping.
(j) BP inputs render in Risk Stratification with category pill; crisis banner blocks "Gerar rascunho do plano".

Report back with 5 screenshots: 375 / 414 / 768 / 1024 / 1280 px.

---

## Technical notes

- `Sheet` and `DropdownMenu` are already in `src/components/ui/`; no new shadcn primitives needed.
- `LanguageSwitcher` will be refactored to accept a `variant?: 'pills' | 'menu-item'` prop so the sheet and the desktop dropdown can both reuse it without duplicating logic.
- Locale mapping for A2: `i18n.language === 'pt' || startsWith('pt')` → `'pt-PT'`; else `'en-GB'`. Stored verbatim in `section_analyses_locale[sectionId]`.
- A5 trigger update is additive — re-run via a new migration that wraps `validate_assessment_ranges` with the BP + capacity-vs-PB ranges. All `add column` statements remain idempotent.
- `MovementCompetencyRadar` rewrite is local to `clients_.$clientId.tsx`; no new component file needed.
- After A0a, retain `overflow-x-hidden` only on the route's root wrapper, not globally — keeps modals/sheets able to escape if ever needed.
