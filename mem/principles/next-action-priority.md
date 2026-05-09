---
name: NextActionCard priority
description: Dashboard NextActionCard never suggests generating a plan with assessment_completion < 100. Strict order, compact strip layout.
type: feature
---
NextActionCard (`src/components/dashboard/NextActionCard.tsx`) is a compact strip on `/dashboard`. Always renders. Never tall/loud — `px-4 py-3`, 32px avatar, no glow shadow, only thin amber border.

Priority (first match wins):
1. `intake_status = submitted` AND `assessment_completion >= 100` → "Rever avaliação" → `/clients/$id`
2. `assessment_completion < 100` AND `intake_status != not_sent` → "Completar avaliação · {pct}%" → `/clients/$id` (highest pct first = momentum)
3. `assessment_completion >= 100` AND no active plan → "Gerar plano" → `/plans/new?clientId=$id`
4. Birthday ≤ 7 days → "Felicitar"
5. No clients → "Convidar primeiro cliente" (opens InviteDialog)
6. Otherwise → idle "Tudo em dia · N clientes" (emerald, no CTA)

**Never** offer to generate a plan when assessment is incomplete. The trainer's job is to finish the assessment first; the AI brief comes after.

**How to apply:** any new "next thing" surface must respect this sequence. If a new signal is added (red flag, expiring pack, etc.), slot it correctly — pre-100% signals always trump generation.
