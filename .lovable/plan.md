## Round goal

Tighten the trainer surface (dashboard ↔ clients) and fix everything you flagged in the intake. No new "extensions" — finish what's already there cleanly.

---

## 1. Dashboard + Roster: stop being two pages

Today: `/dashboard` and `/clients` show overlapping data and three buttons all do the same thing.

Changes:
- **Inline the roster on `/dashboard`** below the Attention panel: avatar + name + phase pill + ArrowRight, exactly like `/clients` shows now. Filter chips (All / Active / Ready / Idle / Onboarding) live above it.
- **Remove "Clients" stat card** (the count is already implicit in the list + filter chips).
- **Keep `/clients` as a deep-link target** for the same component (so existing links don't break) but the dashboard becomes the canonical entry. Remove the giant "Clients 0" / "Plans created 0" stat block.
- **One single primary action** in the header: `+ Cliente` opens a small menu with **two** options:
  1. **Convidar por link** (golden path — current invite dialog)
  2. **Adicionar manualmente** (opens a small form: nome + email + telefone, creates the client row directly with `intake_status = 'manual'`, then routes to `/clients/$id` so the trainer can fill the assessment themselves)
- Drop the secondary "Convidar cliente" button and the "+ Cliente demo" button from the body of `/clients` (the demo button stays gated behind `?lab=1` for the founder).

## 2. Coaching mode: drop "Híbrido", rename, rewrite the copy

Two real archetypes, like you said:
- **`self_log`** — "Vou treinar sozinho com o teu plano" (client trains alone, logs sessions in their portal — like an individual user)
- **`coached`** — "Vamos treinar juntos" (PT-led, client gets the dashboard to follow progress, doesn't need to log)

Replace `mode_in_person` / `online` / `hybrid` triplet with these two, drop the literal i18n keys leaking through, and keep `intake_path` column accepting `'self_log' | 'coached'` (migration to relax the existing CHECK if any).

## 3. SMART goal: AI suggestion + sensible defaults

Slide currently asks two raw text inputs ("Como vais medir o sucesso?" / "Até quando?").

New behavior on that slide:
- After "What do you want to achieve?" answer, call `interpretGoal` (already exists, uses Flash — cheapest tier) and propose:
  - 3 measurable suggestions as clickable chips (e.g. "Agachar 1.5× peso corporal", "Correr 10k em 60min", "Perder 5kg")
  - 3 deadline chips (8 / 12 / 16 weeks, derived from `timeline_weeks` returned by AI)
- Pre-select the highest-confidence suggestion + the AI-suggested deadline. User taps to accept or types over.
- Free-text fallback stays (small "escrever outro" link).

Statistics-driven preselection elsewhere too: experience = "Iniciante", days/week = 3, session = 60 min, location = "Ginásio" — all editable, just defaulted.

## 4. Equipment slide: kill the inner scrollbar

Current: vertical scroll inside the slide because every category has a heading row.

New layout:
- One flat wrap of pills, **colour-coded by category** (use the existing status-tone palette: free-weights = amber, machines = blue, bodyweight = emerald, conditioning = neutral, mobility = muted, racks = primary).
- A small legend row at the top (5–6 dots + label).
- Search bar stays at top, filters the same flat list.
- Removes the `max-h-[50vh] overflow-y-auto` wrapper.

## 5. Profile photo: own slide + immediate avatar feedback

- Move the **face** photo out of the 4-slot reference grid into its **own slide** placed right after Identity, titled "Foto de perfil". Reference photos slide keeps front / side / back only.
- As soon as the face photo uploads, render a small avatar in the slideshow header (next to the FORGE logo) so the client immediately feels "I'm in".
- Mirror to `clients.photo_url` on upload (already wired) — verify the signed URL refresh works.
- Future "certified badge" overlay is noted in the backlog but **not** built this round (needs a real verification flow, not a fake badge).

## 6. Thanks screen: fix i18n + signup flow

Issues:
- Literal `thanks_title_anon` rendered → means the EN bundle is missing the key. Add `thanks_title_named` / `thanks_title_anon` / `thanks_desc_v2` / `thanks_create_account_*` to **`src/i18n/locales/en/intake.json`** too.
- Rewrite PT copy:
  - Title: "Pronto, {nome}." (or "Pronto." if anon)
  - Subtitle: "{trainer} vai rever a tua avaliação antes da primeira sessão."
- Account creation block: present **email/password as primary** + "ou continua com Google" as secondary link (you said Google is one option, not the only one).
- After Google round-trip we already auto-link via `linkClientAccount`. Add a guard: if the current authenticated user **is the trainer themselves** (their own intake link), skip the linking, show a friendly "Estás autenticado como treinador. Abre este link em modo anónimo ou noutro browser para testar como cliente." message — that fixes the "carreguei e voltei ao começo" loop you hit.

## 7. Keyboard: Enter advances on desktop

Already implemented in `SlideshowIntake` via `onKey` handler **but** it's blocked when focus is in `<Input>` because Enter inside a form input bubbles weirdly. Verify: keep the global handler, also let inputs forward Enter (preventDefault + call `next()`). Textareas remain Shift+Enter for newline, plain Enter advances only when the field is not multi-line.

## 8. Publish vs preview — quick clarification (no code)

To answer your question directly: yes, you need to **Publish** once for the app to be reachable by a real client on their phone. After that, you can keep iterating here in Lovable preview without breaking the published version — the preview URL (`id-preview--…lovable.app`) and the published URL are independent. Each new publish snapshots whatever the preview is at that moment. So the workflow is:

1. Publish now → share `https://<your-project>.lovable.app/intake/<token>` with a real client (or yourself on a 2nd email).
2. Keep working here. Re-publish whenever you want the public version to catch up.

I'll surface a "Publish" reminder in the dashboard hint after this round.

## 9. Backlog (NOT this round, written down so we don't lose them)

- Step counting / activity tracker integration (Apple Health / Google Fit) and the rich activity philosophy you wrote — this is its own feature, not a 1-line field.
- "Certified" badge on profile photo (needs ID verification flow).
- Client portal mensagens / training log / progress charts (`/me` is read-only stub today).
- Longer assessment surface — once #1–#7 are clean, we'll do a dedicated "deep assessment" pass mapping every field from the FORGE coach-side assessment into the slideshow.

---

## Technical plan

**Migrations**
- `clients.intake_path` CHECK constraint → allow `'self_log' | 'coached'` (drop old constraint, add new). Existing rows stay untouched.
- No other DB changes this round.

**Files to edit**
- `src/routes/dashboard.tsx` — inline roster, remove Clients stat, add `+ Cliente` dropdown.
- `src/routes/clients.tsx` — keep route, render same component as dashboard's roster section, remove duplicate "Convidar" button, add manual-create form behind the same `+ Cliente` menu.
- `src/components/AddClientMenu.tsx` (new) — the dropdown with "Convidar por link" / "Adicionar manualmente".
- `src/server/intake.functions.ts` — add `createManualClient({ fullName, email, phone })` server fn.
- `src/routes/intake.$token.tsx`:
  - Replace mode slide options (`self_log` / `coached`).
  - Split face photo into its own slide, add header avatar.
  - SMART goal slide: call `interpretGoal`, render chip suggestions.
  - Equipment slide: flat colour-coded grid, drop `overflow-y-auto`.
  - ThankYou: rewrite copy, add trainer-self guard, swap Google/email priority.
  - Enter-to-advance from inputs.
- `src/i18n/locales/{pt,en}/intake.json` — add missing keys, rewrite mode + thanks copy.
- `src/lib/equipment-catalog.ts` — verify `category` field per item (used for colour mapping).
- `.lovable/backlog.md` — append the deferred items.

**Out of scope** (explicitly): step tracker, certified badge, deep assessment expansion, client portal write surfaces, plan-production work (next round).

Approve and I'll ship it in one focused pass.