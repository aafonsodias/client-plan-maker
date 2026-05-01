# FORGE — i18n & Consistency Audit

Date: 2026-05-01
Reviewer: Senior frontend (read-only)
Scope scanned: `src/routes/**`, `src/components/**`, `src/lib/**`. `src/features/**` does **not exist** in the repo.

---

## 1. Summary

- **Files scanned:** 29 source files (13 routes, 11 components, 5 libs). ~8.9k LOC.
- **Hardcoded user-facing strings found:** 200+ across the surface (sample of 50+ catalogued in §2; remainder noted as "+N more").
- **Pages without language switcher:** 12 of 13 top-level routes. Only `AppShell`-wrapped logged-in pages render `<LanguageSwitcher />`, and the switcher itself only persists the choice — **no translation runtime (i18next, lingui, react-intl) is wired**, so all copy is effectively hardcoded regardless.
- **Top 3 ship risks:**
  1. **Mixed PT/EN inside `billing.tsx`** ("Bem-vindo ao Forge!", "A tua subscrição", "Voltar ao dashboard") next to fully-EN routes (`auth`, `clients`, `plans`) — looks broken to either audience.
  2. **No i18n runtime** — `LanguageSwitcher` writes `localStorage.forge.lang` and `<html lang>` but nothing consumes the value. Selecting another language has zero visible effect.
  3. **Italic + uppercase anti-patterns are pervasive** on cue text and section headers (FORGE §14 violations) — inconsistent voice across Plan View, LOG, and PDF surfaces.

---

## 2. I18N Gap Table

Status legend: **EN** = English-only hardcoded · **PT** = Portuguese-only hardcoded · **MIX** = both languages on same page/string · **HC** = brand/technical, no language axis.

