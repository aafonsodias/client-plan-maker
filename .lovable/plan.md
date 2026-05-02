# Founder badge fix + Phase B & C execution

## 1. Founder badge — centering + icon rethink

**Why it looks off today:** The badge uses `py-0.5` with a `Crown` icon at `h-2.5 w-2.5` while the text is `text-[9px]`. The crown's visual weight sits in its top half (the spikes), so its optical centre lands above the text baseline → text reads "low" inside the pill.

**Fixes (both applied):**
- Replace `py-0.5` with `py-[3px]` and add `leading-none` on both the icon wrapper and text so the cap-height of "FOUNDER" centres against the icon's optical middle.
- Wrap the icon in `inline-flex items-center justify-center h-3 w-3` and drop the icon to `h-[11px] w-[11px]` so it doesn't dominate.

**Icon: drop the crown.** The crown reads royal/VIP, which clashes with the honest, craft-tool tone of the rest of the app. Three alternatives, ranked:

1. **`Sparkles` (recommended)** — small, asymmetric, reads as "early/special build" without status connotations. Matches the existing "Personalised from assessment" Sparkles already on the landing mockup, so it ties the founder badge visually to the product's own language.
2. **`Anchor`** — fits the captain-seat / helm metaphor of `BrandMark`; reads "early crew, here from the start." Slightly heavier silhouette.
3. **`Flame`** — "early adopter / pilot light." Warm with the amber palette but a bit generic.

**On the blue pill:** in The Matrix, *blue = stay asleep, red = see the truth*. So a blue pill badge would (unintentionally) say "the founder chose comfortable ignorance." Bad metaphor for the person building the product. If you ever want a Matrix nod for a different surface, **red** is the one — but I'd avoid it here because red also means "danger/destructive" everywhere else in the UI palette.

**Plan:** ship `Sparkles` + the centring fix. If you dislike it after seeing it, swapping to `Anchor` or `Flame` is a one-line change.

## 2. Phase B — Assessment & Session polish

- **`src/routes/clients_.$clientId.tsx`** — tighten vertical rhythm (consistent `space-y-4`), collapse a finalised assessment into a single amber summary line ("Avaliação concluída · 12 mar · ver detalhes ▾"), and hide the safety-review block once `plan.status === "finalized"`.
- **Synthesis dashboard** (same route, top strip) — add an ACSM risk pill (low / moderate / high) derived from existing assessment fields, and a 3-segment recovery donut fusing `sleep_quality + stress + soreness` into a single 0–100 readiness score.
- **`src/components/SessionDayView.tsx`**:
  - Fix prep timer: default to `warmup_minutes ?? 8` and `mobility_minutes ?? 5` instead of `NaN` when fields are absent.
  - Move RPE from inline text to a coloured pill (`toneChip` from `src/lib/status-tone.ts`): RPE ≤6 neutral, 7–8 warn, 9–10 danger.
  - "Why this exercise" — currently shows technique cues by mistake; switch the source field to `exercise.rationale` (the AI-generated reason), with technique cues moved to a separate "Execução" disclosure.

## 3. Phase C — PDF + client management

- **`src/lib/pdf.ts`** — remove the duplicated wordmark and tagline under the cover logo. Replace the generic "Plano de Treino" title with the programming label: `"{block_name} · Mesociclo {n}"` (e.g. "Strength Foundation · Mesociclo 3").
- **`src/components/MesocycleTableView.tsx`** — add an RPE sub-line under each set column header ("Set 1 · RPE alvo 7"), and a Table ⇄ Cards toggle stored in `localStorage` (`mesocycle.view`).
- **Client avatars** — migration: add `photo_url text` to `public.clients`. Add upload widget on the client detail page (Supabase Storage bucket `client-photos`, RLS: only the owning trainer can read/write). Render a 32×32 circular avatar in the client list with a `User` icon fallback.

## 4. Pricing reality-check (per your note)

You're right that "8 clients but only 5 plans/month" was incoherent. Phase A already aligned them (Starter 8/8, Pro 25/30, Studio 60/80). I'll add a one-line note in the pricing FAQ explaining the **cost honesty:** AI inference (~€0.06 per plan generation at current Gemini Pro rates) and long-term storage (~€0.02/client/month) are why the per-client price floors where it does. No upsell theatre.

## Files touched

- `src/components/AppShell.tsx` (badge)
- `src/routes/clients_.$clientId.tsx` (assessment polish, synthesis)
- `src/components/SessionDayView.tsx` (timer, RPE pill, rationale)
- `src/components/MesocycleTableView.tsx` (RPE header, view toggle)
- `src/lib/pdf.ts` (cover cleanup)
- `src/components/ClientAvatar.tsx` (new), client list + detail
- migration: `clients.photo_url`, storage bucket `client-photos`
- `src/routes/billing.tsx` (one FAQ line)
- locale updates in `pt/` and `en/` for new labels

## Open question

Pick the founder icon — I'll default to **Sparkles** unless you say otherwise. Reply "go" to execute.
