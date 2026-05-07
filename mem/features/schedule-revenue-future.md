---
name: Schedule & revenue — deferred scope
description: What R67 audit deferred for the schedule/revenue model. Design as one coherent system, not patched in.
type: feature
---
R67 shipped only: Today strip on dashboard, weekly-frequency guard in BookingDialog (uses `client_packs.weekly_frequency`), revenue caption ("based on sessions scheduled this week"). Slot-prefill of date+time was already in place.

Deferred (do NOT patch in piecemeal — design as one coherent Schedule & Revenue Model later):
- Recurring/fixed weekly slots
- Monthly view (occupancy + revenue) and annual view (lifecycle, seasonality)
- Holidays / vacations blocking the loop
- Direct-debit / monthly subscription tracking on clients
- Trial-session lifecycle
- Stripe billing on top of packs
- Session-revenue extrapolation from recurring rules
- "Selected client" sticky on /schedule for full slot-click prefill (today only date+time prefill exists)
- Client phone field on manual-create dialog (schema already has `clients.phone`; needs `createManualClient` signature tweak — defer until phone is part of a real workflow like WhatsApp follow-up)

Sources of truth already available:
- `client_packs.weekly_frequency` — agreed cadence per pack
- `client_packs.price_per_session_eur` × non-cancelled `client_bookings` — revenue
- `clients.intake_status`, `workout_plans.status` — operational signals for Today strip
