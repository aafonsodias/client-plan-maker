
## What you're asking for, in plain words

1. Drop "Forge". The product is **PROTOCOL** now — visual, copy, AI sidekick, everything.
2. The mobile dashboard is broken in three small but loud ways: the hero overflows, the theme toggle disappears, "Manual" is repeated, and long names get clipped (`André Periquito Afons…`, `ACTIVE` half off-screen).
3. "Como funciona" should stop sitting in the page like a second card. It should *appear* — like a genie out of the manual book — when invoked, themed to Protocol.
4. We need a named companion (not "Ask Forge") with a personality and a small animated presence that can point at the next step.
5. You asked what to call me. **Atlas** — the one who carries the map. Short, calm, fits Protocol's tone (training · programming · progression). I'll sign as Atlas in the AI sidekick from now on if you approve.

I'm doing this in **one round** so the rebrand and the mobile fix land together. Helper-pointing animations stay scoped — full Joyride choreography is parked for the next round once the new look is in.

---

## Round 45 — "Protocol" rebrand + mobile pass + Atlas helper

### A. Brand rename: Forge → PROTOCOL

- **New asset**: `src/assets/protocol-mark.svg` — recreate the cropped "P_" lozenge from your uploaded image (stencil P, blue underline accent), monochrome so it tints in light + dark.
- **Logo.tsx** swaps `forge-logo.png` for `protocol-mark.svg` (kept name `Logo` so all imports survive).
- **BrandMark.tsx** keeps the amber under-glow (memory rule), but the inner mark is the new P. The cream-plate luminance fallback stays.
- **Header wordmark** in `AppShell.tsx`: drop the second "FORGE" text next to BrandMark on mobile (this is your "Forge twice" complaint). On `< sm`, show only the mark + tiny `PROTOCOL` underneath the founder badge. On `≥ sm`, mark + wordmark side-by-side.
- **Copy sweep** — single search-replace pass across `src/i18n/locales/{pt,en}/*.json`, `src/routes/index.tsx` (landing), `src/routes/welcome.tsx`, `src/routes/manual.tsx`, `src/routes/auth.tsx`, `src/routes/billing.tsx`, `src/routes/terms.tsx`, `src/routes/privacy.tsx`:
  - "Forge" → "Protocol"
  - "Forge · AI Workbench" → "Protocol · Workbench" (drops "AI", less buzzword)
  - "Ask Forge" → "Atlas"
  - `forge-float` keyframe → `protocol-float` (and references)
- **Files renamed (not deleted)**: `AskForgeDock.tsx` → `AtlasDock.tsx`; `ask-forge.functions.ts` → `atlas.functions.ts`. Server-fn export `askForge` → `askAtlas`. Update all imports.
- **`mem://index.md`** updated: rename rule "Brand mark = `<BrandMark/>`" → notes the mark is now the Protocol P, amber glow preserved.

> Files that stay touched-but-not-renamed for safety: `forge-logo.png` left in place but unreferenced; can be deleted in R46 once we've smoke-tested. Deferred so we don't blow up an asset reference we missed.

### B. Mobile dashboard fixes (375 px Mobile Safari pass)