| File | Line | Hardcoded string | Suggested key | Status |
|---|---|---|---|---|
| src/routes/auth.tsx | 49 | "Check your email to confirm your account." | auth.signup.toast.confirmEmail | EN |
| src/routes/auth.tsx | 70 | "Sign in" / "Create account" (TabsTrigger) | auth.tabs.signin / signup | EN |
| src/routes/auth.tsx | 75,89 | "Email" / "Password" labels | auth.field.email / password | EN |
| src/routes/auth.tsx | 93 | "At least 10 characters. Avoid common or breached passwords." | auth.signup.passwordHint | EN |
| src/routes/auth.tsx | 109 | "or" divider | common.divider.or | EN |
| src/routes/auth.tsx | 114 | "Continue with Google" | auth.cta.google | EN |
| src/routes/billing.tsx | 146 | "Bem-vindo ao Forge!" | billing.toast.welcome | PT |
| src/routes/billing.tsx | 149 | "Pack premium adicionado." | billing.toast.topupAdded | PT |
| src/routes/billing.tsx | 154 | "Falha ao carregar billing" | billing.toast.loadFail | PT |
| src/routes/billing.tsx | 169 | "Checkout falhou" | billing.toast.checkoutFail | PT |
| src/routes/billing.tsx | 180 | "Portal falhou" | billing.toast.portalFail | PT |
| src/routes/billing.tsx | 191 | "Top-up falhou" | billing.toast.topupFail | PT |
| src/routes/billing.tsx | 202 | "Estado actualizado" | billing.toast.refreshed | PT |
| src/routes/billing.tsx | 211 | "17% off · 2 meses grátis" | billing.yearly.savings | MIX (EN+PT in one string) |
| src/routes/billing.tsx | 214 | "Voltar ao dashboard" | nav.back.dashboard | PT |
| src/routes/billing.tsx | 217 | "Billing" eyebrow | billing.eyebrow | EN |
| src/routes/billing.tsx | 218 | "A tua subscrição" | billing.title | PT |
| src/routes/billing.tsx | 226 | "A carregar…" | common.loading | PT |
| src/routes/billing.tsx | 233 | "Forge {tier} — activo" | billing.status.active | PT |
| src/routes/billing.tsx | 239 | "Renova a {date}" | billing.status.renews | PT |
| src/routes/billing.tsx | 246 | "Trial — {n} dia(s) restante(s)" | billing.trial.daysLeft | PT |
| src/routes/billing.tsx | 250 | "Subscreve para continuar a gerar planos sem interrupções." | billing.trial.cta | PT |
| src/routes/billing.tsx | 255 | "Trial terminada — geração de planos pausada" | billing.trial.expired | PT |
| src/routes/billing.tsx | 313 | "Mais popular" | billing.tier.popular | PT |
| src/routes/billing.tsx | 322,329 | "/ano", "/mês" suffixes | billing.price.suffix.year/month | PT |
| src/routes/clients.tsx | 90 | "Client added" | clients.toast.added | EN |
| src/routes/clients.tsx | 101 | "Client removed" | clients.toast.removed | EN |
| src/routes/clients.tsx | 108 | "Roster" eyebrow | clients.eyebrow | EN |
| src/routes/clients.tsx | 183 | aria-label "Delete client" | clients.aria.delete | EN |
| src/routes/clients_.$clientId.tsx | 725 | "Subscription required" | client.toast.subRequired | EN |
| src/routes/clients_.$clientId.tsx | 730 | "{n} day(s) failed. Tap 'Continue' to retry the missing ones." | plan.gen.toast.partialFail | EN |
| src/routes/clients_.$clientId.tsx | 763 | "Draft generated" | plan.toast.draftGenerated | EN |
| src/routes/clients_.$clientId.tsx | 775 | "Failed to generate plan" | plan.toast.generateFail | EN |
| src/routes/clients_.$clientId.tsx | 819 | "Previous draft discarded." | plan.toast.draftDiscarded | EN |
| src/routes/clients_.$clientId.tsx | 1042 | placeholder "e.g. Squat 1.5×BW for 5 reps" | assess.smart.specific.ph | EN |
| src/routes/clients_.$clientId.tsx | 1043 | placeholder "e.g. 120kg @ BW80kg" | assess.smart.measurable.ph | EN |
| src/routes/clients_.$clientId.tsx | 1115 | placeholder "desk, manual, mixed…" | assess.jobType.ph | EN |
| src/routes/clients_.$clientId.tsx | 1190 | placeholder "PPL, 5/3/1…" | assess.prevProgram.ph | EN |
| src/routes/clients_.$clientId.tsx | 1425,1456 | aria-label "Why we ask" | common.aria.whyWeAsk | EN |
| src/routes/clients_.$clientId.tsx | 1581 | placeholder "Optional note" | common.ph.optionalNote | EN |
| src/routes/dashboard.tsx | 65 | "Welcome back" eyebrow | dashboard.eyebrow | EN |
| src/routes/index.tsx | 61-63 | hero subtitle "Run a structured intake…" | landing.hero.subtitle | EN |
| src/routes/index.tsx | 79 | "Built on PAR-Q+, ACSM risk stratification…" | landing.hero.caption | EN |
| src/routes/index.tsx | 89 | "How it works" eyebrow | landing.howItWorks.eyebrow | EN |
| src/routes/index.tsx | 91 | "From intake to PDF in four moves." | landing.howItWorks.title | EN |
| src/routes/index.tsx | 164 | alt "André, founder of Forge" | landing.alt.founder | EN |
| src/routes/index.tsx | 427-470 | "Back Squat · Set log", "Today · Week 6", "Back Squat — 6 weeks of work" | landing.mock.* | EN |
| src/routes/intake.$token.tsx | 266 | "Could not submit. Try again." | intake.toast.submitFail | EN |
| src/routes/intake.$token.tsx | 273 | "Saved. Come back anytime." | intake.toast.saved | EN |
| src/routes/intake.$token.tsx | 292 | "Intake form" eyebrow | intake.eyebrow | EN |
| src/routes/intake.$token.tsx | 343 | placeholder "e.g. blood pressure meds, insulin, painkillers…" | intake.meds.ph | EN |
| src/routes/intake.$token.tsx | 370 | placeholder "e.g. lose 5kg, run a 10k, get stronger…" | intake.smart.ph | EN |
| src/routes/intake.$token.tsx | 512 | footer microcopy (uppercase tracking) | intake.footer | EN |
| src/routes/log.$token.tsx | 88 | toast.error(e.message) — raw backend message | log.toast.saveFail | EN/HC |
| src/routes/log.$token.tsx | 94 | "Workout log" fallback | log.title.fallback | EN |
| src/routes/log.$token.tsx | 101,107,113 | "Week" / "Day" / "Date" labels | log.field.week/day/date | EN |
| src/routes/log.$token.tsx | 141,143 | placeholder "e.g. 80kg" / "Notes…" | log.field.weight.ph / notes.ph | EN |
| src/routes/log.$token.tsx | 149 | "How did it feel?" | log.field.feel | EN |
| src/routes/plans.$planId.tsx | 107 | "Plan finalized" / "Plan unlocked — back to draft" | plan.toast.finalize / unlock | EN |
| src/routes/plans.$planId.tsx | 109 | "Plan saved" | plan.toast.saved | EN |
| src/routes/plans.$planId.tsx | 210 | "Plan deleted" | plan.toast.deleted | EN |
| src/routes/plans.$planId.tsx | 252 | "No summary yet." | plan.summary.empty | EN |
| src/routes/plans.$planId.tsx | 369 | placeholder "Focus (e.g. Hypertrophy block)" | plan.week.focus.ph | EN |
| src/routes/plans.$planId.tsx | 378 | placeholder "Why this block now? (e.g. accumulation phase…)" | plan.week.rationale.ph | EN |
| src/routes/plans.$planId.tsx | 489 | "Mark cleared" | plan.toast.markCleared | EN |
| src/routes/plans.$planId.tsx | 591-620 | section titles "Warmup" / "Activation" / "Dynamic stretches" / "Cooldown" + "e.g." placeholders | plan.day.section.* | EN |
| src/routes/plans.$planId.tsx | 595 | "Main work" header | plan.day.mainWork | EN |
| src/routes/plans.$planId.tsx | 609 | "Optional finisher" | plan.day.finisher | EN |
| src/routes/plans.$planId.tsx | 686 | placeholder "e.g. Barbell back squat" | plan.ex.name.ph | EN |
| src/routes/plans.$planId.tsx | 722 | placeholder "Brace and exhale on press; pause 1s at peak stretch" | plan.ex.cue.ph | EN |
| src/routes/plans.$planId.tsx | 732 | placeholder "Notes — programming or substitutions" | plan.ex.notes.ph | EN |
| src/routes/plans.$planId.tsx | 791 | "Link rotated" / "Share link ready" | plan.toast.shareLink | EN |
| src/routes/plans.$planId.tsx | 805 | "Link copied" | plan.toast.linkCopied | EN |
| src/routes/plans.$planId.tsx | 954 | "Session logged · view history" | plan.toast.sessionLogged | EN |
| src/routes/plans.$planId.tsx | 1163 | "Write what you want changed." | plan.regen.toast.empty | EN |
| src/routes/plans.$planId.tsx | 1237 | "Plan regenerated with your feedback" | plan.regen.toast.ok | EN |
| src/routes/plans.$planId.tsx | 1270 | long EN regen-instruction placeholder | plan.regen.input.ph | EN |
| src/routes/plans.index.tsx | 57 | "Plan deleted" (duplicate of plan route) | plan.toast.deleted | EN |
| src/routes/plans.index.tsx | 134 | aria-label "Delete plan" | plans.aria.delete | EN |
| src/routes/settings.tsx | 55 | "Saved" | settings.toast.saved | EN |
| src/routes/settings.tsx | 67 | "Logo uploaded — don't forget to save" | settings.toast.logoUploaded | EN |
| src/components/ComplianceDashboard.tsx | 259,279,324 | section labels (uppercase tracking) | compliance.section.* | EN |
| src/components/IntakeLinkPanel.tsx | 60,70,88 | toasts: "Intake link ready" / "Link copied" / "Intake marked reviewed" | intake.panel.toast.* | EN |
| src/components/IntakeLinkPanel.tsx | 121,139 | "Client intake link" eyebrow (duplicated) | intake.panel.eyebrow | EN |
| src/components/LanguageSwitcher.tsx | 165 | placeholder "Search language…" | lang.search.ph | EN |
| src/components/Logo.tsx | 4 | alt "Forge logo" | brand.logo.alt | HC |
| src/components/SessionDayView.tsx | 100,116,166-186 | week subtitle, focus pill, prep section labels, cooldown italic notes | session.day.* | EN |
| src/components/ValidationReport.tsx | 108-111 | "{n} pass" / "{n} repaired" / "{n} failed" / "{n} critic skipped" | validation.badge.* | EN |

