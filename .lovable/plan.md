Approved. Execute R68.2 exactly within this constrained bugfix scope.

This is a bugfix/stabilization round, not a product expansion round.

Do not start any new feature work.

======================================================================

R68.2 — FINAL APPROVED EXECUTION SCOPE

======================================================================

Proceed with the proposed plan, with the following constraints and clarifications.

Primary goal:

Make Schedule/Packs reliable and usable before any new product work.

This round is accepted only if it fixes:

1. the remaining hook crash

2. invisible out-of-hours bookings

3. frequency guard using the wrong week

4. booking save/refetch reliability

5. mid-pack representation only if already safely supported

6. minor clarity fixes only after P0-P4 pass

======================================================================

STRICT SCOPE GUARD

======================================================================

Allowed:

- bugfixes

- small UI clarity fixes

- i18n strings required by the bugfixes

- existing-field support for `sessions_used` if safe

- existing function payload extension only if minimal and safe

Forbidden:

- schema changes

- migrations

- new server functions

- recurrence

- payments

- direct debit

- monthly/yearly views

- new routes

- new dependencies

- PDF changes

- engine changes

- generation changes

- PKL changes

- AI scheduling

- drag/drop

- right-click menus

- exercise library

- videos

- education ebook

- batch session creation

- add-client-in-dialog

If any item requires schema or a new server function:

STOP and report.

Do not hack around missing schema with notes, labels, fake bookings, hidden assumptions, or misleading counters.

======================================================================

P0 — HOOK CRASH FIX

======================================================================

Proceed with removing the unstable route-level early-return branch in `ScheduleShell` that renders `<Outlet />` for `/schedule/*`.

Reason:

`/schedule/packs` already redirects in `src/routes/schedule.packs.tsx`, so the parent route does not need to conditionally swap between child outlet mode and tab mode.

The same `ScheduleShell` must not render different hook/tree paths depending on redirect/tab state.

Required:

- keep `ScheduleShell` as one stable tab shell on every render

- all hooks at top level

- no hooks after early returns

- no hooks inside conditional branches

- no hooks only called for one tab

- no hooks only called when data/search params exist

- nested components/hooks audited:

  - `ScheduleTabs`

  - `ScheduleWeek`

  - `DayStrip`

  - `BookingDialog`

  - `PacksPanel`

  - `PackFormDialog`

Also fix the hard-refresh hydration mismatch only if minimal:

- server rendered “Loading…”

- client immediately rendered “A carregar…” after persisted locale applied

Make AppShell auth-loading fallback locale-stable if that is directly contributing to hard-refresh instability.

Do not broadly refactor AppShell or i18n.

Acceptance:

- hard refresh `/schedule`

- hard refresh `/schedule?tab=packs`

- hard refresh `/schedule?tab=week`

- switch tabs repeatedly

- no hook mismatch warning

- no runtime crash

======================================================================

P1 — OUT-OF-HOURS BOOKINGS

======================================================================

Proceed with keeping the existing 06:00-22:00 grid.

Compute bookings outside visible hours in `ScheduleWeek`.

Render an out-of-hours section:

- below the desktop grid

- above or near the mobile list

PT:

“Sessões fora do horário visível”

EN:

“Sessions outside visible hours”

Each row must show:

- client name

- time

- type

- duration

- clickable/editable booking

Example PT:

“Elsa Tavares · 02:00 · Presencial · 60′”

Example EN:

“Elsa Tavares · 02:00 · In person · 60′”

Acceptance:

- a 02:00 booking is visible

- it can be opened/edited

- no booking is hidden just because it is outside the grid range

Do not build a 24h calendar redesign.

======================================================================

P2 — FREQUENCY GUARD WEEK CONTEXT

======================================================================

Proceed with replacing the current `usedThisWeek` logic in `BookingDialog`.

The guard must count the week of the candidate booking date, not the displayed/current week.

Required:

- use candidate booking date/time

- compute ISO week start/end from that candidate date

- count non-cancelled bookings

- same client

- same selected pack

- inside candidate week

- exclude the edited booking ID

- client-side only

- no new server function

Copy:

PT:

“Esta cliente já tem {{used}}/{{agreed}} sessões marcadas nesta semana.”

EN:

“This client already has {{used}}/{{agreed}} sessions scheduled for this week.”

Acceptance:

- current week counts current week

- future week counts future week

- cancelled bookings excluded

- editing existing booking does not count itself as extra

======================================================================

P3 — MID-PACK SUPPORT

======================================================================

Proceed only if safe with existing schema and existing function.

Known fields:

- `client_packs.pack_size` exists

- `client_packs.sessions_used` exists

- no separate `sessions_remaining`

- remaining is derived as `pack_size - sessions_used`

- bookings do not currently auto-drive `sessions_used`

Allowed controlled exception:

You may expose `sessions_used` in `PackFormDialog` and pass it through the existing `upsertPack` function only if:

- `sessions_used` already exists in `client_packs`

- `upsertPack` already owns pack create/update

- change is limited to extending existing input/payload

- no migration

- no new server function

- no new accounting model

- no automatic booking-to-sessions_used sync in this round

Fields:

PT:

- “Total de sessões”

- “Sessões já usadas”

