
# Round 41 — Client page: "god's-work" recomposition

## Intent

Turn `/clients/$id` from "five identical amber bars + a buried plan card" into a composed three-band layout where the eye lands exactly where the trainer needs to act. Same data, same verbs — radically clearer hierarchy.

## Final composition

```text
┌──────────────────────────────────────────────────────────────┐
│ BAND 1 — IDENTITY                                            │
│  [avatar•dot]  André Periquito Afonso Dias  [ACTIVE · BLK 1] │
│               aafonsodias@gmail.com                          │
│                                                              │
│  [Adesão 78%] [Avaliação 86% · 05/04] [Recovery 63] [ACSM ▾] │
│                                                              │
│  [ Avaliação ]  [Ver como cliente]      ⋯ (PDF, Docs, Date)  │
├──────────────────────────────────────────────────────────────┤
│ BAND 2 — THIS WEEK  (focal point, amber-glow card)           │
│                                                              │
│  Bloco 1 · Semana 2 de 12               [W2 · +load ▾]       │
│  ●─●─◉─○─○─○─○─○─○─○─○─○                                     │
│   W1  W2  W3 …                                               │
│                                                              │
│  4 sessões esta semana · próxima: Push A (qua)               │
│                                                              │
│  [ Descarregar Semana 2 ]   [ Abrir plano ]                  │
├──────────────────────────────────────────────────────────────┤
│ BAND 3 — PIPELINE (collapsed)                                │
│  ✓✓✓✓✓  Pipeline · Bloco 1 completo · 4 Mai      [expandir ▸]│
│                                                              │
│ BAND 3b — HISTÓRICO                                          │
│  Sessões registadas · Planos anteriores · Documentos         │
└──────────────────────────────────────────────────────────────┘
```

## Changes

### 1. Identity band
- Add a small **amber Sparkles dot** to the bottom-right of `<ClientAvatarUpload/>` when `clients.email === founder email` (reuses existing founder check). Same vibe as a verified tick.
- Subtle radial amber glow (4% opacity) behind name+avatar block to anchor identity.
- **Unified KPI strip** using `toneChip` from `src/lib/status-tone.ts`. Four chips, same height, same radius:
  - `Adesão {n}%` — emerald ≥80, amber 60–79, red <60
  - `Avaliação {pct}% · {DD/MM}` — folds in last-assessed date (kills standalone link)
  - `Recovery {n}` — emerald/amber/red
  - `ACSM {tier}` — emerald/amber/red
- Drop the standalone "Última avaliação · 05/04/2026 →" line and the loose ACSM/Recovery duo.

### 2. Toolbar — two tiers
- Primary (filled amber, prominent): `Avaliação`
- Secondary (outline): `Ver como cliente`
- Overflow `⋯` menu (Popover): `Download PDF`, `Docs`, `Pick assessed date`
- One bright button = unambiguous next action.

### 3. Hero "This week" card (NEW — replaces flat "Plano final" row)
New component `src/components/ThisWeekHero.tsx`:
- Header: `Bloco N · Semana W de TOTAL` + week selector dropdown (defaults to latest approved week, same logic as today).
- **Macro index strip** — same SVG logic as the PDF cover (`base / +load / +reps / deload` tags). Reusing the visual vocabulary between paper and screen is the magic — it tells the trainer "what you print is what you see".
- Sub-line: `{n} sessões esta semana · próxima: {dayName} ({weekday})` (best-effort; if no schedule data, omit).
- Two CTAs: amber filled `Descarregar Semana W` + outline `Abrir plano`.
- Subtle amber inner-glow border (`shadow-[inset_0_0_24px_rgba(245,158,11,0.06)]`).
- If client has zero plans: render a calm onboarding card with `Gerar próximo bloco (IA)` + `New plan (manual)` instead.

### 4. Pipeline band — single strip (collapsed by default)
Replace the 5 stacked StageCards with one `<PipelineStrip/>` row:
- Five emerald dots `●●●●●` + label `Pipeline · Bloco 1 completo · {date}` + chevron.
- Click → expands the existing 5 stage cards inline (accordion, no nav). Edits stay 1 click away.
- If any stage is incomplete, expand by default and show pending stage in amber.

### 5. Histórico band
- Existing "Sessões registadas" table moves under a `Histórico` heading.
- Empty state copy rewritten: "Quando o André começar a registar, este painel mostra adesão, RPE e progressão por padrão." + soft secondary action `Enviar link da app` (uses existing IntakeLinkPanel logic if available, else hidden).

### 6. Spacing rhythm
Apply `space-y-12` between bands, `space-y-6` inside a band, `gap-3` inside a chip row. Today everything is ~20px → reads flat. New rhythm reads composed.

## Technical details

### Files
- `src/routes/clients_.$clientId.tsx` — recompose render tree; no data-fetching changes.
- `src/components/ThisWeekHero.tsx` — NEW, ~150 LOC. Receives `plan, weeks, latestWeek, onDownload, onOpen`.
- `src/components/PipelineStrip.tsx` — NEW, ~80 LOC. Wraps the 5 stage cards in an accordion.
- `src/components/ClientAvatarUpload.tsx` — add optional `showFounderDot?: boolean` prop; render Sparkles in absolute corner.
- `src/components/MacroIndexStrip.tsx` — NEW, extract SVG tag-strip logic from `src/lib/pdf.ts` into a reusable React component (DOM, not canvas). PDF keeps its own canvas version; both share the same `weekTagFor(weekN)` helper which moves to `src/lib/macro-index.ts`.
- `src/i18n/locales/{pt,en}/assessment.json` and `client.json` — new keys: `client.thisWeek.*`, `client.pipeline.*`, `client.kpi.*`, `client.empty.*`. PT uses "você".
- `src/lib/status-tone.ts` — already exists, reuse `toneChip`.
- `.lovable/backlog.md` — close R41.

### Out of scope (explicit)
- No DB changes.
- No PDF changes (cover already has the strip; this round just mirrors it on screen).
- No new server functions.
- WeekMatrix desktop, adaptive repeat assessments, real verified backend pipeline — still parked.

## QA checklist
- 1806×984 desktop (current viewport) — three bands visible without scroll for the common case.
- 375px Mobile Safari — bands stack, KPI chips wrap to 2×2, hero card scrolls naturally.
- Founder dot only on aafonsodias@gmail.com client card (which is André himself in your demo).
- Pipeline strip: clicking expands inline, chevron rotates, edits to brief still work.
- Empty client (no plan): hero shows onboarding variant, no broken week selector.
- All new strings via `t()`.

## Why this is the right shape
- **Looks → function → ease.** Hero card is the most beautiful thing on the page *and* the most-used surface — those align.
- **Consistency between paper and screen.** Reusing the macro index strip from the PDF makes the app feel like one system, not two products.
- **Honest hierarchy.** Five "approved" banners is decoration; one focal "this week" + a discreet pipeline pill is *information*.
- **Reversible.** Pipeline collapse is just an accordion — no data lost, no clicks lost beyond the first expand.
