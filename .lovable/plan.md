# Fix client crash · posture intake · re-show manual hint · bigger logo · cleaner hero

## 1. Fix the crash on "Open client" (CRITICAL)

The runtime trace shows `Maximum update depth exceeded` triggered from `<AppShell>` while landing on `/clients/$clientId`.

Root cause is in `src/routes/clients_.$clientId.tsx` ~ line 2739:

```ts
const ctx = useSectionCollapseProvider(...); // returns a fresh object every render
useEffect(() => {
  if (focused) ctx.setOpen(activeId, true);  // mutates state
}, [focused, activeId, ctx]);                // ctx changes every render → infinite loop
```

`useSectionCollapseProvider` rebuilds its return value on every render, so the effect re-fires forever and React eventually bails with the depth error (which the route's error boundary then renders as "Something went wrong").

**Fix:**
- Memoise the provider return: wrap it in `useMemo` so identity is stable when `isOpen / setOpen / setAll / allOpen / allClosed` haven't changed.
- Drop `ctx` from the effect dependency array; depend only on `focused`, `activeId`, and the stable `setOpen` callback.
- Also harden the "trainer-edit detection" effect (line 687) to avoid feedback loops by skipping when the computed `next` is structurally equal to current provenance.

## 2. Re-introduce the dismissable manual / coach-mark

The dashboard hero numbered-steps card currently only shows when `isEmpty`. The user wants it permanently togglable.

- Add a `<DashboardHint />` card that always renders the 3-step "como funciona" guide on `/dashboard` and `/clients`, with an `×` button that persists `localStorage["forge.hint.dashboard.dismissed"]="1"`.
- Add a "Mostrar guia" toggle in the dashboard's quick-actions strip (visible when dismissed) so the user can bring it back.
- Reuse the same component on the client detail page (collapsed by default, opens on click) explaining "Avaliação → Plano → PDF".

## 3. Bigger, cleaner brand mark

The user finds the current logo too small and dislikes the circle plate.

- `<Logo />` (raw mark) stays as the source of truth; remove the rounded-full plate from `<BrandMark />` so it renders as the bare PNG with the amber under-glow only.
- Bump default sizes: `sm 7→8`, `md 9→11`, `lg 12→14` (Tailwind units). Header in AppShell uses `md`; auth screen uses `lg`.
- Hero of the landing already uses an inline mark; add a larger mark (`h-12 w-12`) next to the FORGE wordmark in the nav.
- Keep the favicons we already regenerated.

## 4. Reorganise the landing hero (clarity over density)

Current hero crams: headline + subtitle + sparkles social-proof chip + 2 CTAs + footer note + a heavy two-week-microcycle mockup. It overflows visually.

- Reduce the right-column mockup to a slimmer, single-week table (4 exercises) so it doesn't dominate.
- Move the "social proof" chip BELOW the CTAs as a single tiny line, not a chip.
- Tighten vertical rhythm: hero `py-32 → py-20`, h1 `text-7xl → text-6xl` on desktop.
- Move the "Conta grátis · 1 cliente · 1 plano…" footnote into the secondary CTA's tooltip or a single muted line.

## 5. Posture & visual-harmony intake (3 photos + face profile)

The user wants a standardised photo step in the intake. Honest framing: research on posture-based programming is weak, but standardised photos remain useful for **visual progress tracking, screening obvious asymmetries, and rapport** — we'll position it that way, not as "posture cures injury".

### a) Storage
- New private bucket `client-photos-intake` (or reuse `client-photos` with a `posture/` subpath: `{trainerId}/{clientId}/{slot}.{ext}`).
- Slots: `front`, `side`, `back`, `face`. Path: `{trainerId}/{clientId}/posture-{slot}.{ext}`.
- New columns on `assessments` (jsonb is already used via `extended`):
  - `extended.photos = { front?: string, side?: string, back?: string, face?: string, captured_at?: string }` (signed-url cache lives in client; storage path is the source of truth).
- Or better: add a `client_photos` table with `(client_id, slot, path, captured_at)` so we can keep history. Decision: jsonb on `assessments.extended.photos` for v1 (simpler, matches the existing pattern); migrate to a table when we want history.

### b) Intake UI (new slide in `src/routes/intake.$token.tsx`)
- Slide title: "Fotografias de referência (opcional)".
- Honest copy: "Não usamos para diagnosticar postura. Servem para acompanhar a tua evolução visualmente e padronizar o registo. Podes saltar."
- 4 capture cards (Front / Lateral / Back / Rosto), each with:
  - A diagram silhouette showing the correct pose (light SVG, no real photos).
  - "Como tirar" mini-tutorial: distância 2m, parede neutra, roupa justa, iluminação natural, telemóvel à altura do peito.
  - Single tap → camera capture (mobile native `<input capture="environment">`) or file picker on desktop.
  - Auto-resize client-side to ≤1600px JPEG before upload (avoid huge files).
  - Show preview + "Tirar outra" button.
- Skip button (uses existing universal skip) marks `extended.skipped.photos = true`.
- New i18n keys under `intake.photos.*` (PT + EN).

### c) Coach side (`src/routes/clients_.$clientId.tsx`)
- New `Photos` section in the assessment view: 4 thumbnails in a row, click to open lightbox, "Substituir" / "Remover" actions.
- Add a "Tirar fotos" button that re-sends the intake link scoped to just the photos slide (`?step=photos`), so the coach can ask a client mid-flow.

### d) Server
- Reuse the existing `client-photos` upload pattern (`<ClientAvatarUpload />`); extract a shared `uploadClientImage(slot, file)` helper in `src/lib/client-photos.ts` to centralise compression + signed URL refresh.
- No new server function needed — direct supabase storage upload from the intake page (RLS already scopes `client-photos` to trainer).

## 6. Memory updates
- `mem://design/brand-mark` — remove circle plate; logo renders bare with amber under-glow.
- `mem://features/intake-photos` (new) — slot names, bucket path, framing copy ("not posture diagnosis, visual progress").
- `mem://index.md` Core: "Posture photos = honest framing (visual progress, not diagnosis). Bucket `client-photos`, paths `{trainerId}/{clientId}/posture-{front|side|back|face}.jpg`."

## Files

**Edit**
- `src/routes/clients_.$clientId.tsx` — fix infinite-loop effect; add posture section.
- `src/components/BrandMark.tsx` — drop the circle plate; bigger sizes.
- `src/routes/index.tsx` — slimmer hero composition.
- `src/routes/dashboard.tsx` — extract dismissable hint; show toggle.
- `src/routes/intake.$token.tsx` — new photos slide + i18n hooks.
- `src/i18n/locales/{pt,en}/intake.json` — `photos.*` keys.
- `mem/index.md`, `mem/design/brand-mark.md`.

**Create**
- `src/components/DashboardHint.tsx` — togglable 3-step guide.
- `src/components/intake/PhotoCaptureCard.tsx` — single-slot camera/upload tile with diagram + tutorial.
- `src/lib/client-photos.ts` — shared upload + compression helper.
- `mem/features/intake-photos.md`.

## Out of scope (next iteration)
- Spider/radar comparison charts between two photo sessions.
- Cropping / pose-alignment overlay (we just standardise the framing copy for v1).
- Migrating photo history to a dedicated table.
