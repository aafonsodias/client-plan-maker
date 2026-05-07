## R67 — Operational dashboard + schedule feasibility (MVP-locked)

### Audit findings (existing data/schema)

- **`clients.phone`** already exists (text, nullable). No migration needed for a phone field. ✅
- **`client_packs.weekly_frequency`** (int, default 2) is the per-pack agreed cadence. Best existing source for "X/X this week" guard. ✅
- **`client_bookings`** has `client_id`, `starts_at`, `pack_id`, `status` — enough to count weekly bookings per client.
- **Slot click → prefilled BookingDialog** is already implemented in `src/routes/schedule.tsx` (lines 287–298, 353–356): `onSlotClick(slot.toISOString())` opens dialog with `initial.startsAt`. Only thing missing is **client preselection** (no "selected client" concept on /schedule today). Adding a sticky client selector is C-cost; defer.
- **Expected revenue** is already computed on `CoachCockpit` and `RevenuePanel` from `pack.price_per_session_eur × non-cancelled bookings this week`. Just needs a one-line caption.
- **Plan/assessment `sessions_per_week` / `training_days_per_week`** exist but are not consistently set across legacy clients; pack `weekly_frequency` is the safer single source.
- **Dashboard signals available without backend work**: `intake_status` (incomplete / submitted-no-plan), `workout_plans.status` (draft/ready/finalized), most recent `workout_plan_days.created_at` (week ready to review), `client_bookings` count this week, `client_packs` ending soon (already surfaced on Cockpit nudges).

### Lane A — Dashboard "Today / Needs attention" strip [SHIP]

**File:** `src/components/dashboard/CoachCockpit.tsx` (extend; replace the existing single "today attention strip" already mentioned in summary with a richer ranked list).

Compute a ranked list (max 5 rows) from data already loaded by `Dashboard` + `CoachCockpit`:

1. **Assessment incomplete** — `intake_status === 'in_progress'` or `'sent'` past 3 days → "{name} · avaliação por completar" → click → `/clients/$id`.
2. **Ready for protocol** — `intake_status === 'submitted'` AND no active plan → "{name} · pronto para protocolo" → `/plans/new?clientId=…`.
3. **Plan awaiting approval** — latest plan `status === 'ready'` → "{name} · plano por aprovar" → `/plans/$id`.
4. **No sessions this week** — global, only when `clients.length > 0` AND `bookings.length === 0` → "0 sessões marcadas esta semana" → `/schedule`.
5. **Pack ending** — already in nudges; reuse signal but show top 1 here.

Rendered as a single compact card above the current week-strip. Empty state: "Nada urgente. Boa semana." Premium tone, dot-indicator color from `status-tone.ts`.

i18n keys (added to `pt/common.json` + `en/common.json` under `today.*`):
- `today.title` "Hoje" / "Today"
- `today.empty` "Nada urgente. Boa semana." / "Nothing urgent. Good week."
- `today.assessment_incomplete` "{{name}} · avaliação por completar"
- `today.ready_for_protocol` "{{name}} · pronto para protocolo"
- `today.plan_awaiting` "{{name}} · plano por aprovar"
- `today.no_sessions_week` "0 sessões marcadas esta semana"
- `today.pack_ending` "{{name}} · pack a terminar"

### Lane B — Schedule & revenue feasibility result

| Slice | Cost | Decision |
|---|---|---|
| Calendar slot prefill (date+time) | already shipped | nothing to do |
| **Weekly frequency guard** in `BookingDialog` | A — ~40 LOC, uses `pack.weekly_frequency` + count of week's bookings already in props | **SHIP** |
| **Revenue caption** under expected income on Cockpit + `RevenuePanel` | A — ~10 LOC, i18n only | **SHIP** |
| Phone field on manual-create dialog | A — schema supports it, but `createManualClient` server fn signature would need a tweak; minor scope creep | **SHIP** if `createManualClient` already accepts phone, otherwise defer with one-line note |
| Sticky "selected client" before slot click → full prefill including client | B/C — needs new UI state on `/schedule` | **DEFER** |
| Recurring sessions / monthly+yearly views / direct debit / Stripe | C | **DEFER** (note in `mem://features/schedule-revenue-future.md`) |

**Weekly frequency guard implementation** (`BookingDialog` in `src/routes/schedule.tsx`):
- When `clientId` is set and `packId` is set, compute `agreed = pack.weekly_frequency` and `usedThisWeek` from existing `bookings` in scope (need to pass week bookings as prop, ~10 LOC plumbing).
- If `usedThisWeek >= agreed` and not editing same booking → render amber inline notice + checkbox "Marcar sessão extra" required to enable Save.

**Revenue caption**: add muted `<p>` under PriceTag in `CoachCockpit` hero and `RevenuePanel`: "Receita esperada · baseada nas sessões marcadas desta semana".

### Files to touch
- `src/components/dashboard/CoachCockpit.tsx` — rewrite "today" strip into ranked list + revenue caption
- `src/routes/schedule.tsx` — pass week bookings into BookingDialog; add frequency guard
- `src/components/schedule/RevenuePanel.tsx` — caption line
- `src/i18n/locales/pt/common.json` + `en/common.json` — `today.*` + `schedule.frequency_warn` + `schedule.extra_session` + `schedule.revenue_caption`
- `mem://features/schedule-revenue-future.md` — note deferred scope (recurring/monthly/yearly/billing)

### Out of scope (explicit)
No engine, generation, PKL, schema, payment, recurrence, new routes, AI scheduling. No `createManualClient` signature change unless it already accepts phone.

### Acceptance
- Dashboard "Today" card renders with real ranked signals or premium empty state
- Frequency guard blocks accidental over-booking but allows override
- Revenue line explains its source
- 375px clean, PT+EN complete, legacy clients (no pack) do not break the guard

### Estimated cost
~180 LOC across 4 files + i18n. Within budget.
