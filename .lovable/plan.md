## Goal

Two surgical mobile polish changes on the microcycle page, plus seed an "InfoHint" pattern we can reuse across the app.

---

## 1. "Aprovar microciclo" button — alive, green, tidy

**File**: `src/routes/plans.$planId.microcycle.tsx` (lines ~197-204)

Change from primary-amber pill to a confident emerald CTA with motion:

- **Color**: emerald gradient (`from-emerald-500 to-emerald-600`) + soft emerald glow shadow (`shadow-[0_0_24px_-6px_oklch(0.72_0.16_160/0.55)]`). Matches our `success` palette in `mem://core` (Ready = emerald).
- **State logic**:
  - Disabled (`!allDone`): muted slate, no glow, lock icon, label "Completa todos os dias para aprovar" (truncate to "Completa os dias" on `<sm`).
  - Enabled: emerald gradient + subtle `animate-pulse` on the ring (not the whole button — too noisy), `CheckCircle2` icon swaps in, hover lifts (`hover:-translate-y-0.5`).
  - Busy: spinner + "A aprovar…".
- **Layout tidy on mobile**: today the button sits in a flex-row that wraps awkwardly on 391px. Move it into its own full-width row below the title block on `<sm` (`w-full sm:w-auto`), give it `justify-center`, and add a thin emerald hint line above when `allDone` ("Tudo pronto — podes aprovar") so the green action feels earned.
- Add i18n keys `actions.approve_microcycle_disabled`, `actions.approve_microcycle_busy`, `microcycle.ready_to_approve` in both `en/plan.json` and `pt/plan.json`.

No new dependencies. ~25 lines changed.

---

## 2. The orange "11" badge needs an info affordance

The amber circle next to "Brief" in the header is the count of `red_flags` parsed from the brief. Today it has zero explanation — exactly the user's complaint.

**File**: `src/components/BriefSheetButton.tsx`

- Add a small `Info` icon (lucide) sitting flush against the badge.
- Wrap badge+icon in a `Tooltip` (shadcn) with copy: PT "Sinais de alerta detetados no teu brief — toca para rever" / EN "Red flags found in your brief — tap to review".
- On mobile (touch, no hover), tooltip opens on tap via `TooltipProvider delayDuration={0}` + `onClick` toggling open state — already the pattern shadcn supports.
- Recolor amber → our `warn` token from `src/lib/status-tone.ts` so it stays consistent with the rest of the app's chips.
- Pull the label "Brief" + count into a single `aria-label`: "Brief — 11 sinais de alerta".

---

## 3. Reusable `InfoHint` primitive (seed for the rest of the app)

Create `src/components/InfoHint.tsx`:

```tsx
<InfoHint label="Sinais de alerta" tone="warn">
  Marcadores extraídos do teu brief que merecem atenção…
</InfoHint>
```

- Renders a 12px `Info` icon with the project's tone tokens (neutral / warn / danger / success).
- Wraps a shadcn `Tooltip` that also opens on tap (mobile-friendly).
- Optional `as="badge"` variant for inline use next to numeric counts (case #2).

Then drop it in **2 high-value places** this turn (no scope creep):

1. The Brief badge (case #2).
2. The "Stage 3 — Microcycle (Week 1)" subtitle on the microcycle page → explains what a microcycle is in one sentence.

This becomes the primitive the future "manual de instruções" hooks into — every InfoHint can later carry a `helpKey` that opens the relevant manual section. We do NOT build the manual this turn — that is the next dedicated batch (see below).

---

## 4. Out of scope this turn (queued for next batch)

- Full step-by-step user manual (registo → log → feedback). This deserves its own dedicated route (`/manual` or in-product overlay tour) and content writing pass. I'll plan it separately when you say "go manual".
- Spreading InfoHint to every screen — we ship the primitive + 2 anchor uses, then expand once you've seen the visual weight on mobile.

---

## Files touched

- `src/components/InfoHint.tsx` (new, ~40 lines)
- `src/components/BriefSheetButton.tsx` (swap badge, add InfoHint)
- `src/routes/plans.$planId.microcycle.tsx` (emerald CTA + InfoHint on subtitle)
- `src/i18n/locales/en/plan.json` + `src/i18n/locales/pt/plan.json` (4 new keys each)

Reply **"go"** to ship, or **"go + manual"** if you want me to also draft the manual structure in the same turn.