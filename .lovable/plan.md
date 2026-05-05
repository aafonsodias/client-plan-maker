
## Goal

Tighten the landing into less, truer, calmer copy. Swap the AI-insights mockup for ones a normal person values first (VO2max, dead/active hang) plus 2 "zé povinho" wins. Stabilize the hero rotator so text and the card frame stop jumping. Defer the heavy R&D requests (face-blur, assessment library, warmup engine) to the backlog with a one-line acknowledgement on the page.

## Scope

Three buckets. Everything else (photo face-crop, full assessment expansion, warmup taxonomy, etc.) goes into `.lovable/backlog.md` and is acknowledged on the page as "processo vivo", not promised.

### 1. Insights mockup — reorder + replace (file: `src/components/landing/LogbookInsightsMockup.tsx`)

New 4-card order, top → bottom (most universally valued first, technical last):

1. **Sono médio · 7h12 (+38min vs mês passado)** — emerald, `Activity` icon. "Recuperação a melhorar. Janela boa para subir intensidade."
2. **Energia pré-treino · 7.4 / 10 — em subida** — emerald, `TrendingUp`. "Treinos a deixar-te com mais bateria do que tinham."
3. **VO₂máx estimado · 42 ml/kg/min (zona "Bom")** — emerald, `Activity`. "Estimativa derivada do submáximo. Reavaliar em 6 semanas."
4. **Dead hang ativo · 38s (+9s em 4 semanas)** — amber `AlertTriangle` only if regression; otherwise emerald `TrendingUp`. "Pega e ombros mais fortes — bom marcador de saúde geral."

Remove: "Volume +12%", "Bench +5kg", "Adesão 6/6", "RPE médio 8.4". Keep the same card chrome/tone classes. All copy via i18n under `plan:landing.logbook_insights.cards.*`.

i18n caveat below the card: "Métricas derivadas do que registas. VO₂máx é estimativa, não medição clínica."

### 2. Hero rotator — stop the jump (file: `src/routes/index.tsx`)

Two layout fixes, no animation rewrite:

- **Headline rotator** (`HeroHeadlineRotator`): wrap `<h1>` in a `min-h-[180px] sm:min-h-[200px]` container so the longest variant reserves the space. Same for the audience chip row.
- **Visual rotator** (`HeroVisualRotator`): switch from "render one of three" to a `relative` container with all three mockups absolutely positioned (`absolute inset-0`) and `opacity` cross-fade. Container gets a fixed `h-[680px] lg:h-[780px]`. Each mockup gets `h-full overflow-hidden` so their inner content scrolls/clips inside the same frame instead of pushing the card.

Result: card edges don't grow/shrink between variants; text below doesn't reflow.

### 3. Copy pass — distill, soften, de-claim

All edits in `src/i18n/locales/{pt,en}/plan.json` plus a couple of code-level changes in `index.tsx`:

**a. Comparison footnote** — replace "Israetel, Helms, ACSM" with the honest line:
> "Lógica condicional sobre os manuais ACSM 12e, Bompa-Buzzichelli e NSCA Essentials 3e. Cada referência adicional será citada quando for integrada."

**b. Founder block** — rewrite p1-p3 in the softer tone the user requested. Fix gender to "o Protocol". Draft (pt):
- p1: "Em quinze anos como PT vi a mesma cena: planos feitos à pressa porque programar com critério dá demasiado trabalho."
- p2: "O Protocol existe para tirar essa desculpa do caminho. A base é humana e científica — você decide, a IA faz o trabalho repetitivo, os manuais (ACSM, Bompa, NSCA) sustentam as escolhas."
- p3: "Não queremos automatizar o coaching. Queremos que 'não tive tempo' deixe de ser o motivo de um plano fraco — para o PT e para quem treina sozinho."

