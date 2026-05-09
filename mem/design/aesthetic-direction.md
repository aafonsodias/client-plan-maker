---
name: Aesthetic direction (inner app)
description: Calm tools, loud moments — design language for every authenticated page, with the per-page loud-moment table
type: design
---
# Calm tools, loud moments

The chrome (nav, tables, forms) stays quiet, dense, trustworthy — editorial dashboard. Hero moments (plan ready, block transition, capacity gain, PR) get ONE bold gesture: a single amber under-glow, a large numeral, or a slow reveal. Never two at once.

## Rules
- One display font (current); body Inter. No new families.
- Status colour is the only chromatic vocabulary: emerald / amber / muted / red. No purples. No gradients beyond the existing amber under-glow.
- Spacing rhythm: 4 / 8 / 16 / 24 / 48. 48 between sections, ≥16 between cards.
- Density: comfortable on desktop, tighter on mobile (current AppShell behavior — keep).
- Motion: 200ms for state, 600ms for reveals. Never both on the same element.

## Per-page loud-moment table
- dashboard → "next action" card with amber under-glow
- clients list → thin amber left border on birthday / red-flag rows
- clients/$id → capacity-gain card when block_number > 1
- clients/$id/year → quiet around the heatmap (heatmap itself is the loud moment)
- plans.index → status pill is the only colour
- plans.new / plans.quick → amber under-glow only on primary CTA
- plans/$id → "Pronto" reveal (600ms fade-in once)
- plans/$id/brief → Intensity Cockpit is the centerpiece
- plans/$id/{blueprint,microcycle,progressions,sessions} → none, density wins
- intake.$token → submit confirmation
- log.$token → amber under-glow on "Save set"
- me → today's session card
- me.progresso → capacity-gain delta numeral
- me.historico → PR badges inline
- settings, billing, schedule, schedule.packs, templates, knowledge, admin.system, welcome → none
