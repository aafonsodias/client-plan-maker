
## Verdict

**Type:** UI-only (presentation + i18n + tiny derived counts already available client-side).
**Round size:** 1 round, max 3 changes.

**Ship next (R68):**
1. PT-PT i18n cleanup on Schedule tabs + Packs labels (Week→Semana, Packs→Pacotes, Edit→Gerir, Novo pack→Novo pacote, etc.).
2. Week tab empty-state that *teaches the model* (Cliente → Pacote → Frequência → Marcar) and has one obvious primary CTA = "Nova sessão" prefilled to next coachable hour.
3. Pack card rebuild: operational hierarchy (cliente, tipo, sessões restantes, €/sessão, frequência semanal, **agendadas esta semana** derived from existing `client_bookings`, status). Primary action `Marcar sessão` (opens BookingDialog prefilled with client+pack), secondary `Gerir pacote`. Destructive archive moves into a kebab menu.

**Do NOT ship now:** sticky selected-client mode on Week, drag-to-schedule, recurring slots, monthly/annual views, billing, phone field, server changes, schema changes, new routes, AI scheduling, holidays.

**Why:** The user can already create a session and the data exists. The gap is *legibility of the operating model* on a 390px screen, not new capability. Every deferred item costs schema or server work and would burn the 140-credit budget without moving the "abandon Excel" needle.

---

## Copy-paste Lovable prompt (R68)

