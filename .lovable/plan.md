
# Round 61 — PT-only repositioning, PT-PT cleanup, ES + HI

Quatro frentes nesta ronda. Foco principal: **reposicionar a landing para PTs apenas**. Tudo o resto serve esse foco.

## Frente A — Limpeza PT (pt-PT, sem brasileirismos)

Revisão completa dos 7 ficheiros em `src/i18n/locales/pt/` (~2466 linhas). Substituições mecânicas + revisão manual de cada string:

| pt-BR (a remover) | pt-PT (a usar) |
|---|---|
| "você" / "o seu" mistura | **"tu" consistente** (mais próximo de PTs em PT, e a `mem://core` diz "PT voice = você"; vou ATUALIZAR a memória — feedback do utilizador favorece PT-PT informal próximo) |
| "tela" | "ecrã" |
| "time" (no sentido de equipa) | "equipa" |
| "cadastro/cadastrar" | "registo/registar" |
| "usuário" | "utilizador" |
| "aplicativo" | "aplicação" |
| "celular" | "telemóvel" |
| "arquivo" | "ficheiro" |
| "gratuito" como adjetivo BR-style | mantém "grátis" / "plano gratuito" (ambos ok PT-PT) |
| "estou a usar isto" | ok PT-PT |
| gerúndios espúrios ("estou fazendo") | "estou a fazer" |

**Decisão de voz:** vou perguntar-te 1× no início se queres **"tu"** (informal, conversacional, mais natural para PTs portugueses) ou manter **"você"** (formal). A memória atual diz "você" — se mudares, atualizo `mem://index.md`.

Saída: 7 JSONs revistos + 1 commit de "linguistic pass pt-PT".

## Frente B — Reposicionamento PT-only (full reescrita da landing)

### B.1 — Hero (substitui o atual)
- **Headline:** "Planos de treino cientificamente válidos em 90 segundos — com o teu nome."
- **Subheadline:** "Sem Excel, sem improviso, sem perder rigor clínico."
- **3 bullets** (substituem as duas colunas "Quem/Porquê"):
  1. ✓ Avaliação clínica automática (PAR-Q+, ACSM)
  2. ✓ Progressão semanal pronta (MEV/MAV/MRV)
  3. ✓ PDF com o branding do teu estúdio
- **CTA primário:** "Criar primeiro plano grátis"
- **Prova:** mantém o `HeroVisualRotator` (já mostra plano real) + link "Ver exemplo em PDF"
- **Beta soft-cap chip:** substituir o "social_proof" chip por **"Beta privado · vagas limitadas esta semana"** (sem número exacto — soft cap, como pediste)

### B.2 — Esconder/encolher secções que diluem
A landing atual tem ~10 secções. Para PTs vendemos **dor → solução → prova → preço**. Vou:
- **Remover** `WhoAndWhySection` (as 3 personas — agora só PTs)
- **Manter** `JourneyStrip` (5 etapas) — é prova de produto
- **Manter** `ComparisonTable` (Protocol vs Excel vs ChatGPT vs Apps genéricas) — é a posição
- **Encolher** `LogbookPreview` para 1 mockup + 1 frase, sem "logbook_insights" duplicado
- **Encolher FAQ** de 10 para **5 perguntas** (q1, q2, q9 quota, q12 preço, q13 cancelar) — as outras vão para `/faq` se quiseres mais tarde
- **Manter** secção do fundador (assina o produto)

### B.3 — Reposicionamento na cópia
Em todos os textos da landing:
- "personal trainers e estúdios" / "para quem treina" / "self-coaching" → **só "personal trainers"**
- Reescrita de `landing.hero.subtitle`, `landing.journey.subtitle`, `landing.closing.subtitle`, `landing.founder.p*` para falarem **só com PTs**
- Tagline do produto: **"Infraestrutura de programação baseada em evidência para PTs"** (subtítulo do footer ou eyebrow do hero)

### B.4 — Beta soft-cap
- Chip no hero (ver B.1)
- Banner discreto na secção pricing: "Beta privado — fechamos novas inscrições esta semana"
- Sem contador, sem número (soft cap, como aprovado)

### B.5 — Modo "rápido" (Onboarding) — **fora desta ronda**
Está mencionado no feedback mas é uma ronda à parte (mexe no fluxo de intake). Vou adicioná-lo ao backlog `.lovable/backlog.md` como P0 da Round 62.

## Frente C — Espanhol (es) e Hindi (hi)

