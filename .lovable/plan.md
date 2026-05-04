## Round 39 — Weekly-only PDF + finish R38 backlog

You're right to walk back the "12-week PDF" direction. PTs print one week at a time and update on weekends. The PDF should be a **single-week clipboard tool with a compact macro/meso index strip** so you always know where this week sits in the block. Less paper, more useful.

### 1. Weekly PDF (the main change)

- Make `generatePlanPdf` accept `{ weekNumber }` and render **only that week** (cover + 1 page per session, landscape A4).
- Add a **compact macro index strip** to the cover:
  - Row of N small chips (one per week of the block), current week highlighted.
  - Each chip shows week number + a 1-word tag (`base`, `+load`, `+reps`, `deload`).
  - Block label: `Bloco N · Semana W de Total` so you orient at a glance.
- Drop the old "all weeks at once" rendering paths and the 12-week cover totals that were lying (DURATION 4 wk, TOTAL SESSIONS 5).
- Cover totals become honest: `DURATION 1 wk · SESSIONS THIS WEEK X`.

### 2. Per-week download UI

- In **Plano final** (`clients_.$clientId.tsx`), replace the single "Descarregar PDF" pill with a small week selector:
  - Default = current week (latest week with `approved_at` on any day, else W1).
  - Dropdown of weeks 1..N with the same `base/+load/+reps/deload` tag.
  - Primary button = "Descarregar Semana W (PDF)".
- `downloadPlanById(planId, weekNumber?)` — pass through to `generatePlanPdf`.
- Keep "open full plan page" only as a quiet secondary link (it's the in-app log; PT works from PDF).

### 3. PDF table polish

- Fix table column clipping observed in your sample PDF (`10-1…`, `Reverse Hyperextension Bodywei…`):
  - Recompute exercise-name column width from page width minus measured stat columns; let it grow now that we only render one session per page.
  - Wrap exercise names to a 2nd line instead of truncating.
- Fix mixed PT/EN headers in PDF (`SETS/REPS/REST/RPE/NOTES`) — drive from i18n `pdf.*` keys, default PT.
- Add a tiny footer per session page: `Forge · {client} · Bloco N · Semana W · gerado {date}`.

### 4. Founder verified badge wiring

- `ClientAvatar` already accepts `verified`. Wire it on:
  - The header avatar in `AppShell` for the founder email (`aafonsodias@gmail.com`).
  - The profile/settings avatar surface.
- No backend change needed — same gate as the existing Founder pill.

### 5. i18n + copy sweep

- Remaining mixed strings: "Gerar Microcycle", "Gerar Progressions", any lingering "Stage:" prefix in the Plano final row.
- Move the new weekly-PDF copy (`pdf.weekly.*`, `detail.plans.download_week`, week tags) to `pt/plan.json` + `en/plan.json`.

### 6. Backlog housekeeping (close out R38)

- Mark R38 items done in `.lovable/backlog.md`.
- Open R39 section listing the items above + carry-overs:
  - WeekMatrix desktop view (was R36 deferred) — defer again, real round of work.
  - Adaptive repeat assessments (rich baseline → small contextual re-checks) — note as parked.

### Files touched

- `src/lib/pdf.ts` — weekly mode, macro index strip, table widths, i18n headers.
- `src/lib/download-plan.ts` — accept `weekNumber`.
- `src/routes/clients_.$clientId.tsx` — week selector in Plano final.
- `src/components/AppShell.tsx` (or wherever the header avatar lives) — pass `verified` for founder.
- `src/i18n/locales/{pt,en}/plan.json` (+ `common.json` for week tags).
- `.lovable/backlog.md`.

### Out of scope

- No DB changes.
- No engine/prompt changes (engine stays frozen this round).
- No new PDF for full-block export — explicitly walked back per your note.

### Expected result

```text
Plano final
  Bloco 2 · Semana 3 de 4   [base] [+load] [+reps●] [deload]
  [ Descarregar Semana 3 (PDF) ▾ ]   open plan page
```

PDF you print on Sunday: 1 cover with the week-strip, then one page per session, names no longer clipped, headers in PT, honest totals.