`+ ~120 more` strings (mostly micro-copy in `clients_.$clientId.tsx` 1.7k LOC and `plans.$planId.tsx` 1.3k LOC) detected in raw scan but not enumerated to keep this table readable.

---

## 3. Language Switcher Coverage

| Route | Switcher status |
|---|---|
| `/` (index.tsx) | **missing** — landing has its own header, no `<LanguageSwitcher />` |
| `/auth` | **n/a (auth)** — but Google CTA & form labels stay EN regardless |
| `/dashboard` | present (via AppShell) |
| `/clients` | present (via AppShell) |
| `/clients/$clientId` | present (via AppShell) |
| `/plans` (plans.index) | present (via AppShell) |
| `/plans/$planId` | present (via AppShell) |
| `/plans/$planId/sessions` | present (via AppShell) |
| `/billing` | present (via AppShell) — yet copy is hardcoded PT |
| `/settings` | present (via AppShell) |
| `/intake/$token` | **missing** — public client-facing page, no switcher |
| `/log/$token` | **missing** — public client-facing page, no switcher |
| `/__root` | n/a (shell) |

**Overall:** 12 of 13 routes lack a real i18n binding. `LanguageSwitcher` updates `localStorage` + `<html lang>` but no translation table consumes it (grep for `t(`, `useTranslation`, `i18next` returns 0 matches in `src/`). The switcher is decorative.

