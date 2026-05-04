## Fix the awkward "WELCOME BACK / P Clients" stack

Two small edits in `src/routes/dashboard.tsx` (no new components, no i18n key churn beyond two strings).

### 1. Remove the inline `<BrandMark>` from the H1
The P mark already lives in the AppShell top bar (line 143). Showing it again next to "Clients" is redundant and reads as "P Clients" — visually broken at this size. Drop it from the dashboard hero only; the header keeps it.

```text
Before:                       After:
WELCOME BACK                  [eyebrow]
P  Clients                    Clients
```

### 2. Replace "Welcome back" eyebrow
"Welcome back · Clients" reads as one phrase and feels off. Pick one of these (I recommend **A** — calm, factual, matches the "honest craft tool" voice and mirrors how `clients.eyebrow` already says "Roster / Lista"):

- **A. "Your roster" / "A tua lista"** — neutral, descriptive, no fake warmth
- **B. Drop the eyebrow entirely** — cleanest; just `Clients` as the H1
- **C. "Today" / "Hoje"** — orients the user in time

If unsure, I'll go with **A**. Updates `dashboard.eyebrow` in `src/i18n/locales/{pt,en}/common.json`.

### Result
```text
YOUR ROSTER
Clients
[Filters: All · Onboarding · Active · Idle · Ready]
[client list…]
```

Header still shows the P brand mark, so brand presence is preserved without the duplication.