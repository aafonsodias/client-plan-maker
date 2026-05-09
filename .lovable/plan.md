## Two things in one round

### 1. Filter pills row — refine

Today the row uses `bg-accent` filled pills (active) + `bg-secondary/60` filled pills (inactive). Against the new tonal `bg-muted/40` list below, the filled grey rectangles feel heavier than everything around them. The "TODOS · 1" amber pill especially shouts.

Proposed look (matches the rest of R101/R102 tonal language):

- Inactive: ghost — no background, `text-muted-foreground`, count rendered as a dimmer sibling (`text-foreground/40`) so the label reads first and the number is supporting.
- Hover: `text-foreground` + subtle `bg-muted/40`.
- Active: still readable at a glance but quieter — `text-foreground` + `bg-muted/60` + a 1px amber underline (or a tiny amber dot before the label) instead of a fully filled amber pill. One quiet amber accent, not a chunky badge.
- Keep uppercase tracking; drop `shadow-sm` on active (no shadow on flat tonal surfaces).

Result: the row reads as a navigation strip, the list below stays the loud surface, and the amber is used as a single restrained accent — same principle as the Founder badge.

### 2. AI-generated avatars for real clients — recommend against

Honest take: I'd skip it. Three reasons, in order of importance:

1. **Skin-tone risk you already flagged.** A trainer importing an Indian client and seeing a white face (or vice versa) is worse than seeing a clean monogram. There's no fix for this short of asking the client their ethnicity, which is a GDPR-sensitive special category and not something we want to ask.
2. **Uncanny / dishonest.** The brand line is "honest craft tool, no fake social proof." Sticking a stranger's AI face on a real person is the avatar equivalent of fake testimonials. Trainers will eventually notice and it erodes trust in everything else.
3. **It's solving the wrong problem.** The placeholder feels empty because the current fallback (grey disc + tiny initials) is timid, not because a face is missing. A confident monogram fixes it without any of the above.

**Counter-proposal — confident deterministic monogram** (no AI, no network call, no skin colour question):

- Larger, bolder initials (1–2 letters), proper display weight.
- Background: deterministic warm tonal swatch derived from `hash(client.id)` mapped into the existing palette (muted amber / warm taupe / soft clay / sage / sand — all already in our token range, all flattering on the tonal canvas). Same client always gets the same colour.
- 1px ring in `border/40` for depth, no harsh outline.
- Real photo (when uploaded) still wins — this is purely the fallback.

This lands closer to Linear / Notion / Height avatars: instantly recognisable per person, never wrong about who they are, looks intentional rather than empty.

Where AI portraits *do* make sense and stay: the **demo personas** in `src/lib/demo-avatars.ts`. Those are fictional people and the realism helps the demo land — keep that as is.

### Scope of this round

- `src/routes/dashboard.tsx` lines 510–527 — pill row redesign as above.
- `src/components/ClientAvatar.tsx` — replace the muted-disc fallback with the deterministic warm-monogram fallback. Photo path unchanged. `verified` badge unchanged. Used everywhere already, so this lifts every list/header without touching call sites.

### Out of scope

- No AI portrait generation for real clients (recommend against — see above).
- No changes to `src/lib/demo-avatars.ts` (demo personas keep their portraits).
- No changes to the list rows themselves (R101/R102 already covered them).
- No data-model or upload changes.

### Open question

Want me to also propose this same monogram treatment for `/clients/$id` header and `ClientPlayerCard` row at the same time, or keep this round tight to the dashboard pill row + the shared `ClientAvatar` component (which automatically lifts both)?