---

## 4. Component Vocabulary Drift

Grouped by semantic role:

- **Status / metadata pill**
  - `<Badge variant="outline">` — `ValidationReport.tsx:108-111`, `intake.$token.tsx`
  - `<ClientPhasePill>` — `clients.tsx:175`, `clients_.$clientId.tsx:1745`
  - Inline `<span className="rounded-full bg-secondary px-3 py-1 text-xs … uppercase">` ad-hoc pills — `clients_.$clientId.tsx:1351,988,1434,1720`, `dashboard.tsx:126`, `plans.$planId.tsx:179,368,981`, `plans.$planId.sessions.tsx:198`, `SessionDayView.tsx:178,261,355,400,413`
  - **Drift:** at least **3 different APIs** (`Badge`, `ClientPhasePill`, raw span) and **4 visual recipes** (rounded-full vs rounded-md, accent vs secondary background, with/without uppercase tracking) for what is conceptually the same component.
- **Surface / container**
  - shadcn `<Card>` — used in `dashboard.tsx`, `settings.tsx`
  - Raw `<div className="rounded-lg border border-border bg-card …">` — `billing.tsx:222,308`, `plans.$planId.tsx` repeatedly
  - **Drift:** Card primitive bypassed in newer routes (`billing.tsx`, plan editor).
- **Section eyebrow / overline**
  - 18+ instances of `text-xs uppercase tracking-widest text-muted-foreground` (`clients.tsx:108`, `dashboard.tsx:65`, `index.tsx:374`, `intake.$token.tsx:292`, `log.$token.tsx:94`, etc.). No shared `<Eyebrow>` / `<Overline>` component.
- **Field with label + hint**
  - Local `Field` component re-implemented in `clients_.$clientId.tsx:1471` and `plans.$planId.tsx`
  - shadcn `<FormItem>/<FormLabel>/<FormDescription>` available (see `src/components/ui/form.tsx`) but **never imported** in any route.
  - **Drift:** form composition reinvented per file.
- **Empty / placeholder state**
  - `<span className="text-muted-foreground italic">No summary yet.</span>` (`plans.$planId.tsx:252`)
  - `<span className="text-xs text-muted-foreground">No logo</span>` (`settings.tsx:108`)
  - No `<EmptyState>` primitive.
- **Loading indicator**
  - `Loader2` + custom text in `billing.tsx:226` ("A carregar…"), implicit in `clients.tsx`
  - No shared `<Spinner>` / `<Loading label>` wrapper.
- **Back link**
  - `AppShell back={{...}}` prop (`billing.tsx:214`)
  - Manual `<Link to="/dashboard">` chevron in `clients_.$clientId.tsx`
  - Vocabulary mixed: "Voltar ao dashboard" (PT) vs "Back" elsewhere.

