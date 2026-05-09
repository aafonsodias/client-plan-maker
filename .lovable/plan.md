
## What you're getting

Two threads, ordered by "biggest frog first":

1. **Frog #1 — Intake invite is half-built.** The "generate link" path lets you create a placeholder client with no contact info, so you can't actually send the link from inside Protocol. Fix that first.
2. **Frog #2 — Inner-app aesthetic direction.** A locked design language for every authenticated page, paced so it ships with the MVP and gets a polish pass after.

The Aesthetics PDF didn't parse cleanly on my side, so I'm working from the classical principles it covers (unity, hierarchy, contrast, rhythm, proportion, restraint) plus your own brand rules already in memory (amber under-glow, BrandMark, status-tone palette, "looks → function → ease"). If you want me to lift specific passages, paste the section and I'll fold it in.

---

## Thread 1 — Intake invite, end-to-end

Today: `createInviteClient` only takes `fullName?`. There's no email/phone, no copy-to-clipboard with a pre-written message, no WhatsApp/SMS deeplink. Result: you generate a link and then have to leave the app to send it.

Plan:

- **`createInviteClient` accepts `{ fullName?, email?, phone? }`** and stores them on the placeholder client row. Validation matches `createManualClient` (email format, phone ≤ 40 chars).
- **New "Send invite" sheet** on the clients list (replaces today's silent generate). Three fields + a generated link + three send buttons:
  - Copy link
  - Open WhatsApp (`https://wa.me/<phone>?text=<encoded>`) — only if phone present
  - Open mail client (`mailto:<email>?subject=…&body=…`) — only if email present
- **Pre-written PT message** (editable inline before sending) — uses the trainer's `business_name` + first name.
- **Resend / regenerate** keeps current behavior but surfaces the same sheet.
- Token TTL stays at 14 days.

No schema change needed — `clients.email` and `clients.phone` already exist.

---

## Thread 2 — Inner-app aesthetic direction

### The principle (locked, save to memory)

> **Calm tools, loud moments.** The chrome (nav, tables, forms) stays quiet, dense, and trustworthy — like an editorial dashboard. Hero moments (plan ready, block transition, capacity gain, PR) get one bold gesture: a single amber under-glow, a large numeral, or a slow reveal. Never two at once.

Concretely:
- One display font already chosen sticks; body stays Inter. No new families.
- Status colour is the only chromatic vocabulary: emerald / amber / muted / red. No purples, no gradients beyond the existing amber under-glow.
- Spacing rhythm: 4 / 8 / 16 / 24 / 48. Pages breathe at 48 between sections, never less than 16 between cards.
- Density default: comfortable on desktop, tighter on mobile (current AppShell behavior — keep).
- Motion: 200ms for state, 600ms for reveals, never both on the same element.

### Per-page direction

I'll group by surface so you can see the through-line. Each gets a one-liner intent + the "loud moment" reserved for that page.

**Trainer chrome**
- `dashboard` — quiet KPI strip on top, then a single "next action" card with amber under-glow. Loud moment: that card.
- `clients` (list inside `clients_.$clientId.tsx` parent) — editorial table; avatar + name + status chip + last-seen. Loud moment: birthdays / red-flag rows get a thin amber left border.
- `clients_.$clientId` — split: left rail = identity + adherence ring, right = phase timeline. Loud moment: capacity-gain card when block_number > 1.
- `clients_.$clientId.year` — keep the year heatmap; quiet everything around it.

**Plan authoring**
- `plans.index` — same editorial table treatment as clients. Status pill is the only colour.
- `plans.new` / `plans.quick` — single-column wizard, generous 48 spacing, amber under-glow only on the primary CTA.
- `plans.$planId` (view/results) — keep current header, but tighten: block chip, programming tier dot, capacity-gain card. Loud moment: "Pronto" reveal (600ms fade-in once).
- `plans.$planId.brief` — Intensity Cockpit stays the visual centerpiece; surrounding fields go monochrome.
- `plans.$planId.blueprint` / `microcycle` / `progressions` / `sessions` — table-first, no card chrome. Density wins here. Loud moment: none — these are working surfaces.

**Intake / public**
- `intake.$token` — already has trainer white-label; tighten section spacing to 48, give each section a numbered chip (01, 02…) for hierarchy. Loud moment: submit confirmation.
- `log.$token` — single-task UI; keep big touch targets; amber under-glow on "Save set" only.

**Client portal**
- `me` — already rebuilt this round. Lock the layout: hero card → today's session → check-in → weekly strip → messages → bookings → packs. Loud moment: today's session card.
- `me.progresso` — quiet charts (already using CSS vars); loud moment is the capacity-gain delta numeral.
- `me.historico` — pure list, no chrome. Loud moment: PR badges inline.

**Settings / system**
- `settings`, `billing`, `schedule`, `schedule.packs`, `templates`, `knowledge`, `admin.system`, `welcome` — all editorial-quiet. No loud moments. These are tools, not theatre.

### What ships in the MVP vs what waits for the polish pass

**Ship now (this round, after Thread 1):**
1. Apply spacing rhythm + section numbering to `intake.$token`.
2. Add the "next action" card on `dashboard` with amber under-glow.
3. Add thin amber left border for birthday / red-flag rows on the clients list.
4. Lock the principle into `mem://design/aesthetic-direction.md` so future rounds inherit it.

**Polish pass (after MVP gate, tracked in `.lovable/backlog.md`):**
- Numbered chips for every multi-section form (brief, intake, settings).
- 600ms reveal animation on plan "Pronto" state.
- Capacity-gain numeral typography pass (large display number, small label).
- Density audit on plan authoring tables.
- Empty-state illustrations (only if we can do them in line art, not stock).

### Memory writes (after approval)

- `mem://design/aesthetic-direction.md` — the "calm tools, loud moments" principle + per-page loud-moment table.
- `mem://principles/one-loud-moment-per-page.md` — short rule, added to Core index.
- Backlog entry in `.lovable/backlog.md` for the polish pass items.

---

## Order of operations

1. Thread 1 (intake invite fields + send sheet) — ~1 round.
2. Thread 2 ship-now items (4 bullets above) — ~1 round.
3. Memory writes happen alongside #2.
4. Polish pass items stay parked until you say "MVP is done, let's polish".

Say the word and I'll start with Thread 1.
