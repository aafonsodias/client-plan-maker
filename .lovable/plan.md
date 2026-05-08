
# Plan — Protocol design system v2 (Light · Medium · Dark)

Replaces the current Deep/Sage/Mist tri-theme with the spec'd Light/Medium/Dark therapeutic palette, wires every shadcn semantic token to the new variables, and adds the "Welcome, {name}" greeting on login.

## 1. Theme infrastructure

**`src/styles.css`** — single source of truth for tokens. This project uses Tailwind v4, so there is no `tailwind.config.ts`; semantic Tailwind utilities are generated from `@theme inline` in `styles.css`. I'll:

- Replace the current `:root` / `.light` / `.slate` blocks with three new classes: `.theme-light` (default applied via `:root` fallback too), `.theme-medium`, `.theme-dark`. Mutually exclusive.
- Define the exact hex values from the spec under each class (`--bg`, `--surface`, `--surface-warm`, `--border`, `--text-1/2/3`, `--accent`, `--accent-strong`, `--success`, `--success-bg`, `--warn`, `--warn-bg`, `--info`, `--danger`, `--cta-bg`, `--cta-text`).
- Map the spec tokens onto the existing shadcn token names so every shadcn component (Card, Button, Input, Dialog, etc.) re-themes without touching its source:
  - `--background` → `--bg`
  - `--card`, `--popover` → `--surface`
  - `--secondary`, `--muted` → `--surface-warm`
  - `--foreground`, `--card-foreground`, `--popover-foreground` → `--text-1`
  - `--muted-foreground` → `--text-2` (with `--text-3` available for hints)
  - `--border`, `--input` → `--border`
  - `--accent` → `--accent`, `--accent-foreground` → `--cta-text`
  - `--primary` → `--cta-bg`, `--primary-foreground` → `--cta-text`
  - `--destructive` → `--danger`
  - `--ring` → `--accent` at 0.5 alpha
  - sidebar tokens → mirror of surface/border/accent
- Extend `@theme inline` to additionally expose the new spec names directly, so the className strings in the spec (`bg-bg`, `bg-surface`, `bg-surface-warm`, `text-text-1/2/3`, `border-border`, `text-accent`, `bg-accent`, `bg-accent-strong`, `text-success`, `bg-success-bg`, `text-warn`, `bg-warn-bg`, `text-info`, `text-danger`, `bg-cta-bg`, `text-cta-text`) all work as Tailwind utilities.
- Keep the Protocol PDF tokens (`--protocol-accent` etc.) untouched so PDF export stays amber FORGE-spec.
- Remove gradients/glows that aren't a single subtle card elevation shadow. Drop `--shadow-glow`, `--gradient-accent` usage from theme blocks (definitions can stay but neutralised / unused).
- Keep `.light` and `.slate` class aliases mapped to `.theme-light` and `.theme-medium` respectively for one release so any stale localStorage values keep working.

**No-flash boot script** — add a tiny inline script in `src/routes/__root.tsx` head that reads `localStorage.protocol_theme` and sets `documentElement.className` before first paint.

## 2. Theme toggle UI

**`src/components/ThemeToggle.tsx`** — rewrite as a 3-state segmented toggle (Light · Medium · Dark) with sun / half-moon / moon glyphs. Persists to `localStorage.protocol_theme` (values `light` | `medium` | `dark`), migrates legacy values (`deep→dark`, `sage→medium`, `mist→light`, `cream→light`, `slate→medium`, `dark→dark`). Applies the matching `theme-*` class to `<html>`.

i18n keys updated: `theme.light`, `theme.medium`, `theme.dark` in `en/common.json` + `pt/common.json` (es/hi fall back to en per project rule).

## 3. Welcome-by-name on login

In `src/routes/dashboard.tsx` (and/or `AppShell` header), surface "Welcome back, {first_name}" using `useAuth()` → profile name (fallback to email local-part). Single small change, no layout shift. i18n: `common.welcome_back_named`.

## 4. Component sweep — only className strings

Pass over the surfaces most likely to have hardcoded colors (landing, dashboard, /me, /plans/$id, auth, billing, manual, BrandMark plate). Replace any remaining `bg-white`, `bg-black`, `text-gray-*`, `bg-slate-*`, `border-zinc-*`, `text-neutral-*`, raw hex, or vivid emerald/amber-500 utilities with the semantic tokens. `status-tone.ts` keeps its emerald/amber/red because it's the documented semantic palette — but I'll re-point its CSS to consume `--success` / `--warn` / `--danger` so it stays in-system. No business-logic changes.

Spec mapping enforced:
- Page bg → `bg-bg`
- Cards → `bg-surface border border-border rounded-lg` (Card component already does this once tokens are remapped)
- Eyebrow tags → `bg-surface-warm text-accent border border-border rounded-full`
- Primary CTA → `bg-cta-bg text-cta-text`
- Headline structural → `text-text-1`; emotional → `text-accent`
- Body → `text-text-2`; hints → `text-text-3`
- Success badge → `bg-success-bg text-success`; warn badge → `bg-warn-bg text-warn`
- Day headers alternate surface-warm/accent ↔ success-bg/success

## 5. QA before sign-off

- Build passes (auto).
- Smoke each theme on `/`, `/auth`, `/dashboard`, `/me` (375px Mobile Safari), `/plans/$id`, `/billing`.
- Contrast spot-check: `text-text-2` on `bg-surface` and `text-text-3` on `bg-bg` across all three themes ≥ 4.5:1 (3:1 for large). Adjust `--text-3` per theme if needed.
- Confirm `pdf.ts` accent unchanged (still `#E8A547`).
- Confirm no `bg-white` / `bg-black` / raw gray-* utilities remain in touched files (`rg` sweep).

## Defaults assumed
- Default theme = `theme-light` per spec.
- Legacy `dark`/`slate`/`mist`/`deep`/`sage`/`cream` localStorage values auto-migrate; users keep "their" theme as closely as possible.
- The shadcn semantic-token remap is the right move (vs forking every component) — preserves existing component logic, satisfies the "encaixa nos shadcn" instruction.
- Welcome-by-name lives in dashboard hero, not a global toast.

## Out of scope (per spec)
Typography, spacing, layout, gradients/glows, system-auto mode, business logic.