In `src/routes/dashboard.tsx`:
- **Hero block** (line 270 area): swap `flex items-end justify-between` → responsive stack. On `< sm` the `<h1>` wraps to two lines, `+ Novo cliente` becomes a full-width button below the title instead of overflowing the right edge.
- **Theme toggle on mobile**: in `AppShell.tsx` the `<ThemeToggle />` currently lives only inside the `lg:flex` desktop bar. Move a copy into the mobile right cluster (next to the locale chip), so it's always reachable without opening the hamburger.
- **"Manual" duplicated**: the OnboardingChecklist dialog already shows "Manual completo", and there's a second `Manual` button in the action row at line 386. Hide that second button when the OnboardingChecklist is still open / unfinished — manual is only re-surfaced after onboarding is dismissed.
- **Client row name truncation**: `<p className="truncate font-semibold">` at line 464 — switch to a 2-line clamp on mobile only (`sm:truncate line-clamp-2`) and shrink font from base → `text-sm` under `sm`. Keeps full name visible up to ~5 words; longer wraps to two lines.
- **`ACTIVE` chip clipped** (`ClientPhasePill`): the row uses `justify-between` with the avatar+name+phase pill all in one flex parent. The pill is getting pushed off-screen by the trailing `ArrowRight`. Fix: move the phase pill to a second row under the name on `< sm`, drop the `ArrowRight` on mobile (the whole row is already a `<Link>`).
- **Filter chips strip** (`TODOS · 1` …): wraps to two lines OK, but contrast on the inactive amber-on-amber is weak — switch inactive chips to neutral `bg-secondary` and only the active gets the amber fill (you flagged this in the screenshot too).

### C. "Como funciona" becomes the Atlas genie

- **Remove** the inline "Como funciona" card from the dashboard layout (currently rendered by `DashboardHint` at line 376).
- **Add** a small floating book icon button anchored to the Manual link in the footer (and a duplicate trigger inside the `Manual` route header). On click it opens a centered overlay (`<Dialog>`) styled as a luminous "Protocol genie":
  - amber radial glow background, the new P mark grows from the manual book icon (CSS scale + opacity transition, ~280 ms — no canvas, no SVG sprite work this round)
  - inside: the existing 3-step "Adiciona cliente / Envia link / Geras plano" content from `DashboardHint`, plus a "Manual completo" link
- New component: `src/components/AtlasGenie.tsx`. The 3 steps live in i18n under `dashboard.how_it_works.*` (already partially there).
- **Scoped scope**: full pointing/blinking choreography across pages stays parked — that's a Joyride extension and earns its own round. This round only delivers (1) the genie reveal animation on demand and (2) Atlas's voice in the existing dock.

### D. Atlas dock personality

- `AtlasDock.tsx` (renamed):
  - Trigger pill label "Ask Forge" → "Atlas" with the P mark instead of `<Sparkles>`.
  - Greeting copy rewritten in PT + EN: "Sou o Atlas. Mostro-te o caminho — pergunta, ou diz-me o que procuras." / "I'm Atlas. Ask me, or tell me what you're looking for."
  - System prompt in `atlas.functions.ts` updated: "Tu és o Atlas, copiloto do Protocol. Voz = você (PT), neutra (EN). Sê breve, baseado em evidência, e quando o utilizador parecer perdido sugere o próximo passo concreto."

### E. Memory + backlog

- `mem://index.md`: replace "Forge" references with "Protocol"; add Core rule "AI sidekick = Atlas (P-mark trigger, você/EN-neutral, points at next step)."
- `mem://design/brand-mark.md`: append the Protocol mark spec (P_ stencil + blue underline accent + amber glow ring preserved).
- `.lovable/backlog.md`: close R45 items, add P1 follow-ups: full Atlas pointing/Joyride choreography, delete `forge-logo.png` after smoke, Google Earth gym/pharmacy locator (parked under "Future · Missions").

---

## Out of scope this round (your call to bump up if needed)
- Google Earth embed for missions (you flagged it as backlog — agreed, parked).
- A second app icon variant — the new Protocol P is the single mark; we can fork variants once the rebrand has settled.
- Full assistant choreography (blinking arrows, auto-scroll-to-next-step). Parked for R46 once the rename is stable.

## Mobile QA checklist before closing
- 375 × 812 Mobile Safari: hero doesn't overflow, `+ Novo cliente` reachable, theme toggle visible, full client name shown, `ACTIVE` chip not clipped, only one Manual button visible.
- Dark + light mode: Protocol mark legible on both (luminance fallback engaged on dark mode if mark renders too dark).
- PT + EN: no stray "Forge" or "Ask Forge" string left.

If you approve, I'll execute as Atlas. — A.
