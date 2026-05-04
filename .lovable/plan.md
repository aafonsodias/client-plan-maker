## Round 31 — Brand polish, intake intelligence, inline microcycle

Ordered by **visual impact ÷ effort**. Each section ships independently.

---

### 1. Brand mark + AI Workbench rename (P0, ~10 min)

- `BrandMark` (header anvil): center the spark/glow inside its ring — currently the symbol sits ~2px left of the ring center. Adjust SVG `viewBox` / `translate` so the spark + handle visually center, not geometrically.
- `dashboard.tsx` greeting: rename "Your AI Workbench" → **"Forge · AI Workbench"** with a small `BrandMark size="sm"` glyph to the left of the wordmark, replacing the generic hammer-and-pick emoji icon. Keeps craft tone, no royal vibe.
- i18n: update `dashboard.welcome.workshop_title` in PT + EN.

### 2. Persistent session on refresh (P0, ~15 min)

Symptom: refresh on `/clients/$id` flashes landing as if logged-out, then redirects.

Cause: `__root` checks `supabase.auth.getSession()` synchronously on first render — before the persisted token rehydrates.

Fix: gate the redirect with a `useState(loading=true)` until `supabase.auth.getSession()` resolves; render a neutral splash (logo + spinner on `bg-background`) instead of the marketing landing during the auth-rehydration window. Same fix used in `AppShell`'s auth guard.

### 3. Intake link panel — smart visibility + working "opened" state (P0, ~30 min)

`IntakeLinkPanel` on `clients_.$clientId.tsx`:

- **Hide by default** when `clients.intake_completed_at IS NOT NULL`. Replace with a tiny one-line chip: "Intake recebido · 04/05 · Pedir nova avaliação" → click expands the panel to generate a fresh link (existing behavior, just moved behind an action).
- **Realtime "opened" state**: subscribe to `client_intake_links` row via `postgres_changes` filter `id=eq.{linkId}` and update `opened_at` live. Currently it only refetches on mount.
- When `opened_at` is set, auto-collapse the panel into a green "Aberto · há Xm" chip.
- Copy: rename section from "Client intake link" → **"Pedir nova avaliação"** (PT) / "Request new assessment" (EN) — the current label implies it's required.

### 4. Documents — distinct medical icon, corner placement (P1, ~25 min)

`ClientDocuments.tsx` is currently a wide card stealing top-of-page real estate.

- Collapse to a **single icon button** in the top-right action row (next to "Carregar/Download PDF/Ver como cliente"): outlined cross/stethoscope SVG (custom — not a generic Lucide icon), color `--clinical: oklch(0.78 0.10 200)` (cool teal, distinct from amber/emerald), with a count badge if docs exist.
- Click → opens a `Sheet` (right-side drawer) with the upload + list. Same logic, new shell.
- Add `tone-clinical` to `src/lib/status-tone.ts` for reuse on other medical signals (red flags, exams).

### 5. Brief approval honesty (P0, ~10 min)

Bug: "Avaliação completa" green chip appears after Stage 1 approval even when intake coverage is 43%.

Fix: in `clients_.$clientId.tsx` line 2105, change condition from `inlineBrief?.approved` to `inlineBrief?.approved && (assessmentCoverage ?? 0) >= 0.8`. Below 80%, keep the dashboard expanded with an amber "Avaliação parcial · 43%" chip so the trainer knows what they signed off on. (Approval still works; honesty stays.)

### 6. Microcycle inlined into client page + progress visibility (P0, ~2 h)

This is the biggest piece — split into 6a (inlining) and 6b (engine speed/visibility).

**6a — Inline (no new window):**
- Delete the `/plans/$planId/microcycle` redirect-to-page pattern. Move `MicrocycleReview` body into a new `<MicrocyclePanel planId>` component.
- Render it as Stage 3's `expandedBody` in `clients_.$clientId.tsx` (where StageCard "microcycle" lives). Auto-expands when blueprint is approved.
- Keep `/plans/$planId/microcycle` as a thin route that just renders `<MicrocyclePanel/>` for back-compat (deep links from notifications/old tabs).
- Stage 3 card golden+collapses on full-week approval → Stage 4 (Progressions) auto-expands → same pattern for Stage 5 (PDF). The whole flow now lives on `/clients/$id`.

**6b — Engine speed + progress feedback:**
- `generateMicrocycleDays` currently spins with no visible progress because the server function awaits all N day generations sequentially before returning.
- Switch to **fire-and-forget**: server inserts N `pending` rows immediately, then `Promise.all` writes results as they finish. Client already subscribes via `postgres_changes` on `workout_plan_days` (line 111), so each day pops in live as it lands.
- Add per-day skeleton card (5 grey day-cards visible immediately) → each turns amber as it generates → emerald as it finishes. Visible progress = no perceived crash.
- Use `gemini-2.5-flash` (not -pro) for day-gen with strict JSON mode; model is already chosen — verify in `stage3-microcycle.functions.ts`. If on -pro, downgrade to -flash for ~3× speed.
- Add a 90s server-side soft-timeout per day with one retry; show a red "Day N falhou — Tentar de novo" inline button instead of silent stall.

### 7. Backlog + memory (P2, ~5 min)

- Append Round 31 entries to `.lovable/backlog.md`.
- Save `mem://principles/intake-recurrence.md`: "Intake = on-demand re-assessment, not one-shot. Hide once filled; surface as 'Pedir nova avaliação' when trainer needs fresh data. Continuous data (sleep, HR, wearables) flows via client dashboard, not intake."

---

### Out of scope this round

- Wearables sync (Apple Health / Garmin / Whoop integrations) — needs its own architecture round
- Drag-to-reorder microcycle exercises across days — Round 32
- Per-day approve UX redesign (currently approve cascades) — keep current logic, only the visual stage container changes

### Files touched

`src/components/BrandMark.tsx`, `src/routes/dashboard.tsx`, `src/i18n/locales/{pt,en}/common.json`, `src/routes/__root.tsx`, `src/components/IntakeLinkPanel.tsx`, `src/components/ClientDocuments.tsx`, `src/lib/status-tone.ts`, `src/routes/clients_.$clientId.tsx`, `src/components/MicrocyclePanel.tsx` (new from extracted route), `src/routes/plans.$planId.microcycle.tsx`, `src/server/phased/stage3-microcycle.functions.ts`, `.lovable/backlog.md`, `mem/principles/intake-recurrence.md`, `mem/index.md`.