**c. FAQ rewrite** — calmer, longer-breath, less forensic:
- q1 (plano da IA): explicit "ainda estamos no início — a IA é ajuda, não decisão final. À medida que confiarmos mais nela, devolveremos mais autonomia. Por agora, você é o filtro."
- q2 (lesões / PAR-Q+): drop "PAR-Q+" from the headline; phrase as "sinais cardíacos, articulares e metabólicos" with the technical name in parenthesis once.
- q3 (PDF/marca): keep but downplay — move out of FAQ top, last position. Reframe as "ferramenta interna do dia a dia", not a selling point.
- q4 (dados): rewrite — explain face-crop intent for photos as future feature, contact data only for talking to you, anonymized aggregate may inform public-health research.
- q5 (ciência): replace with "Manuais que estão dentro hoje: ACSM 12e, Bompa-Buzzichelli, NSCA Essentials 3e. Tudo o resto entra com fonte verificável (PubMed e equivalentes). Nada assinado por nome de autor sem o livro/paper estar dentro."
- q6 (cliente piora): the long compassionate version the user wrote, condensed to ~5 short lines.
- q11 (experiência): add the "no início vais andar à toa, faz parte" tone.
- q12 (sozinho): expand to the "4 perspetivas" framing.
- q13 (vs ChatGPT): swap "14 secções clínicas" for "triagem desenhada para dar à IA o melhor contexto — Protocolo, não chatbot".
- q14 (trial): rewrite to the user's draft — trial = primeira semana de avaliação + começar a treinar; após pagar = fusão de software, comunidade, evolução.

**d. Closing CTA** — replace title/subtitle:
- title: "O próximo plano antes do próximo treino."
- subtitle: "7 dias grátis. Sem cartão. Cancela com 1 clique."

**e. Footer tagline** — replace "Ferramenta de treino para PTs sérios." with:
> "Para quem treina alguém, e para quem treina sozinho. Substância antes de aparências."

**f. Roadmap eyebrow / chips** — keep the chips, but add a one-line lead-in explaining "processo vivo" (the user's exact framing): "Isto é um processo vivo. Vai crescer em profundidade e em largura à medida que ganha forma."

**g. Pricing card** — keep €0 trial / €19/mo. Update trial card sub-line and Pro features to drop "PDFs no domínio próprio" (over-promise). Add: "Tudo o que está no trial · sem limite · ajuste contínuo do plano · participação na comunidade."

### 4. Backlog write-through (file: `.lovable/backlog.md`)

Append three new P1/P2 entries so we don't lose the user's feature requests:

- **[P1] Field/gym assessment expansion** — VO₂máx submaximal, sit-and-reach, behind-the-back scratch, TUG (Timed Up & Go), single-leg balance progressions, dead/active hang. Decide which to surface vs which to derive.
- **[P1] Pre/post-session subjective log** — energy, sleep, stress, soreness before; mood, RPE, perceived benefit after. Feeds insights cards.
- **[P2] Client photo privacy** — auto-detect face, crop above ear or apply blur. Show pose template (heel-to-hair, front/side/back). Make benefits explicit.
- **[P2] Warmup library + agility/cognitive double-task module** — CARs, dynamic stretches, banded activation, ladder drills with timer + word-count beep.
- **[P2] Multi-perspective surfaces** — Solo, Long-distance client, PT-of-record, Client-of-PT. Currently we lean PT-first.

These appear in the page only as the existing "A seguir" chips — no new promises.

## Out of scope (this round)

- Building the assessment expansion, photo face-crop, or warmup engine — they're real work, separate rounds.
- Translating every FAQ word into EN — EN gets the q1/q5/q14 rewrite + closing/tagline; the rest already mirrors PT structure.
- Touching mockup data inside `HeroPlanMockup` / `CoachWorkbenchMockup` — the user asked previously to keep these, and the rotator-frame fix is enough for the "deslocar texto" complaint.

## Acceptance check

- Hero variants cycle: card frame stays the same size, headline area doesn't reflow text below.
- Insights mockup shows Sono → Energia → VO₂máx → Dead hang in that order.
- FAQ q1/q5/q14 read in calmer tone; "Israetel/Helms" no longer cited as foundation.
- Footer tagline addresses non-PT audiences.
- Founder copy says "o Protocol".
- `backlog.md` has 5 new entries; landing page makes no new promises.
