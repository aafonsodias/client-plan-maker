# R28 — My Schedule (timetable + revenue)

## Conflicts to flag before we touch code

1. **"Individual user mode" doesn't exist in Forge today.** The entire app is trainer-centric: every table is keyed by `trainer_id`, RLS is `auth.uid() = trainer_id`, `clients` are *owned* by a trainer, and there is no client-side login. Adding a true second role is a multi-week architectural shift (auth, RLS rewrite, route gating, billing). **Recommendation:** ship trainer mode first; defer individual mode to a separate round and, when we get there, model it as "trainer-of-self" (the user is their own client) rather than a new role — that reuses everything.
2. **Sessions ≠ bookings.** `workout_sessions` already exists but stores *logged* training (entries, RPE, feedback). Bookings (future, time-of-day, duration, billable) are a new concept. We need a new `client_bookings` table, not an overload of `workout_sessions`.
3. **Pricing per client is new.** `clients` has no `price_per_session` or pack fields. Forge's billing today is the trainer's *own* SaaS subscription (`subscribers`), not client-pack revenue. Need new columns / a `client_packs` table.
4. **YearView already exists** (`src/components/YearView.tsx`) as a calendar surface — we'll reuse its visual language (cells, status tones via `lib/status-tone.ts`) so the timetable feels native.
5. **Nav slot is tight.** Header already shows Dashboard / Clients / Templates / Settings. Adding "Schedule" makes 5 — fits desktop, but on mobile the hamburger absorbs it cleanly. No design issue.

## Scope of R28 (Phase 1 — trainer only, real data layer)

### 1. Schema (one migration, with backups per non-negotiables)

```text
client_packs
  id uuid pk
  trainer_id uuid not null
  client_id uuid not null
  label text                           -- "Pack 10 · Presencial"
  session_type text                    -- 'in_person' | 'online'
  price_per_session_eur numeric(10,2)
  pack_size int                        -- e.g. 10
  sessions_used int default 0          -- maintained by trigger
  weekly_frequency int                 -- e.g. 2
  start_date date
  status text                          -- derived view: active|ending_soon|expired
  color text                           -- hex, stable per pack for grid blocks
  created_at, updated_at

client_bookings
  id uuid pk
  trainer_id uuid not null
  client_id uuid not null
  pack_id uuid null references client_packs(id)
  starts_at timestamptz not null
  duration_min int default 60
  session_type text                    -- 'in_person' | 'online'
  status text                          -- 'scheduled' | 'done' | 'cancelled' | 'no_show'
  notes text
  created_at, updated_at
```

- RLS: `auth.uid() = trainer_id` on both (mirrors every other table).
- Trigger `bump_pack_sessions_used` increments `client_packs.sessions_used` when a booking flips to `done`, decrements on cancel-after-done.
- No CHECK constraints with `now()` — use a validation trigger (per non-negotiables in `mem://principles/non-negotiables.md`).
- Backup: `backup_clients_<YYYYMMDD>` before migration since we're not touching `clients`, but we will snapshot `workout_sessions` for safety reference.

### 2. Server functions — `src/server/schedule.functions.ts`

- `listWeekBookings({ weekStart })` → bookings + joined pack/client lite info for that ISO week.
- `createBooking(...)`, `updateBooking(...)`, `cancelBooking(id)`, `markBookingDone(id)`.
- `listPacks({ activeOnly? })`, `createPack(...)`, `updatePack(...)`.
- `weekRevenueSummary({ weekStart })` → `{ expectedIncomeEur, sessionsCount, totalSessionsRemaining, packsEndingSoon }`.

All amounts stored & returned in **EUR** (per Core memory rule). Display via `<PriceTag>` so USD/BTC toggling keeps working.

### 3. Routes & UI

- `src/routes/schedule.tsx` — main page (week grid + revenue strip).
- `src/routes/schedule.packs.tsx` — manage packs (table + create/edit dialog). Sub-route under same layout.
- New components in `src/components/schedule/`:
  - `WeekTimetable.tsx` — 7×timeslots grid, 6:00–22:00 in 30-min rows, color blocks per booking.
  - `DayStrip.tsx` — mobile day-picker (<768px via `useIsMobile`).
  - `RevenuePanel.tsx` — top summary card (expected income, sessions confirmed, remaining, ending-soon alert).
  - `BookingDialog.tsx` — create/edit booking; client + pack picker, datepicker (shadcn pattern with `pointer-events-auto`), duration, type, notes.
  - `PackCard.tsx` / `PackFormDialog.tsx`.
