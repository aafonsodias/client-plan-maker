
# Plan — Theme-aware logo underline

## Problem
`src/components/Logo.tsx` and `src/assets/protocol-mark.svg` hardcode the under-tab to `#5BA3D8` (a generic SaaS blue). With the new Light/Medium/Dark therapeutic palette, this is the single remaining color in the app that doesn't speak the design system, and it directly violates the "amber is the only decorative accent" rule.

## Change
Make the under-tab consume `var(--accent)` so it shifts per theme:
- Light → burnt amber `#B8743A`
- Medium → warm amber `#DD9A60`
- Dark → soft amber `#E8A66B`

## Implementation (1 file, ~2 lines)
**`src/components/Logo.tsx`** — replace the hardcoded `fill="#5BA3D8"` on the `<rect>` with `fill="currentColor"` on a wrapper, OR more cleanly:

```tsx
<rect x="20" y="55" width="14" height="3" rx="1" fill="var(--accent)" />
```

(SVG inline supports CSS variables since the element is in the document tree.)

The stencil "P" path stays `fill="currentColor"` so headers, buttons, and chrome that pass `text-text-1` / `text-cta-text` continue to control the P itself — only the accent bar changes per theme.

## Out of scope
- `src/assets/protocol-mark.svg` (static asset). Only used as a favicon-style import; CSS variables don't resolve in standalone `.svg` files served as `<img src>`. I'll leave it amber-static (`#B8743A`) so external usages still look on-brand. Inline `<Logo/>` is what the app actually renders.
- `BrandMark.tsx` amber under-glow ring — already amber, no change needed.
- PDF tokens — untouched (PDF stays amber FORGE-spec).

## QA
Visual check on `/`, `/auth`, `/dashboard` across all three themes — bar should read amber-warm, amber-mid, amber-soft respectively. Build runs automatically.