---

## 5. FORGE Design System Violations

Reference tokens shipped in `src/styles.css` lines 67-95 and 154-167: `bg-canvas`, `bg-surface`, `text-ink-primary/secondary/tertiary/quiet`, `text-forge-accent`, `border-line`, `font-display`, `font-mono`, `text-cue`, `text-day`, `text-exer`.

### 5.1 Inline hex / rgb (bypassing forge-* tokens)
| File | Line | Value |
|---|---|---|
| src/routes/index.tsx | 166 | `boxShadow: "0 0 24px rgba(212, 175, 89, 0.08)"` — should derive from `--forge-accent-soft` |
| src/components/SessionDayView.tsx | 35 | `"#7AB8E8"` — chart color literal |
| src/components/SessionDayView.tsx | 36 | `"#C28FE8"` — chart color literal |

### 5.2 Font-family bypass
- No explicit `font-family: …` overrides found (✅).
- However, **`font-display` / `font-mono` utilities are never used** in routes/components — every heading falls back to default sans (`Inter` only). FORGE §2 expects "Inter Tight" for display surfaces and "JetBrains Mono" for stat readouts; this is a silent miss across `plans.$planId.tsx`, `dashboard.tsx`, `clients.tsx`.

### 5.3 shadcn token used where forge-* exists
Heavy use of `text-muted-foreground`, `bg-card`, `bg-secondary`, `text-accent`, `border-border` instead of `text-ink-secondary`, `bg-surface`, `bg-subtle`, `text-forge-accent`, `border-line`.
- `clients_.$clientId.tsx`: 60+ occurrences of `text-muted-foreground`
- `plans.$planId.tsx`: 80+ occurrences of `text-muted-foreground` / `bg-secondary` / `text-accent`
- `billing.tsx`: 20+ occurrences
- `dashboard.tsx`, `clients.tsx`, `index.tsx`: same pattern
- Only `LanguageSwitcher.tsx` consistently uses `text-ink-primary` / `text-ink-secondary` / `bg-surface` (lines 134, 161, 188, 195).

### 5.4 Italic on cue text (FORGE §14 anti-pattern)
| File | Line |
|---|---|
| src/routes/index.tsx | 79, 205, 399 |
| src/routes/plans.$planId.tsx | 252, 379, 427, 587, 721, 1039 |
| src/components/SessionDayView.tsx | 100, 116, 169 (`italic` prop), 186, 249, 361, 447 |

Cue / technique-cue text is consistently rendered italic — explicit anti-pattern.

### 5.5 All-caps on multi-word labels (FORGE §14 anti-pattern)
The "uppercase tracking-widest" recipe is acceptable on ≤2-word metadata chips but leaks onto:
| File | Line | Context |
|---|---|---|
| src/routes/clients_.$clientId.tsx | 1351 | `{p.status}` — plan status pill text uppercased |
| src/routes/plans.$planId.tsx | 595, 609, 643 | "Main work", "Optional finisher", section titles uppercased — these are **content section headers**, not metadata pills |
| src/components/SessionDayView.tsx | 209, 221, 379, 387 | day labels, set descriptors, "Tempo {ex.tempo}" — encroaches on stat/exercise area |
| src/routes/log.$token.tsx | 101,107,113,149,163 | client-facing field labels are all uppercase tracking-widest — heavy on a public surface |

---

## 6. Accessibility Quick Checks

### Missing / non-descriptive alt
| File | Line | Finding |
|---|---|---|
| src/routes/intake.$token.tsx | 284 | `<img src={ctx.trainer.logo_url} alt="" />` — trainer logo is meaningful → should be `alt={ctx.trainer.business_name}` |
| src/components/OnboardingChecklist.tsx | 65 | `<img src={waveHand} alt="" />` — decorative, `alt=""` acceptable (✅) |
| src/routes/plans.$planId.tsx | 218 | `<img alt="Logo" />` — non-descriptive |
| src/routes/settings.tsx | 108 | `<img alt="Logo" />` — non-descriptive |

