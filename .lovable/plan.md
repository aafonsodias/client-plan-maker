# R69 — Landing Copy & Positioning Pass (PT-only, no redesign)

Scope: copy and label edits only. No new sections, components, routes, animations, or layout changes. All edits land in i18n files (`src/i18n/locales/pt/plan.json`, plus EN/ES/HI fallback parity for the same keys) and, where copy is currently hardcoded in `src/routes/index.tsx`, in that file.

## What's wrong with the current copy

1. **Hero**: "Planos cientificamente válidos em 90s" leads with speed. Speed is what every generic AI tool promises. Our edge is the *assessment → defensible protocol → adaptation* loop, not seconds-to-PDF.
2. **3 hero bullets**: list features (PAR-Q+, MEV/MAV/MRV, branded PDF) instead of the loop. MEV/MAV/MRV jargon turns away non-hypertrophy PTs.
3. **Journey strip**: 5 stage labels (Avaliação → Brief → Blueprint → Microciclo → Progressões) describe internal pipeline names, not the trainer's mental model. Missing the *adaptation* beat (block N → block N+1 from logbook).
4. **Logbook section**: title "Cada série registada vira combustível para a próxima semana" is good, but body talks about "voz e sensores amanhã" — soft promise of unbuilt features. Should say what the logbook *closes the loop on* today.
5. **FAQ**: q1 ("É um ponto de partida sólido, não um destino") undersells. Better framing: "Você é o último filtro, sempre — e a IA nunca gera mais de uma semana de cada vez." Matches the actual programNextWeek architecture (per project memory).
6. **Beta chip / pricing strip**: "vagas limitadas esta semana" reads as fake scarcity unless we genuinely cap. Soften unless we have a real cap.
7. **Comparison table**: keep structure, audit row labels for honesty (e.g. "Adaptação semana-a-semana" must reflect that AI only generates W1; W2+ is deterministic + log-driven).
8. **Roadmap / "a seguir"**: 3 chips are fine but should explicitly say *not yet shipped* via existing "Em breve" pattern.

## Edits (copy only — no layout, no new keys structure)

### Hero (`landing.hero.*`)
- `title_line1` / `title_line2` → lead with the *loop*, not speed:
  - line1: "Avaliação clínica → protocolo defensável → adaptação semanal."
  - line2: "Programação séria, sem viver no Excel."
- `subtitle` → "Você faz a avaliação. A Protocol monta o protocolo. Cada série registada alimenta a semana seguinte."
- `bullets` (3, no jargon):
  1. "Triagem clínica antes de qualquer prescrição (PAR-Q+, ACSM)."
  2. "Protocolo editável em 5 fases — você aprova cada uma."
  3. "Próxima semana ajustada ao que o cliente realmente fez."
- `cta_primary_signed_out` → keep "Criar primeiro plano grátis".
- `beta_softcap_chip` → soften: "Beta privado · feedback direto com o autor" (drop fake scarcity unless a real cap exists).

### Journey strip (`landing.journey.*`)
- `eyebrow` → "O ciclo, não o atalho"
- `title` → "Avaliação. Protocolo. Adaptação. Em loop."
- `subtitle` → "Cinco fases dentro da app, e a sexta é a próxima semana — montada a partir do que foi registado."
- Stage labels stay (intake / brief / blueprint / microcycle / progressions) but `progressions.desc` rewritten to make the adaptation explicit:
  - "Semana N+1 sai do logbook: adesão, RPE real, drift de carga. A IA só gera a Semana 1; o resto é determinístico."

### Comparison table (`landing.comparison.*` if keyed; else inline strings in `index.tsx` `ComparisonTableSection`)
Audit each row for honesty. Two specific fixes:
- Row "Adaptação semana-a-semana": Protocol cell → "Sim · determinístico + log-driven" (not "IA gera tudo").
- Row "Triagem clínica": Protocol cell stays "PAR-Q+ + ACSM dentro"; ChatGPT cell → "Depende do prompt"; Excel → "Manual"; Generic apps → "Genérica ou nenhuma".

### Logbook section (`landing.logbook_preview.*`)
- `title` → "O logbook não é um diário. É o input da próxima semana."
- `subtitle` → "Cada série registada — manualmente, hoje — entra no cálculo da Semana N+1: carga, RPE, adesão. Voz e sensores virão; o motor já lê o que existe."
- `flow` → "1. O cliente regista. 2. A app lê adesão, RPE e drift. 3. A próxima semana sai com cargas ajustadas."

### FAQ (`landing.faq.*`)
- `q1_a` → reframe around real architecture: "A IA nunca gera mais do que uma semana. As semanas seguintes saem de uma progressão determinística (Bompa wave + incrementos NSCA por categoria) ajustada pelo que foi registado. Você aprova cada fase. O resultado é defensável porque o método é defensável — não porque a IA é infalível."
- `q5_a` → keep, but add one sentence: "Cada bloco de programação tem fonte rastreável dentro da app (`generation_log`)."

### Founder (`landing.founder.*`)
- Tighten `p2`: "A base é humana. A IA trata da repetição. Os manuais sustentam as escolhas. Você é sempre o último filtro." Drop the "aos poucos vamos integrando mais evidência" hedge — it weakens the pitch.

### Roadmap chips (`landing.roadmap.inline_chips`)
- Add a "Em breve · " prefix to each chip so the chip itself signals not-shipped (matches the project rule "never advertise unbuilt features without a Soon chip").

### Pricing
- `subtitle` → "1 cliente = 1 plano completo grátis. Sem cartão. Sem letras pequenas."
- `beta_strip_body` → "1 cliente · 1 plano completo grátis · feedback direto com o autor."

### Locales
- PT (`pt/plan.json`) is the source.
- EN/ES/HI: update the same keys with literal translations of the new strings (existing fallback rules apply; landing remains PT-marketed but other locales must not regress).

## Out of scope (explicit)

- No new sections, components, animations, routes, or assets.
- No layout / Tailwind class changes.
- No mockup component edits except text inside existing `t()` calls.
- No new dependencies.
- No schema, server function, payment, recurrence, or engine changes.
- WhoAndWhySection / AntiChatGPTSection / ForWhomSection: leave hidden/visible state as-is.

## Verification

- `tsc --noEmit` clean.
- 375 / 390px hero smoke (no overflow with new strings).
- Hard refresh `/` no hook crash regression.
- Visual scan that no key resolves to a missing-translation fallback.

## Files touched

- `src/i18n/locales/pt/plan.json` (primary)
- `src/i18n/locales/en/plan.json`
- `src/i18n/locales/es/plan.json`
- `src/i18n/locales/hi/plan.json`
- `src/routes/index.tsx` only if a string is currently hardcoded (e.g. comparison table cells, signed-in "Experimente em 5 cliques" button) — in that case, move to i18n in the same edit.

If during implementation any of the proposed copy exceeds the existing slot's visual budget at 375px, I'll shorten the string rather than touch layout, and note the trim in the report.
