# Round 47 — Stabilization

Sem features novas. Triagem dos P0/P1 que ficaram a sangrar de R45/R46. Lista de QA no fim — só fechamos com tudo verde.

## A. PDF — rebrand + layout + print

Ficheiro principal: `src/lib/pdf.ts` (jsPDF, landscape A4, render directo). NÃO há template HTML/Puppeteer — é tudo desenho jsPDF. A "página de print preto" não vem de `@media print` partido; vem de **falta de logo do trainer** → `theme = LIGHT_THEME` mas `branding.business_name` cai no fallback `"FORGE"`. Quando o utilizador imprime via browser, o que ele vê é a rota `/plans/$id` com background `--background` escuro, não o PDF — esse é outro bug, ver §A6.

1. **Limpar fallback de marca** (`src/lib/pdf.ts:266`):  
   `branding.business_name || branding.full_name || "FORGE"` → `… || "PROTOCOL"`. Comentários §12 (linhas 187-197) de `FORGE PDF spec` → `PROTOCOL PDF spec`. Token `accent` mantém-se (#E8A547 ambar — brand consistency).

2. **Tagline `"Quod Tango Muto"`** vem da BD: `profiles.tagline` da row do André. Não é hardcoded em lado nenhum (`rg` confirmou). Acção:  
   a. Migration que faz `update profiles set tagline = null where tagline = 'Quod Tango Muto'`.  
   b. Em `src/routes/settings.tsx:127` adicionar placeholder `"Ex.: Evidence-based training"` e helper text "Aparece no header do PDF. Deixa em branco se não quiseres tagline."

3. **Logo "AP" no PDF** = `logo_data_url` do trainer (Settings → Logo). Não é o BrandMark da app. Acções:  
   a. Quando `branding.logo_data_url` é null, em vez de não desenhar logo, desenhar o Protocol mark P (rasterizado) — criar `src/assets/protocol-mark-print.png` (export 256×256 PNG do SVG existente, fundo transparente, P em #1A1A1A). Importar via `?url` e fazer fetch→dataURL no início de `generatePlanPdf`.  
   b. Quando o trainer TEM logo próprio, mantém o do trainer (princípio: o PDF é dele, não nosso).

4. **Cues / reps / rest sem reticências**:  
   - `src/lib/pdf.ts` tem helper `fitText(s, maxW)` (linha 290) que **trunca com `…`**. É a raiz das reticências.  
   - Substituir o uso de `fitText` na coluna CUE (linha 919) por `splitTextToSize` com max 2 linhas e `rowH` dinâmico:  
     ```ts
     const cueLines = (doc.splitTextToSize(cueText, cueW - 6) as string[]).slice(0, 2);
     // cada linha 9pt → 10pt line-height
     ```  
   - Para colunas STATS (linha 938 — REPS/REST/RPE/TEMPO), `fitText(val, statColW - 6)` trunca `12-15` em `12-1…`. Correcção: alargar `statColW` (ver §A5) e remover `fitText` daí — usar valor cru. Se ainda não couber, reduzir font size para 8 nessa célula.  
   - **`rowH` deixa de ser fixo (18pt)**: calcular `rowH = max(18, cueLines * 10 + 8, nameLines * 10 + 8)` antes de pintar zebra/linhas S1-S4.

5. **Larguras das colunas** (linhas 835-852):  
   - Hoje: `colExW=220 + colCueW=130 + 5 stats × 36 + 4 slots × 64 = 786pt`. Usable = 770pt → `slack ≈ -16` → cue espremida.  
   - Nova distribuição: `colExW=180`, stats `SETS=24, REPS=42, REST=38, RPE=28, TEMPO=42` (174pt), `colCueW=110` flexível, **slot S1-S4 = 84pt cada** (336pt). Total = 180+110+174+336+20 = 820 → `slack` distribuído ao cue.  
   - Cabeçalho `S1  peso × reps @RPE` (linha 866) → quebrar em 2 linhas:  
     ```
     S1
     peso × reps @RPE
     ```  
     Ajustar `y += 4` para `y += 14` para acomodar header de 2 linhas.

6. **Print preview vazia (preto sólido)** — investigação extra antes do fix:  
   - O utilizador faz `Ctrl+P` em `/plans/$planId` (rota da app), não no PDF descarregado.  
   - O PDF gerado por jsPDF é descarregado, NÃO renderizado em página. Logo "13 páginas pretas" = browser a tentar imprimir a rota inteira da app com background dark.  
   - Fix: adicionar em `src/styles.css`:  
     ```css
     @media print {
       html, body { background: white !important; color: black !important; }
       .no-print, header[data-app-shell], nav, aside { display: none !important; }
       * { box-shadow: none !important; }
     }
     ```  
   - E adicionar `data-app-shell` ao header do AppShell + classe `no-print` em controlos de UI da rota plan.  
   - Mensagem clara no topo da rota plan dentro de `@media print`: "Para imprimir o plano, use o botão **Descarregar PDF** — gera o ficheiro pronto a imprimir."

## B. Forge cleanup — exaustivo

Output do `rg -i "forge|quod tango" src/`: ~30 ficheiros. Plano:

1. **`src/routes/__root.tsx:41,43,67,74`** — `head()` meta:  
   `Forge — Workout plans for personal trainers` → `Protocol — Workout plans for personal trainers`. Idem `og:title`, `twitter:title`, `apple-mobile-web-app-title: "Protocol"`.

2. **`public/manifest.webmanifest`** — `name`, `short_name` → Protocol.

3. **`src/i18n/locales/{pt,en}/plan.json`** — todas as ocorrências `Forge` / `FORGE` → `Protocol` / `PROTOCOL`. Inclui `landing.comparison.eyebrow`, `landing.why.title`, `mission`, `footer_copy: "© {{year}} Protocol"`, `q10_a` (biblioteca PROTOCOL), etc.

4. **`src/i18n/locales/{pt,en}/manual.json`, `assessment.json`, `intake.json`, `pt/review.json`** — mesmo passo.

5. **`src/routes/index.tsx`** — comentários `FORGE vs Excel…`, `<span>FORGE</span>` (linha 770) → `Protocol`. `mailto:hello@forge.app` → `mailto:hello@protocol.app` (se domínio mudar; senão deixar e marcar TODO).

6. **`src/i18n/index.ts:19`** — `LOCALE_STORAGE_KEY = "forge.locale"` → `"protocol.locale"`. Adicionar migração:  
   ```ts
   const legacy = localStorage.getItem("forge.locale");
   if (legacy && !localStorage.getItem("protocol.locale")) {
     localStorage.setItem("protocol.locale", legacy);
   }
   ```

7. **Restantes ficheiros** (`hooks/use-auth.tsx`, `contexts/*.tsx`, `server/*.ts`, `routes/welcome.tsx`, `terms.tsx`, `privacy.tsx`, `intake.$token.tsx`, `clients_.$clientId.tsx`, `lib/currency.ts`, `lib/pdf.ts`, `components/{ThemeToggle,ShareAppButton,DashboardHint,LanguageSwitcher}.tsx`, `server/{demo-seed,plan,billing,feedback,phased/*}`) — pass automatizado:  
   - **Strings visíveis e copy** → Protocol.  
   - **Comentários e identifiers internos** (`forgeRouter`, `--forge-amber` CSS var, `forge_theme` legacy) → manter, são internos. Memory já documenta isto.  
   - Critério: se o utilizador alguma vez vê o texto, muda. Se não, deixa para evitar churn.  
   - **No fim, correr `rg -i "forge|quod tango" src/ public/` e colar output no chat.** Esperado: só CSS vars `--forge-*` e `forge_theme` legacy migration.

## C. Regenerate with feedback — schema fix

Erro: `path: ["assessment", "training_location"]`, `expected: "string"`, `received: "array"`.

Origem: `src/server/plan.functions.ts:248`  
```ts
training_location: z.string().nullable().optional(),
```
mas:
- `src/server/intake.functions.ts:240` guarda como `z.array(z.string()).max(8)`.
- `src/routes/intake.$token.tsx` usa `string[]` desde sempre.
- `src/server/demo-client.functions.ts:729` envia `[persona.training_location]`.

Acção:

1. `src/server/plan.functions.ts:248` →  
   ```ts
   training_location: z.union([z.string(), z.array(z.string())])
     .nullable().optional()
     .transform((v) => Array.isArray(v) ? v : (v ? [v] : null)),
   ```  
   (aceita ambos; normaliza para array). Idem qualquer outro schema duplicado.

2. `src/server/plan.functions.ts:631` (`Location: ${data.assessment.training_location ?? "—"}`) → `${Array.isArray(...) ? data.assessment.training_location.join(", ") : data.assessment.training_location ?? "—"}`.

3. `src/lib/pdf.ts:1190` (`safe(assessment?.training_location)`) → `safe(Array.isArray(...) ? ....join(", ") : ...)`.

4. **Front-end error UX**: localizar onde o JSON Zod aparece raw (provavelmente `BlueprintAiChat.tsx` ou `MicrocyclePanel.tsx` em catch). Substituir por toast amigável:  
   - PT: "O plano não passou na validação. Tenta de novo ou reporta."  
   - EN: "The plan didn't pass validation. Try again or report."  
   Logar o erro raw em `console.error` + `generation_log` (que já existe), mas nunca mostrar JSON cru ao trainer.

## D. Workbench title

`src/i18n/locales/{pt,en}/common.json` chave `dashboard.title`:  
- PT: `"O teu Workbench"` → `"Workbench"`  
- EN: `"Your Workbench"` → `"Workbench"`

(Header da app já mostra Protocol via BrandMark.)

## E. Página do cliente — desinflamar

1. **Stages 2-4 colapsados** — hoje só mostra Stage 1 expandido.  
   - Verificar lógica em `clients_.$clientId.tsx` (linhas 2291-2640): há StageCard 1, depois `PipelineStrip` que **colapsa as 4 quando todas aprovadas**. Quando apenas Stage 1 está em curso, Stages 2-4 NÃO renderizam de todo.  
   - Adicionar render placeholder das Stages 2-4 sempre que existem mas ainda não foram geradas:  
     ```
     ◯ Stage 2 — Plano-mestre        (bloqueado: aprova Stage 1 primeiro)
     ◯ Stage 3 — Semana-tipo         (bloqueado)
     ◯ Stage 4 — Progressões         (bloqueado)
     ```  
   - Usar StageCard com `status: "placeholder"` (já existe esse status — linha 4 do StageCard.tsx).  
   - Click num stage bloqueado mostra tooltip: "Disponível depois de aprovares a fase anterior."

2. **`ThisWeekHero` (`src/components/ThisWeekHero.tsx`)** — encolher e re-focar:  
   - Remover `min-h` implícita do `p-5 sm:p-6` para `p-4`. Remover halo blob (linha 99-101).  
   - Reduzir título de `text-lg` para `text-sm`, "Esta semana" de `text-[10px]` para esconder no mobile.  
   - **Adicionar info útil**: dia da semana de hoje, próximo treino agendado (lookup em `workout_sessions` por `client_id` e `session_date >= today`), `% sessões concluídas esta semana`.  
   - Cortar copy linha 135: `"Imprima a semana atual…"` → mover para tooltip do botão Download.

3. **Remover botão duplicado de download**:  
   - `clients_.$clientId.tsx:2896` (`Descarregar Semana`) ao lado do plano — manter (é o granular por plano).  
   - `clients_.$clientId.tsx:1485` header `download_pdf` — manter (PDF completo).  
   - `ThisWeekHero` botão `Descarregar Semana {selectedWeek}` — **remover**, deixar só "Abrir plano".  
   - Resultado: 2 botões, função distinta.

## F. Out of scope

Logbook UI, Mission UI, AtlasGenie animation, tri-tema polish, pagamentos, anti-cópia, OCR, Whatsapp.

## QA antes de fechar

```text
[ ] rg -i "forge|quod tango" src/ public/  →  só vars CSS/legacy migration
[ ] Tab title diz "Protocol" em / e em /dashboard
[ ] Landing PT+EN sem Forge visível
[ ] PDF descarrega em <5s, mostra "PROTOCOL" no footer/header
[ ] PDF sem reticências em CUE/REPS/REST/RPE
[ ] PDF colunas S1-S4 com ≥84pt (~3cm) cada
[ ] PDF com Protocol mark quando trainer não tem logo
[ ] Tagline do André em DB = null  →  PDF header limpo
[ ] Ctrl+P numa rota da app mostra fundo branco e tinta preta
[ ] Regenerate with feedback funciona com training_location string OU array
[ ] Erro de validação = toast amigável, nunca JSON cru
[ ] Página do cliente: 4 StageCards visíveis (1 expandido + 3 placeholder)
[ ] Apenas 2 botões de download na página do cliente
[ ] ThisWeekHero ocupa <1/3 da viewport, mostra dia + próximo treino + %
[ ] Workbench title = só "Workbench"
```

## Files to touch (resumo)

- `src/lib/pdf.ts` (rebrand fallback, fitText→splitTextToSize, larguras colunas, rowH dinâmico, training_location array)
- `src/styles.css` (`@media print` + reset)
- `src/routes/__root.tsx` (head meta)
- `public/manifest.webmanifest`
- `src/i18n/locales/**/*.json` (Forge → Protocol)
- `src/i18n/index.ts` (LOCALE_STORAGE_KEY + migration)
- `src/i18n/locales/{pt,en}/common.json` (dashboard.title = Workbench)
- `src/server/plan.functions.ts` (training_location union+transform; Location string render)
- `src/components/ThisWeekHero.tsx` (encolher, remover botão duplicado, info útil)
- `src/routes/clients_.$clientId.tsx` (placeholder Stages 2-4)
- `src/routes/settings.tsx` (placeholder + helper para tagline)
- `src/components/AppShell.tsx` (data-app-shell + no-print classes)
- `src/components/BlueprintAiChat.tsx` ou `MicrocyclePanel.tsx` (toast amigável)
- `src/assets/protocol-mark-print.png` (criar)
- supabase migration (limpar tagline "Quod Tango Muto")
- `mem://design/brand-mark.md` actualizar (refere FORGE)

Pronto. Aprova e arranco.
