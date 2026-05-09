## Why the previous fix didn't visibly work

The `<h1>` already wraps mid-word and clamps to 2 lines — that's why "Aspiringbacon / eer" appears in the screenshot. The real problem is the font is too big on a 391px viewport, so even 2 lines feels enormous and the second line is just "eer".

The responsive sizes I added (`text-2xl sm:text-3xl lg:text-4xl`) are being overridden by the `.t-1` class, which sets `font-size: var(--text-4xl-v2)` directly in `src/styles.css`. Two single-class selectors → source order decides, and `.t-1` loads after Tailwind's utilities, so `t-1` wins. Net effect: the text stays at 4xl on mobile.

## Fix

In `src/routes/clients_.$clientId.tsx` line 1576, replace the static responsive classes with a fluid `clamp()`-based size that beats `.t-1`:

```tsx
<h1
  className="t-1 min-w-0 line-clamp-2 [overflow-wrap:anywhere] !text-[clamp(1.5rem,6.5vw,2.75rem)]"
  title={client?.full_name}
>
  {client?.full_name}
</h1>
```

What this does:
- `!text-[clamp(...)]` — Tailwind's `!` important prefix forces the font-size to win over `.t-1`. Range: 24px on tiny phones → up to 44px on desktop.
- Keeps `t-1` for the display font family, weight, leading, and optical sizing.
- `line-clamp-2` + `[overflow-wrap:anywhere]` — already there; ensures long single words break and any overflow past 2 lines is ellipsised.

## Verification

- 391px (current viewport): "Aspiringbaconeer" should sit on a single line, ~25px tall, comfortably beside the avatar.
- 1280px+: still reads as a hero title (~44px).
- Hover shows full name via `title`.

Single-file change. No i18n, no schema. Approve to ship.