## R68 — Trim `/clients/$id` header (P0, mobile)

**Problem.** At 760px (and worse at 375px) the top of `/clients/$id` is a 3-row pile: avatar+name row, AssessmentDatePicker + "Mais ações" + Documents row, and the "Readiness strip" with ACSM + Recovery chips. The chips also conceptually live inside `ClientCockpit`/ProtocolRail, so we read the same risk twice within 200px of scroll. Empty states ("Baixo / —") still render too often.

Backlog item #79/#85, P0. Untouched for 3 rounds.

**Goal.** One compact header band, ≤2 visual rows on mobile, zero duplicated chips, single primary affordance (the hero CTA already below stays the only blue button).

### Changes — `src/routes/clients_.$clientId.tsx` (lines ~1442-1633)

1. **Collapse header into a single row + thin chip strip.**
   - Row 1: `<ClientAvatarUpload>` + name + `ClientPhaseHeaderPill` + email (truncated). On <640px, email moves to its own line under name; phase pill stays inline.
   - Inline trailing icon-only `DropdownMenu` (`MoreHorizontal`, `aria-label="Mais ações"`, no text), aligned right via `ml-auto`. Move *every* secondary control into it: AssessmentDatePicker, "Download PDF", "Ver como cliente", "Pedir nova avaliação", and `<ClientDocuments>` trigger. The picker becomes a labelled item that opens a popover from inside the menu (reuse existing `<AssessmentDatePicker>` inside a `DropdownMenuSub` or render it as a `DropdownMenuItem` with `onSelect={(e)=>e.preventDefault()}`).
   - Remove the standalone "Mais ações" text button and the loose `<ClientDocuments>` chip from the header.

2. **Drop the header "Readiness strip" entirely.**
   - Delete the IIFE at lines ~1565-1633 that renders ACSM + Recovery chips. These already surface inside `ClientCockpit` (via `ProtocolRail` + signals row) and the assessment section header. One source of truth — the cockpit.
   - Keep the `briefCoverage` fetch (used elsewhere via `setBriefCoverage`); only remove the rendered strip.

3. **Mobile breathing room.**
   - Header container: `gap-3` (was `gap-4`), `py-1` instead of default; name `text-xl sm:text-2xl md:text-3xl` (was `text-2xl sm:text-3xl`).
   - Avatar `size={48}` on <640px via prop conditional, keep 56 on ≥sm.

4. **Verify nothing depends on the deleted strip.**
   - `riskCategory`, `parqYes`, `lastSavedAt`, `briefCoverage` are all consumed elsewhere — only their rendering in this block goes away.

### Out of scope
- No changes to `ClientCockpit`, `ProtocolRail`, ThisWeekHero, or stages lane.
- No i18n key removals (chips already translated; we just stop rendering them here).
- No DB / server-fn touches.

### Validation
- Manual smoke at 375 / 760 / 1280 px: header fits in ≤2 rows on mobile, single overflow icon, chips appear only once on the page (in `ClientCockpit` block below).
- Click each item in the new dropdown: Documents popover, PDF download, AssessmentDatePicker, "Ver como cliente", "Pedir nova avaliação" all still work.
- Backlog: mark #79/#85 ✅.

### Files touched
- `src/routes/clients_.$clientId.tsx` (header block ~1442-1633)
- `.lovable/backlog.md` (mark item ✅, log R68)
