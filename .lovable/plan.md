## Defaults assumidos (avise se quiser mudar)

- **Domínio público**: ainda não temos. Removo `https://forge.app` (link externo no intake e index) e troco mailtos `hello@forge.app` por `hello@protocol.app` como placeholder. Diga-me um domínio real depois e faço sweep dedicado.
- **Chaves locais (`forge_*`, `forge-intake` IDB, `forge.locale`)**: rename limpo, sem shim. Em beta privado o impacto é uma vez.
- **Tokens CSS `--forge-*` e prefixo `--color-forge-accent`**: renomeio para `--protocol-*` / `--color-protocol-accent`. Os utilities Tailwind `bg-canvas`, `text-ink-primary`, `bg-pill`, etc. **mantêm o nome** (não dizem "forge", são neutros) — só os var() backing values mudam.

## Parte A — Rename Forge → Protocol

### A1. Copy visível ao utilizador (PT/EN)
- `src/routes/welcome.tsx`: chip "Forge" → "Protocol"; H1 "Como vais usar o Forge?" → "Como vais usar o Protocol?"
- `src/routes/terms.tsx` + `src/routes/privacy.tsx`: títulos, descrições, parágrafos legais.
- `src/routes/manual.tsx`: título "Ajuda · Forge" + og:title + subject de email.
- `src/routes/billing.tsx` linha 327: "Forge {tier.name}" → "Protocol {tier.name}".
- `src/server/billing.functions.ts`: `name: "Forge Starter"` → `"Protocol Starter"`, `"Forge Pro"` → `"Protocol Pro"`.
- `src/server/plan.functions.ts` (4 ocorrências): "Upgrade to Forge Pro" → "Upgrade to Protocol Pro".
- `src/routes/plans.$planId.tsx` linha 842: "old Forge structure" → "old Protocol structure".
- `src/routes/intake.$token.tsx` linha 740: "powered by Forge" → "powered by Protocol" (sem link externo).
- `src/routes/index.tsx`: footer mailto + CTA mailto + `forge-float` keyframe → `protocol-float`.

### A2. Identificadores internos (refactor neutro)
- CSS vars em `src/styles.css`: `--forge-canvas/surface/subtle/pill/ink-*/accent/accent-soft/line/edge/warning` → `--protocol-*`. `@theme inline` mappings: `--color-forge-accent` → `--color-protocol-accent`. Comentários "FORGE design system tokens" → "Protocol design system tokens".
- Animação `@keyframes forge-float` (em `src/routes/index.tsx`) → `protocol-float`.
- HTML id `forge-stages-lane` (em `clients_.$clientId.tsx`, 3 lugares) → `protocol-stages-lane`.
- Comentário `Forge dashboard` em `src/server/feedback.functions.ts` → `Protocol dashboard`.
- Window flag `__forgeFetchPatched` em `src/hooks/use-auth.tsx` → `__protocolFetchPatched`.
- `LOCALE_STORAGE_KEY = "forge.locale"` → `"protocol.locale"`.
- localStorage/IDB keys (intake drafts, assessment focus/collapse, theme legacy migration target):
  - `forge_intake_draft_*` → `protocol_intake_draft_*`
  - `forge_intake_photo_*` → `protocol_intake_photo_*`
  - `forge-intake` IDB DB name → `protocol-intake`
  - `forge_assessment_*` (3 chaves) → `protocol_assessment_*`
  - `forge_theme` legacy migration: já cobrimos no ThemeToggle, removo a leitura.

### A3. Comentários puramente neutros
**Não tocar** em "fire-and-forget", "don't forget", "forget" em frases inglesas — não são menções à brand. Search será exact-case `Forge`/`FORGE`/`forge_`/`forge-`/`--forge-`/`forge.app`/`forge.locale` para evitar falsos positivos.

### A4. Memória + docs internos
- `mem/index.md`: actualizar entrada do PDF spec ("FORGE §12" → "Protocol §12 PDF spec"), e qualquer referência amber FORGE no Core que sobrou da R71.
- `mem/design/pdf-spec.md`: rename título e referências.
- `mem/design/brand-mark.md`, `brand-mark-prompt.md`: rename.
- `.lovable/r76`, `r77`, `acsm-12e-gap-report.md`, `backlog.md`, `plan.md`: substituição em massa de "Forge"/"FORGE" → "Protocol".

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
4. Memória actualizada (R71 PDF spec rename, comentários FORGE→Protocol).

## Fora de scope

- Adquirir/configurar domínio real `protocol.{tld}`.
- Reescrever copy legal de fundo (mantém-se literal, só troca o nome).
- Mudar o esquema amber do PDF para terracota — fica como está, é o mark histórico do produto.
