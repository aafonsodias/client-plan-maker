## Defaults assumidos (avise se quiser mudar)

- **Domínio público**: ainda não temos. Removo `https://protocol.app` (link externo no intake e index) e troco mailtos `hello@protocol.app` por `hello@protocol.app` como placeholder. Diga-me um domínio real depois e faço sweep dedicado.
- **Chaves locais (`forge_*`, `protocol-intake` IDB, `protocol.locale`)**: rename limpo, sem shim. Em beta privado o impacto é uma vez.
- **Tokens CSS `--protocol-*` e prefixo `--color-protocol-accent`**: renomeio para `--protocol-*` / `--color-protocol-accent`. Os utilities Tailwind `bg-canvas`, `text-ink-primary`, `bg-pill`, etc. **mantêm o nome** (não dizem "forge", são neutros) — só os var() backing values mudam.

## Parte A — Rename Protocol → Protocol

### A1. Copy visível ao utilizador (PT/EN)
- `src/routes/welcome.tsx`: chip "Protocol" → "Protocol"; H1 "Como vais usar o Protocol?" → "Como vais usar o Protocol?"
- `src/routes/terms.tsx` + `src/routes/privacy.tsx`: títulos, descrições, parágrafos legais.
- `src/routes/manual.tsx`: título "Ajuda · Protocol" + og:title + subject de email.
- `src/routes/billing.tsx` linha 327: "Protocol {tier.name}" → "Protocol {tier.name}".
- `src/server/billing.functions.ts`: `name: "Protocol Starter"` → `"Protocol Starter"`, `"Protocol Pro"` → `"Protocol Pro"`.
- `src/server/plan.functions.ts` (4 ocorrências): "Upgrade to Protocol Pro" → "Upgrade to Protocol Pro".
- `src/routes/plans.$planId.tsx` linha 842: "old Protocol structure" → "old Protocol structure".
- `src/routes/intake.$token.tsx` linha 740: "powered by Protocol" → "powered by Protocol" (sem link externo).
- `src/routes/index.tsx`: footer mailto + CTA mailto + `protocol-float` keyframe → `protocol-float`.

### A2. Identificadores internos (refactor neutro)
- CSS vars em `src/styles.css`: `--protocol-canvas/surface/subtle/pill/ink-*/accent/accent-soft/line/edge/warning` → `--protocol-*`. `@theme inline` mappings: `--color-protocol-accent` → `--color-protocol-accent`. Comentários "Protocol design system tokens" → "Protocol design system tokens".
- Animação `@keyframes protocol-float` (em `src/routes/index.tsx`) → `protocol-float`.
- HTML id `protocol-stages-lane` (em `clients_.$clientId.tsx`, 3 lugares) → `protocol-stages-lane`.
- Comentário `Protocol dashboard` em `src/server/feedback.functions.ts` → `Protocol dashboard`.
- Window flag `__protocolFetchPatched` em `src/hooks/use-auth.tsx` → `__protocolFetchPatched`.
- `LOCALE_STORAGE_KEY = "protocol.locale"` → `"protocol.locale"`.
- localStorage/IDB keys (intake drafts, assessment focus/collapse, theme legacy migration target):
  - `protocol_intake_draft_*` → `protocol_intake_draft_*`
  - `protocol_intake_photo_*` → `protocol_intake_photo_*`
  - `protocol-intake` IDB DB name → `protocol-intake`
  - `protocol_assessment_*` (3 chaves) → `protocol_assessment_*`
  - `protocol_theme` legacy migration: já cobrimos no ThemeToggle, removo a leitura.

### A3. Comentários puramente neutros
**Não tocar** em "fire-and-forget", "don't forget", "forget" em frases inglesas — não são menções à brand. Search será exact-case `Protocol`/`Protocol`/`forge_`/`forge-`/`--protocol-`/`forge.app`/`protocol.locale` para evitar falsos positivos.

### A4. Memória + docs internos
- `mem/index.md`: actualizar entrada do PDF spec ("Protocol §12" → "Protocol §12 PDF spec"), e qualquer referência amber Protocol no Core que sobrou da R71.
- `mem/design/pdf-spec.md`: rename título e referências.
- `mem/design/brand-mark.md`, `brand-mark-prompt.md`: rename.
- `.lovable/r76`, `r77`, `acsm-12e-gap-report.md`, `backlog.md`, `plan.md`: substituição em massa de "Protocol"/"Protocol" → "Protocol".

### A5. Migrações SQL
- 2 ficheiros em `supabase/migrations/` mencionam "forge" só em **comentários SQL**. Migrations são read-only — deixo como estão (nota histórica). Confirmo que nenhuma string "forge" vive em dados (column names, enum values).

## Parte B — Smoke QA dos 3 temas

Faço browser smoke nos 3 temas (Deep / Sage / Mist) nas rotas:
- `/` (landing)
- `/login` ou `/auth`
- `/dashboard`
- `/me` (preview mode com cliente selecionado)
- `/plans/$id` (primeiro plano disponível)

Para cada combinação tiro screenshot full-page, e olho especificamente para:
1. **Contraste muted-foreground sobre card** — leio o token computado e comparo com o card. Marco AA fail se contraste < 4.5 para texto normal ou < 3 para texto secundário grande.
2. **Acento terracota presente em CTAs / focus / chips activos** sem invadir áreas grandes (regra ~10%).
3. **Texto branco-creme legível** sobre os deep/sage backgrounds.

### B1. Mobile Safari /me a 375px
Viewport 375×812, navegação `/me`, screenshot, verificação de overflow horizontal e tap targets.

### B2. PDF export
Faço um download do plan PDF (rota /plans/$id → botão Download PDF), converto a PDF para JPG via `pdftoppm`, abro a primeira página e confirmo que continua a usar a paleta amber `#D4A574` (agora `--protocol-accent`, mesmo hex). Reporto issues.

## Entregáveis

1. PR de rename (Parte A) — sem mudar comportamento, sem tocar lógica.
2. Relatório de smoke em chat com screenshots por tema/rota.
3. Lista de fixes de contraste/overflow encontrados — se forem triviais, aplico no mesmo round; se forem mais profundos, ficam como to-do priorizado em `.lovable/backlog.md`.
4. Memória actualizada (R71 PDF spec rename, comentários Protocol→Protocol).

## Fora de scope

- Adquirir/configurar domínio real `protocol.{tld}`.
- Reescrever copy legal de fundo (mantém-se literal, só troca o nome).
- Mudar o esquema amber do PDF para terracota — fica como está, é o mark histórico do produto.
