## O que vou fazer

### 1. Bugs detetados (scan)

**Bug A — Hydration mismatch no `CurrencyMenu`** (já no runtime errors)
O servidor renderiza sempre `EUR / "Currency"` (porque `i18n.lng = "en"` e `useCurrency()` usa fallback `EUR` em SSR), mas o cliente, no primeiro paint, lê `localStorage` + `navigator.language` e mostra `USD / "Moeda"`. Isto rebenta a hidratação em qualquer página com `<PriceTag>` (toda a landing).

Fix: tal como o `i18n` já faz (lng inicial = "en", muda só depois de hidratar), o `CurrencyProvider` tem de inicializar com o **mesmo valor que o servidor renderizou** (`EUR`) e só aplicar o `localStorage`/`navigator` num `useEffect`. O `PriceTag` também passa a usar `aria-label` traduzido só depois de hidratar (ou fica em EN no primeiro paint).

**Bug B — 3 chaves i18n em falta** (consola)
`plan:landing.mockups.history_title`, `history_subtitle`, `delta_label` faltam nos JSON de PT e EN. Estão a ser usadas no `LogbookHistoryMockup` da landing com fallback inline, mas isso polui a consola e em PT mostra a string EN. Adicionar as chaves nos dois locales.

**Bug C — `<button>` dentro de `<button>` no Currency popover (potencial)**
Verificar: no `PriceTag` o trigger é `<button>`, e o `PopoverTrigger asChild` injeta props nele — está OK porque o `CurrencyMenu` já não envolve em span. Mantém-se, só auditoria.

### 2. Renomear "Concierge"

"Concierge" é frio e estranho. Proponho **"Guia"** (PT) / **"Guide"** (EN) — curto, honesto, descreve o que faz (mostra onde estão as coisas). Alternativas que rejeitei: "Ajuda" (genérico demais), "Atalhos" (não é só isso), "Copiloto" (overhyped).

Mudanças:
- `ConciergeDock` → `GuideDock` (ficheiro renomeado; export idem).
- Botão flutuante: aria-label `"Abrir guia"`, header `"GUIA"`, placeholder `"Onde está…?"` (mantém).
- Mensagem de boas-vindas mais curta e humana, em vez do parágrafo cerimonial atual (ver imagem 2): _"Olá. Diz-me o que procuras na app — eu mostro-te onde está."_
- `askConcierge` server fn fica com o nome interno (não vale a pena partir tipos), mas o system prompt deixa de dizer "concierge" e passa a "guia da app".
- Opcional: chips de sugestão começam vazios — só aparecem depois da 1ª pergunta (a lista de 3 chips iniciais "Ver Painel / Manual / Configurar Perfil" do screenshot é ruído).

### 3. Onde começa o "assessment slides"

Resposta direta para o utilizador (não envolve código): o início está em **Clientes → abrir um cliente**. A rota é `/clients/$clientId` (ficheiro `src/routes/clients_.$clientId.tsx`). Aí aparece o `ClientDetail` com as várias secções (PAR-Q, Antropometria, Objetivo SMART, Treino, Estilo de vida, Nutrição, Mobilidade, Postura, Screen de movimento, Histórico, Performance) renderizadas como `StageCard`s — esse é o "wizard" de assessment. Para um cliente novo: `/clients` → botão "Adicionar cliente". Para o cliente preencher por ele próprio, gera-se um link de intake (`IntakeLinkPanel`) que abre `/intake/:token`.

Vou também adicionar isto às rotas que o Guia conhece (`src/lib/concierge-routes.ts`) para que possa responder esta pergunta sozinho.

### Ficheiros tocados

- `src/contexts/CurrencyContext.tsx` — init SSR-safe + efeito client.
- `src/components/CurrencyMenu.tsx` — `aria-label`/title só client-side ou em EN no SSR.
- `src/i18n/locales/{en,pt}/plan.json` — 3 chaves landing.mockups.
- Renomear `src/components/ConciergeDock.tsx` → `src/components/GuideDock.tsx` + import em `AppShell.tsx`.
- `src/lib/concierge-routes.ts` — acrescentar hint sobre `/clients/$clientId` e fluxo de assessment.
- `src/server/concierge.functions.ts` — system prompt: "guia" em vez de "concierge", boas-vindas mais curta.

### Fora de scope

Não vou tocar no nome do server fn (`askConcierge`) nem no path do ficheiro `concierge.functions.ts` para não partir tipos. Só a UI muda de nome.
