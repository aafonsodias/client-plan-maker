## Premissa de design (a partir dos estudos)

- **Base = frio suave.** Azul-verde dessaturado nas superfícies grandes (canvas, cards, sidebar). Calma, confiança, segurança clínica.
- **Texto = ink quente neutro**, nunca cinza puro nem branco-azulado frio (evita "estéril/hospitalar").
- **Acento quente em ~10%** apenas em CTAs, focus rings, chips activos, KPIs. Tom **terracota suave** (mais humano que amber puro, menos infantil que amarelo, mais clínico que vermelho). Amber fica reservado ao PDF FORGE e BrandMark (já está separado na memória).
- **Verde-sálvia** como cor de sucesso/"ready" (substitui o emerald cru — mantém a semântica mas em registo terapêutico).
- **Sem brancos puros nem pretos puros.** Claro = pergaminho frio levíssimo. Escuro = teal-noite, não preto-azul Whoop.
- **Contraste WCAG AA** garantido em texto sobre superfície em todos os 3 modos.

## Os 3 temas

### 1. `mist` — Claro (substitui Cream)
Sala de consulta de manhã. Pergaminho com sub-tom verde-azulado.
- Background: pergaminho fresco `oklch(0.97 0.012 200)`
- Card: branco-azulado `oklch(0.985 0.010 200)`
- Foreground: ink teal-escuro `oklch(0.22 0.025 220)`
- Muted-foreground: `oklch(0.50 0.022 215)`
- Border: `oklch(0.88 0.018 200)`
- Primary (botões): teal médio `oklch(0.45 0.055 210)` com texto creme
- Accent (warm 10%): terracota suave `oklch(0.66 0.105 45)`
- Success: sálvia `oklch(0.62 0.075 165)`
- Ring: terracota α0.45

### 2. `sage` — Médio (substitui Slate)
Penumbra de clínica. Verde-azulado dessaturado, suficientemente escuro para conforto noturno mas sem peso.
- Background: `oklch(0.34 0.025 195)` (teal-cinza)
- Card: `oklch(0.38 0.028 195)`
- Foreground: `oklch(0.93 0.012 90)` (creme quente, evita azul-frio)
- Muted-foreground: `oklch(0.70 0.020 195)`
- Border: `oklch(0.42 0.026 195)`
- Primary: creme `oklch(0.93 0.012 90)`
- Accent: terracota `oklch(0.70 0.115 45)`
- Success: sálvia `oklch(0.68 0.085 165)`
- Ring: terracota α0.5

### 3. `deep` — Escuro (substitui Dark)
Noite de hospital, lounge calmo. Teal-noite, não black-blue agressivo.
- Background: `oklch(0.20 0.022 215)` (deep teal-night)
- Card: `oklch(0.235 0.025 215)`
- Foreground: `oklch(0.94 0.010 90)` (creme quente)
- Muted-foreground: `oklch(0.62 0.020 210)`
- Border: `oklch(0.28 0.025 215)`
- Primary: creme
- Accent: terracota `oklch(0.72 0.125 45)`
- Success: sálvia `oklch(0.70 0.085 165)`
- Ring: terracota α0.5
- Gradient hero: teal-night → teal-card

> Tons exactos podem afinar +/- 1–2% na implementação após smoke test no preview, mas a estrutura (hue 195–220 frio + accent hue 45 quente + success hue 165) fica fixa.

## O que muda em código

1. **`src/styles.css`** — reescrever os blocos `:root` (era dark amber → passa a `deep` teal), `.slate` (→ `sage`), `.light` (→ `mist`). Manter os mesmos selectors para não partir o resto:
   - `:root` = `deep` (default escuro)
   - `.slate` = `sage`
   - `.light` = `mist`
   - **Não tocar** nos tokens `--forge-*` (PDF e BrandMark continuam amber).
   - Actualizar `--gradient-hero`, `--gradient-accent`, `--shadow-glow`, `--ring`, `@keyframes lime-pulse` (passa a usar accent terracota), e a halo em `.atlas-genie-halo` (rgb terracota).

2. **`src/components/ThemeToggle.tsx`** — manter mecânica tri-state, só renomear o `Mode` union e o conic-gradient para reflectir as novas cores no botão:
   - `type Mode = "deep" | "sage" | "mist"`
   - `MODES = ["deep", "sage", "mist"]`
   - Migration no `readInitial()`: `dark→deep`, `slate→sage`, `cream→mist` (lê ambas as chaves antigas).
   - Conic gradient com swatch das 3 novas cores.
   - i18n labels em `common.json` (PT/EN): `theme.deep`, `theme.sage`, `theme.mist` + tooltip "Profundo · Sálvia · Névoa" / "Deep · Sage · Mist".

3. **i18n** — adicionar 3 labels em `src/i18n/locales/{en,pt}/common.json` sob `theme.*`.

4. **Memória** — actualizar `mem://index.md` Core para registar:
   - "App theme = paleta terapêutica (deep/sage/mist), base teal frio + accent terracota ~10%. FORGE amber só em PDF e BrandMark."
   - Remover qualquer referência implícita a "amber accent" como token universal.

## O que NÃO muda

- `BrandMark`, FORGE PDF tokens (`--forge-*`), founder badge amber, status emerald/amber/red da `status-tone.ts` (mantêm semântica), preview banner amber do "Ver como cliente" (assinatura visual de modo, não tema).
- Mecânica do toggle, persistência em `localStorage`, ordem de ciclo.

## QA

- Smoke nos 3 modos em `/dashboard`, `/me`, `/plans/$id`, login, landing.
- Verificar contraste do texto secundário sobre cards (`muted-foreground` vs `card`) — ponto fraco habitual em paletas dessaturadas.
- 375px Mobile Safari no `/me` (non-negotiable da memória).
- Confirmar que PDF export continua amber FORGE.
