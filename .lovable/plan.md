## Round 72 — Aesthetic "loud moments" pass (trainer surfaces)

Goal: ship the 4 queued R7x visual touches (#92–95) on trainer-facing pages, applying the **one loud moment per page** rule. All work is presentation-only (no engine/schema changes).

### Scope (in this order)

**1. Dashboard — "Next action" card (#92, P1)**
- New `<NextActionCard/>` at top of `/dashboard` (above CoachCockpit).
- Source-of-truth pick (deterministic, in this priority):
  1. Client whose plan is `ready` but never opened by trainer this week → "Rever plano de {nome}"
  2. Birthday today/tomorrow → "Felicitar {nome} (anos {dia})"
  3. Red-flag client (assessment risk) → "Falar com {nome} sobre {flag}"
  4. Else: "Convidar primeiro cliente" or "Plano rápido"
- Visual: amber under-glow ring (single loud moment), large display numeral/initial avatar, action verb headline, CTA button.
- i18n keys: `common:dashboard.next_action.*` (PT + EN). ES/HI fallback EN.

**2. Clients list — thin amber left border (#93, P1)**
- In `/dashboard` clients list rows: add `border-l-2 border-amber-500/60` when `isBirthdayThisWeek(client)` OR `hasRedFlag(client)`.
- Helpers exist (`src/lib/birthdays.ts`, red-flag tone in `status-tone.ts`). Pure className change in row component.
- Quiet otherwise — borders only on rows that earn them.

**3. Intake form — numbered section chips (#94, P1)**
- In `/intake/$token`: add a small `01 / N` chip at the top-left of each section card (already split by section).
- Tokens: `text-[10px] uppercase tracking-[0.18em] text-muted-foreground tabular-nums`.
- Increase between-section spacing to `space-y-12` (48px rhythm) on the form column.
- No copy/logic change.

**4. Plan view — 600ms "Pronto" reveal (#95, P1)**
- In `/plans/$planId` view mode: when `status` transitions to `ready` (or initial mount with status=ready), wrap the header status chip + capacity card in a `motion.div` with `initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.6, ease:"easeOut"}}`.
- Single occurrence per session — gate via `useState` on mount; don't re-fire on re-render.
- framer-motion already in deps.

### Out of scope (explicit)
- Sign-out button mobile overlay collision (separate ticket; needs AppShell footer reorder).
- Engine/AI changes. No schema migrations.
- ES/HI native review (parked R62).
- Stripe annual price IDs (R72 originally — punted to keep this round visual-only).

### Files expected to change
- `src/components/dashboard/NextActionCard.tsx` (new)
- `src/routes/dashboard.tsx` (mount + clients-list border)
- `src/routes/intake.$token.tsx` (chips + spacing)
- `src/routes/plans.$planId.tsx` (reveal wrapper)
- `src/i18n/locales/{pt,en}/common.json` (next_action keys)
- `.lovable/backlog.md` (close #92–95)
- `mem/index.md` (no change — rules already locked)

### How to verify
- Visual: 375px Mobile Safari smoke on `/dashboard`, `/intake/$token` (real token), `/plans/$id`.
- i18n: switch PT ↔ EN, no missing keys in console.
- No 3rd parallel "loud" element on any page (audit against `mem/design/aesthetic-direction.md`).

### Where I'll need you
- A real `intake/$token` URL or to OK using a demo client's token for the visual check.
- Confirm priority order of the "Next action" picker (above) — happy to flip birthday above ready-plan-review if you prefer.

### Next round preview (R73)
- Sign-out overlay collision (Lovable preview chrome covers footer button on mobile) — bump bottom nav above safe-area, give MeBottomNav `pb-[env(safe-area-inset-bottom)+72px]` when in iframe.
- Stripe annual price IDs (R62 #2 finish).
- Storyboards 5 short videos (R62 #3) — content task, not code.