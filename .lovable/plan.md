## What changes

Today's landing has ~14 sections (Hero → Benefits → Anti-ChatGPT → How it works → Comparison → Tier badges → Journey → Mid-CTA → Credibility → Logbook preview → Workbench → Logbook insights → Pricing → Features → Roadmap → Founder → FAQ → Mission → Closing). It's long, repeats itself (Benefits ≈ Features, Logbook preview ≈ Logbook insights, Journey ≈ How it works, Credibility ≈ Tier badges), and dilutes the message.

The updated Protocol PDF is sharper: one promise, one mockup, one comparison, one journey, one logbook proof, one price, one founder note, FAQ. I'll fuse the page to that shape.

## New structure (8 sections, ~half the length)

1. **Hero** — keep current layout (logo lockup + headline + plan mockup on the right). Refresh copy to PDF wording: *"Cria planos de treino prontos a enviar em minutos. Baseados na avaliação real do teu cliente. Ajustam-se semana a semana com o que ele faz no ginásio."* Keep the "Beta privado" chip, the primary CTA, and the "Conta grátis · 1 cliente · 1 plano · sem cartão · ver exemplo PDF" line. **Drop** the separate Benefits strip below — it duplicates this.

2. **Anti-ChatGPT** — keep section, tighten copy to PDF line: *"ChatGPT gera o que pedes. Protocol gera o que o cliente precisa."* Keep the 14-section assessment checklist visual.

3. **Journey + How it works (fused)** — one section showing the 5 stages (Avaliação → Brief → Blueprint → Microciclo → Progressões) using the existing `JourneyStrip`. Delete the separate `HowItWorksAnimation` section above (its content is the same loop, just animated). Move the tier badges (🟢🟡🔵) into a small sub-row inside this section instead of a standalone block.

4. **Comparison table** — keep `ComparisonTableSection` as-is. Strongest objective proof on the page.

5. **Depois do PDF — logbook + insights (fused)** — merge the three current logbook sections (preview, workbench, insights) into one. Layout: left = `SetLogMockup` ("o cliente regista"), right = `LogbookInsightsMockup` ("a IA lê e devolve sinais"). Below: a single 3-step "Como funciona" line. Drop the separate Workbench mockup, the history grid and the trend chart from the landing — those live inside the app, not the pitch.

6. **Pricing** — keep both cards (Beta grátis + Pro em breve). No change.

7. **Founder + Roadmap (fused)** — keep the founder note, append a tiny single-line "A seguir, abertamente:" with 3 inline "Em breve" chips (Tendências · Ajustes por prompt · Conselhos IA) instead of the full roadmap card grid. Honest, no-CTA.

8. **FAQ + Closing CTA + Footer** — trim FAQ from 10 → 6 questions (the ones the PDF foregrounds: plan good enough?, lesions, brand, data, science, free quota). Keep the closing CTA card and the footer untouched.

**Removed sections:** `Benefits` strip, `HowItWorksAnimation`, `MidCtaSection`, `Credibility` cards (PARQ/ACSM/Prochaska — already covered in Anti-ChatGPT checklist), standalone `TierBadgesSection`, standalone `Workbench` section, `LogbookHistory` + `Progression` mockups, `Features` 3-card grid, full `Roadmap` grid, standalone `Mission` line.

## Visuals

The PDF ships its own illustrations but they're stylistically inconsistent with the current dark/amber product mockups (`HeroPlanMockup`, `SetLogMockup`, `LogbookInsightsMockup`) which already match the in-app UI. **Recommendation: keep the existing in-app-style mockups** (they're truer product proof than decorative graphics) and only refresh **copy** + **structure**. If you want generated illustrations on top, say the word and I'll add 1–2 hero/section images via Lovable AI in a follow-up — but I'd advise against it for a "condensed, high-signal" page.

## Copy work

All new strings go through i18n (`plan.landing.*` in PT + EN). PT voice = "você" per project memory. I'll:
- rewrite hero title/subtitle to match the PDF
- tighten Anti-ChatGPT copy to the PDF's one-liner
- shorten FAQ list to 6 (delete q7–q10 keys, keep q1–q6 with refreshed answers from the PDF)
- collapse roadmap into 3 inline chips (drop `roadmap.items.*.title/desc`, add a single `roadmap.inline_chips` array)

## Files touched

- `src/routes/index.tsx` — remove ~6 sections, fuse logbook block, inline tier badges into journey, trim FAQ
- `src/i18n/locales/pt/plan.json` + `en/plan.json` — refresh hero/anti-chatgpt/founder/closing copy, trim FAQ keys, add inline roadmap chips
- No new components; existing `JourneyStrip`, `HeroPlanMockup`, `SetLogMockup`, `LogbookInsightsMockup`, `ComparisonTableSection` all reused as-is

## Out of scope (ask before adding)

- AI-generated hero/section illustrations
- New testimonial block (project memory: "no fake social proof")
- Re-skinning the app mockups