### Icon-only buttons missing aria-label
- ✅ Has aria-label: `clients.tsx:183`, `plans.index.tsx:134`, `plans.$planId.tsx:1079`, `clients_.$clientId.tsx:1425,1456,1571`
- **Missing:**
  - `src/components/SessionDayView.tsx:126` — chevron toggle button (no label)
  - `src/components/SessionDayView.tsx:436` — collapsible toggle (only uppercase text, no `aria-expanded`)
  - `src/routes/plans.$planId.tsx:1006` — `<button>` with chevron icon, no aria-label

### Form fields without `<label>` association
- `clients_.$clientId.tsx:974,1006,1077,1164` — `<Select>` triggers with `placeholder="Select…"` and no `<Label htmlFor>` or `<FormLabel>` wrapper. Visual labels exist as sibling `<div>` text, not programmatically tied.
- `log.$token.tsx:141,143` — `<Input placeholder="e.g. 80kg" />`, `<AutoTextarea placeholder="Notes…" />` — visual `<Stack label>` is a div, not `<label htmlFor>`.
- `plans.$planId.tsx:686-715` — large grid of bare `<Input placeholder=…>` fields (sets, reps, rest, tempo, RPE, muscles) with no labels for screen readers; column headers are visual only.

### Color-only state indicators
- `billing.tsx:245,255` — trial-active variant uses `text-amber-600` only, expired uses `text-destructive` only; no icon to differentiate for color-blind users.
- `clients_.$clientId.tsx:988` — risk pill swaps background color only by `riskCategory`; no icon distinguishes high vs moderate vs low.
- `ValidationReport.tsx:108-111` — pass/repaired/failed/skipped use identical `<Badge variant="outline">`; differentiation is text-only and small.
- `SessionDayView.tsx:347-413` — set status chips ("Done"/"Partial"/"Missed") rely on bg color tint with no shape/icon.

---

## 7. Prioritised Fix Backlog (top 50)

### BLOCKERS — ship-stoppers
1. **Mixed PT/EN in `billing.tsx`** (lines 146-256, 313-330). Either commit to one language or wire i18n before exposing to non-Portuguese trainers.
2. **No translation runtime**. `LanguageSwitcher` is decorative; users selecting EN/ES/FR/DE/IT see zero change. Either remove the switcher or wire a real i18n library.
3. **Public client-facing pages have no language switcher** (`intake.$token.tsx`, `log.$token.tsx`). Trainers' clients may speak any language; current copy is EN-only with no escape.
4. **Form fields without programmatic labels** in `plans.$planId.tsx:686-715` and `clients_.$clientId.tsx:974+` — screen-reader users cannot identify columns.
5. **Non-descriptive `alt="Logo"`** in `plans.$planId.tsx:218` and `settings.tsx:108`, plus **meaningful logo with `alt=""`** in `intake.$token.tsx:284`.

### HIGH
6. Italic cues across Plan View / SessionDayView (8+ sites) — FORGE §14 anti-pattern.
7. All-caps on multi-word section headers in `plans.$planId.tsx:595,609,643` and `log.$token.tsx:101-149`.
8. Status pills implemented 4 different ways (Badge, ClientPhasePill, raw span, accent-bg span). Consolidate into a single `<Pill variant>` primitive.
9. shadcn `text-muted-foreground` / `bg-card` / `text-accent` blanket-used instead of `text-ink-*`, `bg-surface`, `text-forge-accent`. Pages don't match the FORGE token system the design spec promises.
10. `font-display` and `font-mono` utilities exist but are never applied — every heading is base Inter.
11. Toast messages duplicated across files (e.g. "Plan deleted" in both `plans.$planId.tsx:210` and `plans.index.tsx:57`) — risk of drift.
12. Raw backend error messages surfaced via `toast.error(error.message)` (`auth.tsx`, `log.$token.tsx`, `plans.$planId.tsx`). Untranslatable & exposes Supabase strings to end users.
13. `billing.tsx:211` "17% off · 2 meses grátis" mixes EN ("off") and PT ("meses grátis") in one string.
14. Icon-only chevron buttons without `aria-label` in `SessionDayView.tsx:126,436` and `plans.$planId.tsx:1006`.
15. Inline `rgba(212, 175, 89, 0.08)` in `index.tsx:166` should reference `--forge-accent-soft`.
16. Hard-coded chart hex colors in `SessionDayView.tsx:35-36` (`#7AB8E8`, `#C28FE8`).
17. shadcn `<Card>` skipped in `billing.tsx`, `plans.$planId.tsx` — raw `div` containers diverge from primitives.
18. `<EmptyState>` primitive missing — italic "No summary yet." / "No logo" / "No matches" reinvented per file.
19. Eyebrow text recipe (`text-xs uppercase tracking-widest text-muted-foreground`) repeated 18+ times — needs `<Eyebrow>` component.
20. `clients_.$clientId.tsx` (1.7k LOC) and `plans.$planId.tsx` (1.3k LOC) hold most of the i18n debt; refactor would surface remaining strings.