- Status tones via existing `toneChip/toneDot` (`success|warn|danger`) — green=active, amber=ending soon (≤2 left), red=expired. Matches the project-wide rule.
- Both light/dark themes covered automatically because all colors come from semantic tokens; only the per-pack `color` is a hex (used at low alpha for the block fill).

### 4. Navigation

Add `{ to: "/schedule", label: t("nav.schedule"), icon: CalendarDays }` to `primaryNav` in `AppShell.tsx`. i18n keys in `common.json` (PT + EN).

### 5. i18n

New namespace `schedule` (PT + EN), all strings via `t()` — non-negotiable.

### 6. Phase 1 cut-list (explicitly NOT in this round)

- Individual user mode (deferred — needs auth/role discussion).
- Recurring booking rules (e.g. "every Tue+Thu 7am for 10 weeks") — manual booking only in v1, with a "duplicate to next week" shortcut.
- Calendar sync (Google/Apple) — out of scope.
- Payment collection / invoicing — pure tracking, no Stripe link to client packs.
- Notifications/reminders — out of scope.

## Tech notes

- ISO week math via `date-fns` (already used elsewhere in the project — `EvolutionSparkline`, `LogbookTimeline`).
- Mobile breakpoint: 768px (`useIsMobile`). 375px Mobile Safari smoke test mandatory before closing the round.
- Every server function writes to `generation_log`? No — `generation_log` is for AI calls only. Schedule mutations don't use AI, so they don't log there. (Flag if you want a separate audit.)
- Color picker for packs: pick from a fixed 8-color palette derived from existing tone tokens, not free hex — keeps both themes legible.

## Round flow

1. Migration (with backup).
2. Server functions + types regen.
3. UI (grid → revenue panel → dialogs → packs page).
4. i18n PT+EN.
5. Seed: a small "demo pack + 5 bookings this week" helper inside Demo Lab so the empty state has visible content.
6. 375px smoke + light/dark visual QA.
7. Close round, update `.lovable/backlog.md`.

## Decision asked

Confirm two things before I switch to build mode:

- **A — Defer individual mode to a later round?** (Strongly recommended. Otherwise scope doubles and we touch auth.)
- **B — Use new `client_bookings` table (not overload `workout_sessions`)?** (Strongly recommended.)

If yes to both, I'll execute exactly the plan above.

**PROMPT FOR LOVABLE:**

---

Confirmed on both decisions:

**A — Yes, defer individual user mode.** Ship trainer mode first. When we revisit individual mode, model it as "trainer-of-self" so we reuse the existing schema, RLS, and UI rather than introducing a second role. Please add this to `.lovable/backlog.md` as a future round so we don't lose it.

**B — Yes, new** `client_bookings` **table.** Do not overload `workout_sessions`. Bookings and logged training are different concepts and should stay separate.

Proceed with R28 Phase 1 exactly as you scoped it:

- Migration with backups (per non-negotiables), validation triggers instead of CHECK with `now()`
- `client_packs` and `client_bookings` tables with RLS on `trainer_id`
- `bump_pack_sessions_used` trigger on booking status transitions
- Server functions in `src/server/schedule.functions.ts` — all amounts in EUR, displayed via `<PriceTag>`
- Routes: `src/routes/schedule.tsx` and `src/routes/schedule.packs.tsx`
- Components in `src/components/schedule/`: `WeekTimetable`, `DayStrip`, `RevenuePanel`, `BookingDialog`, `PackCard`, `PackFormDialog`
- Reuse `YearView` visual language and `lib/status-tone.ts` for green/amber/red status
- 8-color fixed palette for packs (derived from tone tokens, legible in both themes) — no free hex
- Add `{ to: "/schedule", label: t("nav.schedule"), icon: CalendarDays }` to `primaryNav` in `AppShell.tsx`
- New `schedule` i18n namespace, PT + EN, every string via `t()`
- Demo Lab seed: one demo pack + 5 bookings in the current week so the empty state has content

Out of scope for this round (confirmed): individual mode, recurring booking rules, Google/Apple calendar sync, payments/invoicing, notifications.

One small addition: please include a **"duplicate to next week"** shortcut on each booking block as you mentioned — that's a high-value shortcut for the trainer's real workflow (most clients train on the same days every week) and removes the friction of manual rebooking until recurring rules ship later.

Round flow as you proposed: migration → server functions + types → UI (grid → revenue panel → dialogs → packs page) → i18n → demo seed → 375px Mobile Safari smoke + light/dark QA → close round → update backlog.

Go ahead and switch to build mode.