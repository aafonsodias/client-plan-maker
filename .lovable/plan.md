

# Round 62 — Feedback do Gonçalo: triagem em 3 rondas

São ~40 pontos. Não dá para fazer tudo num turno sem partir coisas. Agrupei por **severidade × esforço**, marquei o que é crítico (bugs) vs preferência (cópia/UI), e proponho 3 sub-rondas. Tudo que diz "AI marketing" ou "human touches" → linguagem mais sóbria por defeito (memória já diz "honest craft tool", reforço).

---

## P0 — BUGS CRÍTICOS (Round 62a — esta ronda)

Tudo isto está partido ou é dishonest. Resolvo agora.

1. **Intake não espelha** — assessment do amigo não aparece no dashboard do trainer. Investigar `intake.functions.ts` submit + `clients.intake_status` trigger. **Crítico.**
2. **Tirar foto não funciona** — `ClientAvatarUpload` / intake photo step. Trocar para "Carregar foto" + "Tirar foto" lado a lado, fallback se camera API falhar.
3. **Language switch faz sign-out / muda no login** — verificar se LanguageSwitcher chama algo que invalida sessão; isolar do auth flow.
4. **`ext_daily_steps` invalid value bug** (10k vs 10 000) — parseInt no slider/input do intake lifestyle.
5. **EU date format** — `smart_deadline` picker está MM/DD/YYYY, deve ser DD/MM/YYYY (locale-aware).
6. **"signed in as a coach" no thanks page** quando o trainer testa o próprio link — a mensagem está, mas chega tarde. Detectar mais cedo (welcome step) e bloquear.
7. **Plano ignora running/climbing** — pediu 5k em 30min + escalada 6B + 4 dias, gerou só ginásio. Stage 3 microcycle não está a respeitar `goals.modality`. Auditar prompt + brief.
8. **PDF artefactos + nomes de sessões maus** — preciso reproduzir um PDF para ver. Provável: layout overflow + day_label genérico ("Day 1") em vez do focus.
9. **Bar overflow no /plans (mobile)** — view/edit/log buttons ultrapassam viewport em 375px.

## P1 — UX onboarding & intake (Round 62b)

Cópia, sliders, ajudas contextuais. Tudo via i18n (4 línguas).

10. **"After the PDF" copy sem sentido** — reescrever na landing.
11. **"Human touches" → mudar** (Gonçalo: "parece pedófilo"). Substituir por "Revisão humana opcional" ou similar.
12. **Slides do hero rápidos demais** — já reduzido a 1 slide na Round 61, confirmar; aumentar dwell se voltar a múltiplos.
13. **"See how it works" pouco visível** — promover CTA secundário no hero.
14. **Preview do que acontece ao clicar "Criar plano grátis"** — adicionar micro-step "3 passos: avaliação → revisão → PDF (90s)".
15. **Solo → "Add your first client"** — copy errada. Se path = self/solo, primeiro passo é "Cria o teu próprio plano", não cliente.
16. **"Add manually vs send link"** — explicar a diferença em 1 linha cada.
17. **"Generate plan draft" sem context** — adicionar 1 frase: "Vamos usar a tua avaliação. Podes editar tudo depois."
18. **Readiness step — explicar consequências** — tooltip: "Isto ajusta o volume inicial e a curva de progressão."
19. **Dias por semana — sugerir combinações** — "3 dias = Seg/Qua/Sex" / "4 dias = Seg/Ter/Qui/Sex" como chips.
20. **Sleep slider granularidade** — passar de 1h para 30min.
21. **Goal — pace explícito** — quando escolhe "5k em 30 min" mostrar "≈ 6:00/km".
22. **Goal — múltiplos objetivos** — UI já aceita mas não é claro. Adicionar "+ Adicionar outro objetivo" + chip "AI interpreta múltiplos objetivos".
23. **Secções "abertas" desnecessárias** (horas sentado, etc) — converter para chips/preset ranges; AI interpreta texto livre só onde compensa.
24. **Confusão geral pós-intake** ("não sabia o que fazer") — overlay/checklist pós-submit do amigo (cliente): "Espera revisão do treinador" + cópia clara.

## P2 — Qualidade do plano, logbook, schedule, branding, founder (Round 62c)

25. **Plano semana 1 = avaliação progressiva + treino relevante** — Stage 3 prompt: week 1 inclui movement screens + treinos easy alinhados ao objetivo principal.
26. **Logbook desktop mal aproveitado** — redesign 2-col (mobile mantém-se).
27. **"Planned" debaixo do nome no logbook** em vez de coluna separada.
28. **Schedule mês view** — colapsar semanas, contagem de treinos por semana.
29. **Volume MEV/MAV/MRV invisível em dark mode** — fix cores em `VolumeStatusTable` / `WeeklyVolumeBars`.
30. **DB de exercícios com vídeos** — MVP: tabela `exercise_library` (name, slug, video_url, description, muscle_group), seed inicial ~50 movimentos chave, plan generation mapeia exercícios para esta lib.
31. **Founder admin: lista de contas registadas** — `/founder` route gated a `aafonsodias@gmail.com`, lista profiles + última atividade.
32. **Tone adapter** — default sóbrio (já é). Detecção de "user divertido" fica para backlog (não é P0).
33. **Billing/Branding** — vagos. Preciso screenshots para perceber o que rejeita. **Ponho no backlog até clarificar.**
34. **Welcome to Protocol "1 passo atrás"** — investigar wizard onboarding indices.

## NÃO FAÇO agora (decisão consciente)

- **AI chat dentro do intake (goal helper)** — Gonçalo pediu "cuidado porque gasta dinheiro". Adiar até decidirmos rate-limit por trainer (1 chamada/goal field, cap diário).
- **Tone adapter inteligente** — backlog.
- **Branding/billing redesign** — preciso de feedback específico.

---

## Perguntas antes de arrancar

1. **Por onde começo?** — opções: (a) **só P0 esta ronda** (9 bugs, ~1 ciclo de chat), (b) **P0 + P1 alta** (bugs + cópia onboarding), (c) **tudo P0+P1+P2 mas sem perfeição** (1 só ronda gigante, risco de quebrar).
2. **Founder admin agora ou depois?** — precisa migration (RLS por email) e route nova. P0 ou P2?
3. **DB de exercícios** — começo com ~50 movimentos manuais (gym + running + climbing + bodyweight) ou peço ao Lovable AI para gerar lista validada?

Recomendação: **(a) P0 só** nesta ronda. Bugs primeiro, copy depois, plan quality em terceiro. Cada ronda tem QA separado em 375px + dark mode.

