## Read of the current header

Looking at the screenshot, the header eats ~140px of vertical space on a 391px viewport for four pieces of information: name, phase, protocol step (1/5), email. The avatar is the same height as the name + email stacked beside it, but the type fights it for dominance. The amber "ASSESSMENT IN PROGRESS" pill and the "1/5" sit on a separate visual plane from the name, breaking rhythm. On a working tool that opens to this screen all day, this is the most expensive header in the app.

## Goal

Same four facts, half the height, more editorial. Keep aesthetic principles: Fraunces title, amber as punctuation (not flood), tonal separation, asymmetric.

## Proposed layout (mobile, ≤640px)

```
← Todos os clientes

┌──┐  Aspiringbaconeer                       [⋯]
│ A│  aspiringbaconeer@gmail.com
└──┘  ─── ASSESSMENT IN PROGRESS · 1/5
```

Concretely:
- **Avatar 40px** (was 48px), aligned to the top of the title, square-ish with a subtle sage ring when assessment-in-progress (replaces the amber pill background), copper ring when ready.
- **Name** stays Fraunces, fluid `clamp(1.375rem, 5.5vw, 2.25rem)` — slightly tamer than now so it never needs 2 lines for normal names. Long single words still mid-break + 2-line clamp.
- **Email** moves directly under the name (no extra wrapper margin), `text-xs text-[var(--text-3)]`, single-line truncate with `title`.
- **Phase + step** become one inline strip below name+email: a tiny dot in the phase tone + lowercase `eyebrow` text + `· 1/5`. No filled pill. Amber is reserved for the rare "needs your attention" phase.
- **Overflow menu** floats top-right of the row, `h-8 w-8`, vertically centered on the avatar (was sitting beside the pill cluster).
- Avatar + text column sit in a `grid grid-cols-[auto_1fr_auto]` so the menu never wraps below.

## Desktop (≥640px)

```
← Todos os clientes

┌────┐  Aspiringbaconeer                                            [⋯]
│ AV │  aspiringbaconeer@gmail.com  ·  ASSESSMENT IN PROGRESS · 1/5
└────┘
```

Email and phase strip merge into a single line, separated by `·`. Avatar can grow to 56px since the row has horizontal room. Total header height ~72px instead of ~110px.

## Visual decisions tied to the aesthetic system

- **Typography pairing kept**: Fraunces for name, Inter Tight (uppercase + tracked) for the phase eyebrow. No new fonts.
- **Tonal separation, not borders**: avatar gets a 1px ring in `var(--surface-2)` and the phase strip is just text with a colored dot — no card chrome. Removes the "card-soup" feel of the amber pill plus ring.
- **Amber as punctuation**: the only amber in this header becomes the founder dot on the avatar (when applicable) — already a single pixel of attention. Phase tone uses sage/teal/copper based on `status-tone.ts`.
- **Hierarchical density**: name is the only "loud" element; everything else compresses into one row.
- **Asymmetric**: avatar left, copy block fills, menu pinned right. No centered chrome.

## Files to change

`src/routes/clients_.$clientId.tsx` lines 1561–1697 only. Roughly:
1. Wrap the header in `grid grid-cols-[auto_1fr_auto] items-start gap-3`.
2. Reduce h1 clamp to `clamp(1.375rem, 5.5vw, 2.25rem)`.
3. Move `<p>email</p>` directly under the h1 (already there) and tighten size to `text-xs text-[var(--text-3)] truncate`.
4. Replace `ClientPhaseHeaderPill` visual with a borderless inline strip: `<span class="eyebrow">` + colored dot + step counter. Re-use the same data the pill already exposes — just a thinner presentational variant. If `ClientPhaseHeaderPill` doesn't expose tone+label cleanly, add a sibling `ClientPhaseHeaderStrip` that reads from the same hook and ship the strip without removing the pill component (callers elsewhere keep it).
5. Pull avatar to 40px on mobile, 56px from `sm:` up.
6. Move the dropdown trigger out of the inner flex wrap into the grid's third column so it always sits top-right.

No i18n changes (existing labels reused). No DB. No prop changes outside this file. Three themes verified by re-using tokens only (no hex).

## Acceptance

- Header height ≤80px on 375px viewport for normal names; ≤96px when the name wraps to 2 lines.
- One amber moment max (founder dot, optional).
- Phase, step, email, name, avatar, menu — all six pieces still present and tappable.
- No regression on tablet/desktop layout below the header.