```
Protocol Forge — Round 68
MVP Schedule & Packs operational clarity (UI-only)

CONTEXT
R67 shipped: Today strip on dashboard, weekly-frequency guard in BookingDialog (uses client_packs.weekly_frequency), revenue caption. The Schedule page (/schedule) has two tabs: Week and Packs. On 390px the page does not communicate the operating model:
  Cliente → Pacote ativo → Frequência semanal → Sessões marcadas → Sessões restantes → Receita esperada
Tabs and pack labels still mix EN/PT. Pack cards read like database rows. The empty Week state does not show the user where to tap or how scheduling works.

SCOPE — max 3 changes, UI/i18n only, mobile-first 390px

CHANGE 1 — i18n cleanup (PT-PT + EN parity)
Files: src/i18n/locales/pt/schedule.json, src/i18n/locales/en/schedule.json, src/i18n/locales/pt/common.json, src/i18n/locales/en/common.json, src/routes/schedule.tsx, src/routes/schedule.packs.tsx
- Tabs: "Week" → "Semana" / "Week"; "Packs" → "Pacotes" / "Packs".
- Pack actions: "Edit" → "Gerir" / "Manage"; "Novo pack" → "Novo pacote" / "New pack"; "Pack 10" default label → "Pacote 10".
- Pack price caption: "30€" → "€30 / sessão" / "€30 / session" via PriceTag suffix or sibling span.
- Audit every visible string in PacksPanel + schedule tab triggers; nothing hardcoded in EN. All via t().

CHANGE 2 — Week tab empty-state that teaches the model
Files: src/routes/schedule.tsx (only the empty-state branch of the week grid), src/i18n/locales/{pt,en}/schedule.json
- Replace the current "Sem sessões marcadas. Toca num espaço para marcar." block with a single centered card containing:
  • One-line headline: "Sem sessões marcadas esta semana."
  • Three-step inline mini-flow (icons + words, NOT a wizard): "1. Cliente  2. Pacote  3. Hora" — purely visual, no state.
  • Primary button "Nova sessão" — opens existing BookingDialog with date = next weekday at 09:00 (or current hour rounded up if today is a weekday and < 19:00). Use existing dialog; do NOT add new server logic.
  • Secondary text-link "Ver pacotes ativos" → switches to packs tab (existing tab state).
- Hourly grid lines: keep current grid behaviour for non-empty weeks. Do NOT redesign the grid.

CHANGE 3 — Pack card rebuild + safer destructive action
Files: src/routes/schedule.packs.tsx (PacksPanel list item), src/i18n/locales/{pt,en}/schedule.json
- Rebuild each <li> as a 2-row mobile card:
  Row 1: ClientAvatar · client name (full, do NOT truncate at 4 chars — allow 1 line, ellipsis only past container width) · status chip right-aligned.
  Row 2: meta line in muted text, comma-separated:
    "{packLabel} · {sessions_used}/{pack_size} sessões · €{price}/sessão · {weekly_frequency}×/sem · {scheduledThisWeek} marcadas"
    where scheduledThisWeek = count of non-cancelled client_bookings for this pack within the current ISO week. Compute client-side from data already loaded; if not loaded in PacksPanel, do ONE supabase select of client_bookings filtered by trainer + week range + pack_id IN (...) at panel mount. No new server function.
  Action row (right-aligned, mobile-stackable):
    Primary: "Marcar sessão" — opens existing BookingDialog from /schedule with prefilled clientId + packId. To do this without a new route: lift BookingDialog open-state to a small context within schedule.tsx OR navigate to /schedule?tab=week&newBooking=1&clientId=...&packId=... and have schedule.tsx read those search params on mount and open BookingDialog prefilled. Pick whichever is fewer LOC.
    Secondary: "Gerir" — opens existing PackFormDialog (current Edit behaviour).
    Overflow kebab (lucide MoreVertical): contains "Arquivar" / "Desarquivar". Remove the bare Archive icon button from the row. Confirm-on-archive via existing toast pattern; no new dialog.
- New pack-status chip key text: keep tone colors. PT: "Ativo" / "A terminar" / "Esgotado". EN unchanged.
- Empty state text: "Sem pacotes ainda. Cria um pacote para acompanhar sessões e receita." (already close — verify keys.)

I18N REQUIREMENTS
- Every new or edited string lives in schedule.json under existing namespaces (pack.*, form.*, week.*). No hardcoded strings.
- PT-PT voice = "você"-neutral / imperative ("Marcar sessão", "Gerir pacote"). Match existing tone.
- ES + HI: copy EN values into es/schedule.json and hi/schedule.json for parity (project rule: ES/HI fall back to EN; do not invent translations).

MOBILE 390px REQUIREMENTS
- Test at 390×638. All cards must fit without horizontal scroll.
- Pack card action row wraps to a second line below 360px; primary button keeps full-width on its own line if needed.
- Week empty-state card max-width 320px, vertically centered in the grid area.
- Tap targets ≥ 40px tall.

ALLOWED
- Reading client_bookings already loaded in /schedule context, OR one extra select scoped to current ISO week + pack ids.
- Search-param-driven prefill of BookingDialog.
- Lucide icon swaps (MoreVertical, CalendarPlus).

FORBIDDEN
- No schema changes.
- No new server functions, no edits to src/server/schedule.functions.ts.
- No new routes.
- No recurrence, no payments, no billing, no Stripe, no monthly/annual views, no holidays/vacations, no calendar sync, no AI scheduling.
- No drag-and-drop, no right-click menus, no sticky selected-client mode.
- No engine, generation, PKL, or quota changes.
- No PDF, no email, no notifications.
- No new dependencies.
- No client phone field.

IMPLEMENTATION ORDER
1. i18n keys first (both pt + en + es/hi parity). Confirm key names with existing schedule.json structure.
2. PacksPanel card rebuild + kebab. Verify archive still works.
3. Week empty-state card + "Nova sessão" prefilled CTA + search-param prefill plumbing in schedule.tsx.

ACCEPTANCE CRITERIA
- At /schedule on 390px the tabs read "Semana / Pacotes" in PT and "Week / Packs" in EN.
- An empty Week shows the 3-step model + one "Nova sessão" button that opens BookingDialog with a sensible prefilled date/time.
- Each pack card on mobile shows: client name (untruncated to <8 chars), pack label, sessions left, €/session, weekly frequency, sessions already marcadas this week, status chip.
- "Marcar sessão" on a pack card opens BookingDialog with that client + pack preselected; saving creates a normal booking through the existing function.
- Archive lives behind the kebab; no bare destructive icon visible.
- tsc --noEmit clean. No new packages. No schema migration.
- Lighthouse-style smoke at 390px: no horizontal scroll on /schedule, /schedule?tab=packs.

FINAL REPORT MUST INCLUDE
- Files changed (list).
- Confirmation: no schema, no server, no routes, no recurrence, no billing.
- Screenshot or description of /schedule (week empty), /schedule?tab=packs at 390px.
- Any deferred sub-item with one-line reason.

DEFERRED (do NOT ship; log only)
- Sticky selected-client on Week tab.
- Recurring weekly slots.
- Monthly / annual schedule views.
- Direct-debit / Stripe billing on packs.
- Client phone field on manual-create.
- Holidays / vacations.
- Trial-session lifecycle.
Add these (or merge with) mem/features/schedule-revenue-future.md.
```

---

When you approve, I'll execute exactly this scope — nothing more.