- “Sessões restantes”

EN:

- “Total sessions”

- “Sessions already used”

- “Sessions remaining”

Validation:

- `sessions_used >= 0`

- `sessions_used <= pack_size`

- remaining = `pack_size - sessions_used`

- do not allow negative remaining

- do not allow used > total

Copy must be precise.

If displaying used:

PT:

“{{used}}/{{total}} sessões usadas”

EN:

“{{used}}/{{total}} sessions used”

If displaying remaining:

PT:

“{{remaining}}/{{total}} sessões restantes”

EN:

“{{remaining}}/{{total}} sessions remaining”

Do not mix used and remaining in the same label.

Acceptance:

- PT can represent an existing client who is mid-pack

- example: pack_size=10, sessions_used=4 → 6 remaining

- pack card must not falsely show 10/10 remaining

- no fake bookings

- no notes hacks

- no schema changes

- no new server function

If this becomes more than a small safe extension:

defer and report the minimal future requirement.

======================================================================

P4 — BOOKING SAVE / REFRESH RELIABILITY

======================================================================

Proceed with the proposed refresh order after booking save/update/delete/duplicate:

1. bookings for the displayed week

2. packs

3. parent `bookingTick`

If a newly saved booking belongs to a different week than the currently displayed one:

move the schedule’s `monday` state to that booking’s week before/while refreshing so the user sees it immediately.

Keep:

- Packs scheduled-count refetch tied to `bookingTick`

- pack list changes as dependency

- search-param prefill cleanup before opening dialog

- no stale re-triggering

Acceptance:

- Pack → Marcar sessão → Save → Semana shows booking immediately

- future-week booking moves view to that week or is immediately visible

- revenue updates

- scheduled count updates

- Pack scheduled count updates when returning to Pacotes

- no hard refresh required

======================================================================

P5 — SMALL CLARITY FIXES ONLY AFTER P0-P4

======================================================================

Only after P0-P4 are fixed and verified.

Dialog titles:

PT:

- “Nova sessão”

- “Editar sessão”

- “Novo pacote”

- “Gerir pacote”

EN:

- “New session”

- “Edit session”

- “New pack”

- “Manage pack”

Pack color picker:

- on create, choose first unused active pack/client color when palette supports it

- keep manual picker visible

- do not repeat colors unless palette is exhausted

If no safe color field exists:

defer.

Do not implement:

- batch creation

- recurring slots

- copy/paste patterns

- add-client-in-dialog

- monthly/yearly views

- exercise intelligence

- media/videos

======================================================================

I18N

======================================================================

Add only required keys for this bugfix round.

PT-PT and EN required.

ES/HI may mirror EN if that is current project convention.

Required likely keys:

- out-of-hours heading

- frequency guard copy

- mid-pack fields, if shipped

- used/remaining labels

- dialog titles

- selected-day/out-of-hours details if touched

No hardcoded user-facing strings.

======================================================================

VERIFICATION

======================================================================

Use browser at 390px/375px where possible.

Must verify:

- hard refresh `/schedule`

- hard refresh `/schedule?tab=packs`

- hard refresh `/schedule?tab=week`

- hard refresh `/schedule?tab=week&newBooking=1&clientId=X&packId=Y`

- switch tabs repeatedly

- create/edit a 02:00 booking and confirm visible/editable

- current-week frequency guard

- future-week frequency guard

- Pack → Marcar sessão → Save → Semana updates immediately

- revenue updates without hard refresh

- scheduled counts update without hard refresh

- no hook mismatch warning

- no runtime crash

Run the allowed project test/typecheck path through the harness expectations.

Do not add unnecessary build/test commands outside the project’s existing workflow.

======================================================================

FINAL ACCEPTANCE

======================================================================

R68.2 is accepted only if:

1. `/schedule` hard refresh no longer crashes.

2. `/schedule?tab=packs` hard refresh no longer crashes.

3. `/schedule?tab=week` hard refresh no longer crashes.

4. `/schedule?tab=week&newBooking=1&clientId=...&packId=...` hard refresh no longer crashes.

5. No hook mismatch warning remains.

6. 02:00 booking is visible and editable.

7. Frequency guard counts the week of the booking date.

8. Future-week booking is visible immediately after save.

9. Pack → Marcar sessão → Save → Semana shows booking immediately.

10. Pack scheduled count updates without hard refresh.

11. Mid-pack entry is safely supported or explicitly deferred.

12. No hidden revenue assumptions.

13. Dialog titles are clear if touched.

14. `tsc --noEmit` clean, if this is the project’s accepted typecheck.

15. No forbidden scope added.

======================================================================

FINAL REPORT REQUIRED

======================================================================

Report:

- exact hook crash cause

- why R68.1 was insufficient

- files changed

- out-of-hours booking solution

- frequency guard fix

- booking refetch result

- search-param cleanup behaviour

- mid-pack audit/result

- whether `sessions_used` shipped or was deferred

- if `sessions_used` shipped, confirm no migration and no new server function

- clarity fixes shipped

- deferred items

- 375px/390px smoke result

- confirmation:

  - no schema changes

  - no new server functions

  - no recurrence

  - no payments

  - no new routes

  - no engine/generation/PKL changes

  - no new dependencies