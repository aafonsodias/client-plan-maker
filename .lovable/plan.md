## What's left (honest snapshot)

The MVP spine is whole: 5-stage journey, blocks, logbook, volume, PDFs, demo year, regional names, schedule v1, packs, billing, RealInsightsCard. What's missing is **the room you walk into**. Today login lands on a clients list — functional, lonely. Your vision is right: the landing should be a **role-aware cockpit**.

## The vision, sharpened

Three personas, one app, one mental model — **"the dashboard is what you use the app for."**

| Role | Dashboard = | Editable | Tone |
|---|---|---|---|
| **Coach** (PT mode) | This week's calendar + clients pulse + money + relationship reminders | Everything | Operating room |
| **Individual** (trainer-of-self) | Their own protocol (assessment → plan → log) | Everything on self | Personal craft |
| **Trainee** (client of a PT) | Their plan, logbook, progress, PT messages | Log + feedback only | Connected, never lost |
| **Long-distance trainee** | Same as Trainee but self-fills + can request edits | Log + intake fields + feedback | Autonomous |

**Insight:** Individual and Coach are the same surface with the clients-list tab hidden when there are 0 non-self clients. Trainee and Long-distance are the same surface with `read_only_plan` flag flipped. Two surfaces, four roles. No code duplication.

## Round 58 — Coach Cockpit at `/dashboard` (what I'd ship now)

Convert `/dashboard` from "clients list" → "this-week cockpit" with the clients list as one panel among several. **Zero migration, zero AI, reuses every existing query.**

```text
┌─────────────────────────────────────────────────────────┐
│ Esta semana · 12-18 mai · 14 sessões · 1 120 € esperado │  ← hero strip
├──────────────────────────┬──────────────────────────────┤
│ WeeklyCalendarStrip      │ AttentionFeed                │
│ (mon-sun timetable, mini)│ • Maria — aniversário 3ªf    │
│ click → /schedule        │ • João — sem log há 9d       │
│                          │ • Ana — pack acaba esta sem  │
│                          │ • Submissões intake (2)      │
├──────────────────────────┼──────────────────────────────┤
│ ClientsPulse             │ RevenueGlance                │
│ avatar grid · phase dot  │ esta sem · próx 4 sem        │
│ click → /clients/$id     │ packs a renovar              │
└──────────────────────────┴──────────────────────────────┘
        ↓
[ Lista completa de clientes — colapsável, mantém todo o filtro/busca atual ]
```

### Concrete files

**New:**
- `src/components/dashboard/WeekHeroStrip.tsx` — reuses `listWeekBookings()` + `RevenuePanel` math; one-line summary.
- `src/components/dashboard/WeeklyCalendarStrip.tsx` — compact 7-day mini timetable (read-only); cells use the same `ClientAvatar` + `packBlockClasses` from `src/lib/schedule.ts`. Click → `/schedule`.
- `src/components/dashboard/ClientsPulse.tsx` — avatar grid (max 12) with phase dot from `useClientPhases`. Hover = name + days-since-log. Click → client page.
- `src/components/dashboard/RelationshipNudges.tsx` — merges existing `daysUntilBirthday` + new "pack ending in ≤7 days" + "stale ≥7d" into one feed. Each nudge has a **"Compor mensagem"** action that opens a sheet with a pre-filled, editable template (birthday / christmas / re-engagement / new-client schedule). Copy-to-clipboard + WhatsApp deeplink (`https://wa.me/?text=...`). **No AI in this round** — templates are hand-written PT/EN with `{{name}}` `{{age}}` `{{free_slots}}` interpolation. AI rewriting can come in Round 59 if you want.
- `src/lib/dashboard-aggregate.ts` — single hook `useCoachCockpit()` that runs the 4-5 reads in parallel.

**Edited:**
- `src/routes/dashboard.tsx` — top section becomes the cockpit grid; existing clients section moves below a `<details>` "Todos os clientes" (default open if no other content yet, default collapsed if cockpit has data). Keeps all the existing invite/manual dialog code untouched.
- `src/components/AppShell.tsx` — header: rename "Dashboard" → "Hoje" in PT / "Today" in EN.

### Role plumbing (just enough, no over-engineering)

Add a tiny derived helper `useUserMode()` returning `'coach' | 'individual' | 'trainee'`:
- `coach` if `clients.count > 0` AND any client where `is_self=false`
- `individual` if only `is_self=true` clients (or none + trial)
- `trainee` if route is `/me` OR `clients.user_id = auth.uid()` exists

In R58 we **only branch the dashboard hero copy** ("As tuas semanas" vs "Esta semana com os teus clientes"). Full trainee dashboard refactor (`/me` becomes a real cockpit with logbook + mesocycle + next-block prediction) → **Round 59**.

### Out of scope (explicit, so we don't drift)
- AI message rewriting (R59)
- Calendar sync / ICS export (parked)
- Trainee `/me` upgrade beyond current state (R59)
- Long-distance billing flow (R60+)
- "Reminders / automatic alarms for workouts" (push notifications) — needs PWA push setup, parked

### Why this round, not the bigger split

You asked "what would add value?" Three things move the needle on day-1 retention:
1. **Seeing the week** instead of a wall of names (calendar = orientation).
2. **Seeing the money** (revenue glance = "this app pays for itself").
3. **Being prompted to be human** (birthday / pack-ending nudges with one-click message = the unfair advantage no Trainerize/Excel competitor has).

Splitting individual/trainee dashboards before we've even shown coaches a real cockpit is rearranging rooms before furnishing one. Round 58 furnishes. Round 59 splits.

### Backlog updates
- `.lovable/backlog.md` — Round 58 entry (P0 Coach Cockpit), R59 (Trainee `/me` cockpit + AI message rewrite), R60 (long-distance pay-to-connect flow).
- `mem/index.md` — add Core line: "Dashboard = role-aware cockpit. Coach=this-week+pulse+money+nudges. Individual=own protocol. Trainee=read-only plan+log+feedback."

### Estimated cost
~1 round of credits. No DB migration, no AI calls, no new server functions — pure UI composition over existing queries.

---

**If you'd rather:** I can instead spend this round on R59 (split trainee/individual `/me` into a real cockpit) — but my honest recommendation is cockpit first because it's the surface 100% of paying users see daily.