### MEDIUM
21. Trial expiry copy uses color-only emphasis (amber vs destructive) without icon (`billing.tsx:245,255`).
22. Risk pill in `clients_.$clientId.tsx:988` color-only.
23. Set-status chips in `SessionDayView.tsx:347-413` color-only.
24. `<SelectValue placeholder="Select…">` used 4× in `clients_.$clientId.tsx` — non-i18n placeholder doubling as label.
25. Plan section keys ("Warmup", "Activation", "Dynamic stretches", "Cooldown", "Finisher") hardcoded in route copy and likely in PDF generator (`src/lib/pdf.ts`) — duplicate source of truth.
26. Long English copy embedded as React children in `index.tsx` lines 60-470 (hero, how-it-works, mock content) — extract to constants for future i18n.
27. `auth.tsx:62` "FORGE" wordmark via `font-light tracking-[0.2em] uppercase text-sm` — should use `font-display` per FORGE §2.
28. `dashboard.tsx:65` "Welcome back" English-only with no translation hook.
29. `clients.tsx:108` "Roster" English-only.
30. `OnboardingChecklist.tsx` step copy hardcoded in EN.
31. `IntakeLinkPanel.tsx:121,139` duplicated "Client intake link" eyebrow.
32. `ComplianceDashboard.tsx:259,279,324` section labels in EN with uppercase tracking — see §5.5.
33. `ValidationReport.tsx:108-111` badge labels ("pass", "repaired", "failed", "critic skipped") — domain copy, EN only.
34. `SessionDayView.tsx:178` `rounded-full bg-accent/10 px-2 …` — inline pill recipe duplicated 5 times in same file.
35. `plans.$planId.sessions.tsx:139` "Compliance report" eyebrow EN-only.
36. `intake.$token.tsx:512` footer microcopy EN-only on public client surface.
37. `log.$token.tsx:149` "How did it feel?" English on public client surface.
38. `SessionDayView.tsx:100` italic week subtitle.
39. `plans.$planId.tsx:427` italic block-quote of week rationale.
40. `plans.$planId.tsx:1039` italic technique cue — duplicated PDF anti-pattern.

### LOW
41. `LanguageSwitcher.tsx` flag emojis assume the user's font supports country-flag glyphs (Windows lacks them) — consider SVG fallbacks.
42. `auth.tsx:109` "or" divider — trivial but missing translation.
43. Brand "Forge" capitalization inconsistent: `Bem-vindo ao Forge!` vs `Forge {tier} — activo` vs `font-display` wordmark "FORGE".
44. `Logo.tsx` alt is "Forge logo" — fine but should respect runtime brand name.
45. `settings.tsx:67` toast contains apostrophe in "don't" — encoding-safe but reads informal vs other toasts.
46. `intake.$token.tsx` placeholders use ellipsis char "…" inconsistently with other files using `...`.
47. Date formatting uses `new Date(...).toLocaleDateString()` without explicit locale — depends on browser locale, not the LanguageSwitcher choice.
48. Number formatting in billing prices (`€{price}`, `≈ €{monthlyEquiv}/mês`) bypasses `Intl.NumberFormat` — currency symbol hardcoded.
49. `clients.tsx:144` `text-[11px]` literal — small but inconsistent with FORGE `--text-meta: 11px` token.
50. `dashboard.tsx:76` same `text-[11px]` literal — should use `text-meta`.

`+ ~30 more` minor findings deferred (spacing literals, duplicated `rounded-full` recipes, dead `text-amber-200/500/600` Tailwind colors in `plans.$planId.tsx:276` not in FORGE palette).

---

_End of audit. No source files modified._
