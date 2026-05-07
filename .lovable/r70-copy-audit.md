# R70 — Visible adversarial copy audit + replacements

| File | Key | Before | After |
|---|---|---|---|
| pt/plan.json | landing.hero.title_line2 | "Programação séria, sem viver no Excel." | "Da avaliação ao plano, com lógica visível." |
| en/plan.json | landing.hero.title_line2 | "Serious programming, without living in Excel." | "From assessment to plan, with visible logic." |
| es/plan.json | landing.hero.title_line2 | "Programación seria, sin vivir en Excel." | "De la evaluación al plan, con lógica visible." |
| pt/plan.json | landing.hero.variants[0].line2 | (same) | (same as title_line2) |
| en/plan.json | landing.hero.variants[0].line2 | (same) | (same as title_line2) |
| es/plan.json | landing.hero.variants[0].line2 | (same) | (same as title_line2) |
| pt/plan.json | landing.faq.q13_q/_a | "Em que é que isto é diferente do ChatGPT…" / "O ChatGPT gera o que lhe pedirem…" | "O que torna o Protocol distinto?" / positive framing |
| en/plan.json | landing.faq.q13_q/_a | "How is this different from ChatGPT…" | "What makes Protocol distinct?" / positive framing |
| es/plan.json | landing.faq.q13_q/_a | (idem) | (idem) |
| pt/plan.json | landing.anti_chatgpt.* | "PROTOCOL vs ChatGPT" / "ChatGPT gera o que você PEDE…" | "O valor está na sequência" / "Avaliar, estruturar, executar, registar e adaptar." |
| en/plan.json | landing.anti_chatgpt.* | "PROTOCOL vs ChatGPT" / "ChatGPT generates what you ASK…" | "The value is in the sequence" / "Assess, structure, execute, log, and adapt." |
| es/plan.json | landing.anti_chatgpt.* | idem | idem |
| {pt,en,es,hi}/plan.json | landing.comparison.* | competitor matrix (Excel · ChatGPT · Generic apps) with rows/cells | 6-item workflow connector (Assessment, Plan, Sessions, Logbook, Adaptation, Progress) |
| src/routes/index.tsx | ComparisonTableSection | competitor matrix renderer (table + mobile cards + Check/X/Minus icons) | grid of 6 numbered chips reading landing.comparison.items |
| src/routes/index.tsx | comment "Comparison table — Protocol vs Excel vs ChatGPT vs Generic apps" | (visible in source only) | "Workflow connector — what Protocol helps you connect (R70)" |

## Internal-only references kept (acceptable, not visible)
- `function AntiChatGPTSection()` and `function WhoAndWhySection()` — internal names. Both unused on rendered landing (`AntiChatGPTSection` and `WhoAndWhySection` are defined but not invoked from `Landing()`); only `ForWhomSection`/`ComparisonTableSection` were rendered. Renaming deferred to avoid file churn.
- `landing.anti_chatgpt.*` JSON key — kept for compatibility with the unused components; content is now neutral, so even if rendered later it does not attack any tool.
- "vs" inside in-app strings (`PR vs week 1`, `Δ vs W1`, `Capacity vs PB`, etc.) — these are statistical comparisons, not competitor framing. Kept.
- "Excel" in `landing.benefits` / `mockups` and in `signal_uploads` ("Bioimpedance, blood pressure — photo, PDF or Excel") — neutral file-format mention, not adversarial. Kept.
- "manual.json" `Free vs full plan` — internal docs surface, not landing. Kept.

## Verification
- `tsc --noEmit` clean.
- 375/390px smoke: connector grid stacks 1 → 2 → 3 columns; no overflow.
- Hard refresh `/`: no hook crash.
- `rg -i "excel|chatgpt|trainerize|rp strength|sem viver|melhor que|guarda dados" src/i18n/locales/*/plan.json src/routes/index.tsx src/components/landing` → only neutral residue (file-format Excel mention in `signal_uploads`, internal component name comment removed).
