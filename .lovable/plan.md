# Phase B — Founder polish + landing voice + prep clarity

Sequenced by impact / effort. Six items below; #6 is the only one needing your input before I touch it (drawings/illustrations strategy).

---

## 1. Founder recognition (replaces trial nag)

**Where:** `AppShell.tsx` lines 286-308 (the amber/destructive trial banner).

**Logic:** add `isFounder = user?.email === "aafonsodias@gmail.com"` (or whichever email — confirm below). When true:
- Suppress the trial banner entirely.
- Add a small "Founder" chip in the header next to the BrandMark — amber-on-dark badge, subtle crown icon, tooltip "Conta de fundador · acesso vitalício".
- In `dashboard.tsx`, replace the quota line with "Sem limites — bom trabalho, fundador" when `isFounder`.

Also ensure `subscribers.subscribed = true` for that account via a one-line server fn `ensureFounderAccess()` called once on mount, idempotent (only inserts if missing). That way Stripe checks elsewhere also pass cleanly.

**Effort:** ~30 lines, 2 files. Highest impact for you personally.

---

## 2. Day rationale: expanded by default, fully collapsing

**Where:** `SessionDayView.tsx` lines 112-133.

Change:
- `useState(true)` instead of `false` → expanded by default.
- When collapsed, render nothing (currently `line-clamp-2` keeps two lines visible). Toggle button stays above the slot so the user can re-open.
- Toggle copy → "Esconder contexto" / "Mostrar contexto do dia" (i18n).

**Effort:** 5 lines.

---

## 3. Warmup / Activation / Dynamic stretches — colored, packed, collapsible

**Where:** `SessionDayView.tsx` lines 136-143 + the `PrepSection` component below.

Redesign:
- Wrap the three blocks in a single `<details>`-style collapsible card titled "Preparação (8-12 min)" with a small total-duration estimate computed from items.
- Inside, three pill-rows stacked tight (no gap > 6px), each with its own accent:
  - Warmup → amber (`oklch(0.78 0.12 70)`)
  - Activation → emerald (`oklch(0.72 0.13 160)`)
  - Dynamic stretches → sky (`oklch(0.75 0.10 230)`)
- Each row: small colored dot + label + comma-joined items truncated, expand-on-click for the full list with durations.
- Default: collapsed (whole block), since prep is referential, not the main act.

**Effort:** ~80 lines in `SessionDayView.tsx`, no schema changes.

---

## 4. Mobile top bar fix

**Symptom (your screenshot):** at 391px the header overflows — the locale chip + ThemeToggle + Entrar all squeeze the brand.

**Where:** `AppShell.tsx` (logged-in shell) and `routes/index.tsx` header (logged-out, which is what your screenshot shows — currency menu, language, theme, "Entrar", "Começar grátis" all in one row).

Fix on the landing header:
- Below `sm` (≤640px), collapse currency + language + theme into a single overflow menu (three-dot button). Keep only `BrandMark` + "Começar grátis" CTA visible.
- "Entrar" becomes a text link inside the overflow menu.
- Reduce BrandMark from `md` to `sm` below `sm`.

**Effort:** ~40 lines, mostly in `routes/index.tsx`.

---

## 5. Landing voice revamp + "Como funciona" visual upgrade

**Voice change (your direction):** drop "para de escrever planos à meia-noite" and "em 90 segundos". The product is a **coaching workbench**, not a speed gimmick.

**New hero (PT):**
> **Programação de treino baseada em evidência, com a tua assinatura.**
> Forge guarda o contexto do teu aluno, calcula MEV/MAV por grupo muscular, e gera mesociclos editáveis. Imprimes a semana, anotas o que aconteceu no ginásio, e a próxima semana ajusta-se ao feedback real.

**Sub-points (3 chips below hero, replace the speed claim):**
- "Briefing clínico do aluno" — anamnese, lesões, vontades, todas as semanas à mão
- "Programação por evidência" — MEV/MAV/MRV por grupo, progressões justificadas
- "Ciclo papel ↔ app" — imprime, escreve à mão, fotografa, a app lê e ajusta

**"Como funciona" section overhaul (your "muito bland" feedback):** the current 4-box grid becomes a horizontal stepper with:
- Numbered circle (1-4) in amber gradient
- Connecting line between steps (dashed on mobile = vertical)
- Each step: 36px monoline icon (lucide: ClipboardList → Brain → Dumbbell → FileText), title, one-sentence outcome
- A subtle sketch-style background SVG behind each card (curve/scribble) in `accent/8` opacity to break the boxiness

**Effort:** ~120 lines across `routes/index.tsx` + i18n strings. No new dependencies.

---

## 6. Drawings / illustrations strategy — needs your call

You asked what artwork would help without hurting load time. My recommendation:

**Use built-in vector art, not external images.** Three reasons: free, scales to any DPI, ships in the JS bundle (instant load anywhere, including low-bandwidth countries which is your concern in #5 of your message).

**Two libraries to install:**
1. `lucide-react` — already installed, use more of it (we're using ~15 of 1500+ icons)
2. **Inline SVG illustrations I'll author by hand** — 4-6 hero-style line-drawings, ~3kb each, in your amber/cream palette. No external service, no AI generation, no licensing risk.

**The 6 illustrations I'd draw:**
1. Hand holding a clipboard with a dumbbell (hero — "coaching workbench")
2. Stick-figure doing a squat with arrows showing depth (exercise demos placeholder)
3. Calendar grid with one week highlighted (microcycle section)
4. Spider/radar chart shape (MEV/MAV section, ties to upcoming Phase B work)
5. Paper sheet with handwritten checkmarks (print-and-log loop)
6. Plant growing from a barbell (long-term progression — onboarding empty-state)

**For exercise demos (your crossfit/home concern):** instead of waiting on a video library, ship a 3-tier fallback per exercise:
- **Tier 1:** existing YouTube link (`exercise-demo.ts`) when known
- **Tier 2:** inline 80×80 SVG stick-figure pictogram for the movement pattern (squat, hinge, push, pull, carry, lunge, rotate) — covers ~85% of exercises by mapping name → pattern
- **Tier 3:** text cue ("3-second descent, drive through mid-foot") generated once by Lovable AI and cached in DB

This means **zero external image dependencies**, fast on 3G in Lagos or Lisbon, and crossfit/home users get the same UX as gym users. WODs can be added as a `mode: "amrap" | "emom" | "for_time"` field on `day` later — non-breaking.

**My ask:** approve the 6 illustrations + 3-tier exercise fallback approach, OR tell me you want AI-generated PNGs instead (I'd then give you the exact prompts to feed GPT/Nano Banana).

---

## Order of execution if you say "go"

1. Founder recognition (#1) — 5 min, biggest personal impact
2. Day rationale default-expanded (#2) — 1 min
3. Mobile header fix (#4) — 10 min, fixes the screenshot
4. Prep section colors + collapse (#3) — 20 min
5. Landing voice + "Como funciona" stepper (#5) — 30 min
6. **Pause** for your decision on #6 (illustrations) before drawing anything

Backlog file `mem/tasks/backlog.md` will be updated to mark Phase B items 1-5 as done and track #6 + the still-pending #20 add-exercise picker / #23 day-card colours from last turn.

**Reply "go"** to execute 1-5 and ask you about #6, or **"go all"** to commit to the 6-illustration + 3-tier exercise plan now and ship everything.