### Setup
1. Atualizar `src/i18n/index.ts`: adicionar `es` e `hi` a `SUPPORTED_LOCALES`, importar bundles, registar `resources`.
2. Criar `src/i18n/locales/es/` e `src/i18n/locales/hi/` com os 7 ficheiros: `assessment.json`, `common.json`, `intake.json`, `manual.json`, `plan.json`, `review.json`, `schedule.json`.
3. `LanguageSwitcher` (`src/components/LanguageSwitcher.tsx`): adicionar 🇪🇸 ES e 🇮🇳 HI ao dropdown.

### Tradução (cobertura: tudo, como aprovado)
- **Pipeline:** script `scripts/translate-locale.ts` (one-off) que usa **Lovable AI Gateway** (`google/gemini-2.5-pro`) para traduzir cada JSON EN→ES e EN→HI, preservando keys, placeholders (`{{var}}`), markdown leve, e o tom (PT/profissional, calmo).
- Prompt do tradutor inclui glossário fixo: "Protocol" (não traduzir), "PAR-Q+", "ACSM", "MEV/MAV/MRV", "RPE", "RIR", "Brief", "Blueprint", "Microcycle", "Block".
- Saída: 14 ficheiros novos (7 ES + 7 HI). Honest disclaimer no commit: "ES/HI são tradução-máquina inicial; pedir revisão a falante nativo antes de promover a marketing pesado."
- Hindi: usar Devanagari (नियम), não transliteração.
- **Não vou tocar no PT** durante este passo (Frente A já o faz).

### Custo
4 ficheiros × 2 línguas × ~500 linhas cada = **~14 chamadas LLM** total (1 chamada por ficheiro/língua). Margem confortável.

## Frente D — Memória + backlog

- **Atualizar `mem://index.md`:**
  - Trocar "Landing page mirrors the 5-stage app journey…" para refletir **PT-only positioning**
  - Trocar "PT voice = você" se decidires mudar para "tu" (depende da resposta na Frente A)
  - Adicionar: "Supported locales = en, pt-PT, es, hi. EN é fonte; PT-PT humanamente revisto; ES/HI tradução-máquina pendente de revisão nativa."
- **`.lovable/backlog.md`:** marcar Round 61 (este) e abrir Round 62:
  - P0: Modo "rápido" no intake (5 inputs → plano em 60-90s, depois oferece upgrade para completo)
  - P1: 5 vídeos curtos (TikTok/Reels) — só checklist de copy/storyboard, não produção
  - P1: Plano anual (cash upfront) e tier "Studio" multi-client → já existe Studio, falta toggle anual com -17%
  - P2: Métricas de funil (cliques → registos → planos gerados) — analytics events

## Ordem de execução

1. Frente A (PT-PT cleanup) — base limpa antes de traduzir
2. Frente B (reposicionamento landing PT) — texto novo entra direto em PT-PT já corrigido
3. Frente C (i18n setup + ES/HI) — traduz a partir do EN actualizado com hero novo (vou actualizar EN primeiro também, espelhando B)
4. Frente D (memória + backlog)
5. Smoke 390px + 1280px em PT, EN, ES, HI

## Detalhes técnicos

- **Sem alterações DB.** Tudo client-side (i18n + JSX).
- **Sem novos pacotes.** Já temos `i18next` + `react-i18next`.
- **Hindi font:** Tailwind/shadcn já cobre via stack `system-ui`; se Devanagari ficar feio em headings com `font-light`, adiciono `font-feature-settings` ou troco para um Noto Sans Devanagari via `<link>` no `__root.tsx` (decido ao testar).
- **RTL:** Hindi é LTR, sem trabalho extra. (Árabe ficou de fora — boa decisão.)
- **`document.documentElement.lang`:** já sincroniza via listener em `src/i18n/index.ts`, sem mudança.
- **Brand voice em ES/HI:** ES neutro (evitar voseo argentino e tuteo demasiado coloquial). HI formal (आप, não तुम).

## Riscos / não-fazer

- **Não vou** mudar pricing, intake, ou qualquer rota que não seja `/` e i18n.
- **Não vou** publicar números de beta cap (soft cap só).
- **Não vou** prometer revisão humana de ES/HI nesta ronda — só tradução-máquina + disclaimer.
- Se `tu` vs `você` ficar indeciso, mantenho `você` (status quo da memória) e abro task no backlog.

Pronto para arrancar quando aprovares.
