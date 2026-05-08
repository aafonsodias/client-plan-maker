# Schedule: drag bookings + readable labels + therapeutic palette

Three things, in order of risk. The healthcare-color study you sent (soft blues/greens dominant, muted yellows + earth tones as accents, warm for motivation) is a good fit for Protocol — it's a calm, competent, "this person is taking care of you" tool, not a dopamine app. Worth doing, with two caveats I'll flag below.

## 1. Drag bookings to reschedule (week + month)

Today the only ways to move a booking are: open dialog → change date/time, or copy-to-next-week. Direct manipulation is the obvious win.

**Week view (`RowHour` / `BookingBlock`)**
- `BookingBlock` becomes draggable (HTML5 `draggable`, dataTransfer = `bookingId`).
- Each hour cell on each weekday becomes a drop target. Drop = update `starts_at` to that day + hour, keeping the booking's minute offset and duration.
- Visual feedback: dragged block goes to `opacity-50`; hovered hour cell gets `ring-2 ring-accent`.
- Optimistic update via existing `updateFn`, `refresh()` on failure (same pattern as `handleToggleDone`).

**Month view (`ScheduleMonth`)**
- Each day-cell pill is draggable, day cells are drop targets.
- Drop = move to that day, **preserve the original time**.
- Same optimistic pattern.

**Mobile day-strip**: skip drag (no real target — already a single column). Tap-to-edit stays.

**Out of scope for this round**: cross-pack drag, multi-select drag, resize-to-change-duration. Resize is the next obvious thing but it needs a separate handle and a different mental model — flag it as P1 backlog.

## 2. Readable labels on coloured blocks

Looking at your screenshot, the problem is real: white text on `bg-{color}-500/15` in dark mode is fine for the *block* but the text uses `text-{color}-300` which dies on its own tinted background. The `line-through opacity-70` for done bookings makes it actively unreadable.

Fix in `src/lib/schedule.ts` → `PACK_BLOCK`:

- **Block fill**: bump tint from `/15` to `/22` in dark, keep `/15` in light/slate (more contrast against the dark canvas without becoming aggressive).
- **Text colour**: stop using the same hue as the fill. Use `text-foreground` everywhere — the chip is identified by the dot + ring + tinted fill, not by the text colour. Foreground always passes contrast in every theme by definition.
- **Text legibility under tint**: add a subtle text-shadow so labels stay crisp over any saturated fill in any theme:
  ```
  text-shadow: 0 1px 0 color-mix(in oklab, var(--background) 70%, transparent);
  ```
  Expose as a utility class `.label-on-tint` in `src/styles.css`. This is the "contour" you asked for — softer than a stroke, no childishness.
- **Done state**: drop `opacity-70`, keep `line-through`, add a small ✓ pill at the right (already present). Strikethrough alone communicates done; opacity drop is what kills it.

## 3. Therapeutic palette (the healthcare study, applied honestly)

Current `PACK_COLORS` = `[emerald, amber, blue, violet, rose, cyan, orange, lime]`. That's a generic 8-colour rainbow — fine for tagging, wrong for a clinical-feeling app. The study's recommendation: **cool-dominant** (blues/greens) with **muted warm accents** (amber/terracotta) and **earth tones** at low frequency.

New `PACK_COLORS` (8 slots, ordered by hand-out frequency — the first picks fire most often via `colorFromId` hash):

| Slot | Token name | Role | Use |
|---|---|---|---|
| 1 | `sage` | cool-green | calm baseline |
| 2 | `mist` | soft blue | trust/clarity |
| 3 | `clay` | muted terracotta | warm accent (motivation) |
| 4 | `ocean` | deeper blue-green | second cool |
| 5 | `wheat` | muted yellow | low-rate warm |
| 6 | `stone` | warm grey-brown | earth tone |
| 7 | `plum` | desaturated mauve | rare, distinctive |
| 8 | `moss` | deep green | last-resort cool |

All defined in `src/lib/schedule.ts` `PACK_BLOCK` with three variants per token (dark / slate / cream), so each chip is calibrated per theme rather than relying on `dark:` flips of the same `*-500` Tailwind colour. This is more code, but it's the only way the palette holds across all three themes — and it stops us being chained to Tailwind's saturated default scale.

**Two honest caveats:**
- The study is about *clinical environments*, not productivity tools. The "calm" effect is real but at high saturation we'd lose at-a-glance distinguishability between the 8 chips. The proposed slots are deliberately distinct in **hue** (green/blue/terracotta/yellow/brown/mauve), not just lightness, to keep glance-readability.
- The amber accent (`--accent`) stays. It's the brand. The new palette runs in parallel for *client tagging only* — we're not repainting buttons or focus rings.

## 4. Contrast audit (after the palette lands)

Sweep the surfaces most likely to break with the new chips:
- `CoachCockpit` calendar dots (already using these colours).
- `clients_.$clientId` header chips and avatars.
- `ClientAvatar` initials background derives from the same palette.
- `RevenuePanel` per-pack legend.
- Plan view block-evolution chips.

Each surface gets eyeballed in dark / slate / cream. Anything below ~4.5:1 on text, below ~3:1 on borders/dots, gets fixed in the same round.

## Technical notes

- Drag uses HTML5 DnD (no library): `draggable`, `onDragStart`, `onDragOver` (preventDefault), `onDrop`. Keep `e.stopPropagation()` discipline already used by the ✓ button so drag doesn't fight the open-dialog click.
- Drop handler reads `bookingId` from `dataTransfer`, computes new `starts_at` ISO from the cell's day+hour, calls `updateFn({ id, starts_at })`, then `onBookingsMutated()`.
- `colorFromId` becomes order-sensitive after we reorder `PACK_COLORS`, so existing clients will get reassigned hues on first render. That's fine (no DB migration), but worth noting in case anyone has memorised "Gustavo is green".
- `.label-on-tint` utility added to `@layer utilities` in `src/styles.css`. The `color-mix` fallback uses `var(--background)` so it adapts per theme without a new variable.
- Mobile: drag is desktop/tablet only — touch DnD is a usability disaster without a long-press affordance, and we don't need it for a v1.

## Order of work

1. Palette tokens + `.label-on-tint` utility (foundation — everything else uses it).
2. Drag week view → drag month view.
3. Readability pass on done state + audit listed surfaces.

## Out of scope

- Resize-to-change-duration.
- Cross-pack reassignment via drag.
- Touch DnD on mobile.
- Repainting the brand amber accent.
