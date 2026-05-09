## Round A — Quick fixes (mobile chrome)

**1. Sign-out hidden behind Lovable preview overlay**

The mobile sheet (`src/components/AppShell.tsx`, lines 213–276) renders nav → language section → sign-out at the very bottom. On a real phone the Lovable preview toolbar sits over the bottom ~80px and eats the sign-out button. Two changes:

- Move the **sign-out row to the top of the sheet** (right under the brand header), styled as a clear destructive-tinted row. Most-used escape action, always reachable.
- Make the sheet body **scrollable** (`overflow-y-auto`) with `pb-[env(safe-area-inset-bottom)]` + extra `pb-24` so even at the bottom the last item clears the iOS home indicator and any preview chrome.
- Mirror the same reorder logic in the desktop avatar dropdown only if needed (it's fine — dropdown opens upward when near viewport edge).

**2. Language menu shows "Inglês" four times**

`AppShell.tsx` has three ternaries `code === "pt" ? portuguese : english` (lines 195, 258, 355) — so `es` and `hi` fall through to "english". `LanguageSwitcher.tsx` already does it right. Replace each ternary with a small `localeLabel(code, t)` helper that maps:
- `pt` → `language.portuguese` ("Português")
- `es` → `language.spanish` ("Español")
- `hi` → `language.hindi` ("हिन्दी")
- `en` → `language.english` ("English")

Add the missing `language.spanish` / `language.hindi` keys to `en/common.json` and `pt/common.json` (es/hi files already have native names; if missing, add them too — purely cosmetic, not full translation work, so it's safe to do now and doesn't bloat the i18n debt).

No other locale strings are touched. Per your direction, full translations stay parked until post-MVP.

---

## Round B — `/me` Round 2 (Progresso + Mensagens + Histórico)

Three sub-routes, all in the same `MeShell`. Server fns extend `src/server/me.functions.ts`; UI pieces under `src/components/me/`.

### B1 — `/me/progresso` (real)

Replace the stub with four cards:

- **Streak strip** — last 14 days of `client_checkins` + completed `workout_sessions` as a heat row (emerald = both, amber = one, muted = none).
- **Capacity gain** — reuse `computeCapacityGain` (`src/lib/capacity-gain.ts`) on the last two blocks of the active plan. Render `<CapacityGainCard/>` if it exists, otherwise a slim fallback (Δ% load + e1RM per pattern).
- **Top lifts** — top 5 working sets by e1RM across all logged sessions for the current plan. Computed server-side in a new `loadProgress` server fn.
- **Weight trend** — `recharts` line chart over `client_measurements.weight_kg` for the last 90 days, with smoothed tooltip. Empty state if no entries.
- **Progress photos** — grid pulled from the `client-photos` storage bucket under `progress/{clientId}/...` via signed URLs (60-min TTL). Read-only in client mode; upload entry deferred to a later round (not on critical path).

### B2 — Trainer messages (realtime, on `/me`)

Promote `TrainerMessageCard` to a full thread:

- New server fns in `me.functions.ts`: `loadMessages({ before? })` (paginated, 20 per page), `markMessagesRead()` (sets `plan_feedback.status='resolved'` on trainer messages once viewed). `sendClientMessage` already exists.
- Component `MessageThread.tsx`: reverse-chronological, infinite scroll up, optimistic send. Subscribes to `postgres_changes` on `plan_feedback` filtered by `client_id=eq.{id}` so trainer replies appear within ~1s. Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_feedback;` if not already.
- Bottom-nav `nav.today` keeps an unread chip when `unreadCount > 0`.
- Preview mode (`?as=`): thread visible read-only, send box disabled with the existing "preview disabled" hint.

### B3 — `/me/historico` (real)

Replace the stub with a paginated list:

- New server fn `loadHistory({ cursor? })` returning 20 sessions ordered by `session_date desc`, joined with `workout_plan_days` for the prescribed reference.
- Component `SessionHistoryRow.tsx`: date, focus, exercise count, RPE avg, expand → per-exercise rows with prescribed vs actual diff (`+5kg`, `-1 rep`, `RPE 8 → 8.5`) using emerald/amber/red tone tokens from `status-tone.ts`.
- "Load more" cursor button at the bottom.

### Smoke checklist

- 375×812 mobile Safari for `/me`, `/me/progresso`, `/me/historico` — every CTA reachable, no overlap with Lovable bottom chrome.
- Sign out reachable from the mobile sheet within first viewport.
- Language menu shows 4 distinct names.
- Realtime: open trainer view in another tab, send a `plan_feedback` row, confirm it appears in `<2s` on `/me`.
- Preview mode (`?as={clientId}`): all writes (checkin, send message) disabled.

### Files

**Edited:** `src/components/AppShell.tsx`, `src/i18n/locales/en/common.json`, `src/i18n/locales/pt/common.json`, `src/server/me.functions.ts`, `src/routes/me.tsx`, `src/routes/me.progresso.tsx`, `src/routes/me.historico.tsx`, `src/components/me/MeBottomNav.tsx`.

**New:** `src/components/me/MessageThread.tsx`, `src/components/me/StreakStrip.tsx`, `src/components/me/WeightTrendChart.tsx`, `src/components/me/TopLiftsTable.tsx`, `src/components/me/ProgressPhotoGrid.tsx`, `src/components/me/SessionHistoryRow.tsx`.

**Migration:** add `plan_feedback` to realtime publication (idempotent guard).

### Order of execution

1. Round A (15 min, ships first as a clean commit — unblocks your testing on phone).
2. B2 messages (highest user value, leverages existing `plan_feedback`).
3. B3 histórico.
4. B1 progresso (most data-heavy, last so the prior surfaces are stable).
