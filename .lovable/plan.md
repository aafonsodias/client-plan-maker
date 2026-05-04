
# Round 43 — Polish: identity, dedupe, persistent CTAs, honest loading

Quatro correções pequenas mas de alto impacto, todas dentro do client detail page e do AppShell. Sem mudanças de DB, sem servidor, sem PDF.

## 1. Badge de "verificado" estilo Instagram no header (não no avatar do cliente)

**Problema**: a `Sparkles` em pílula amber está no avatar do **cliente** dentro da página, mas o que queres é o tique azul/amber no **teu próprio avatar**, em cima à direita do AppShell, depois do login.

**Solução**:
- Em `src/components/AppShell.tsx`: ao lado / sobreposto ao botão do menu de utilizador (canto superior direito), quando `isFounder === true`, renderizar um `<BadgeCheck />` (já está importado) num pequeno disco com glow amber (`#D4A24C`), posicionado `-top-1 -right-1` sobre o avatar do utilizador autenticado. Usa o mesmo amber do brand mark — não o azul do Instagram, para ser nosso e não cópia.
- Remover a pílula `Sparkles` do `ClientAvatarUpload` (foi posta ali por engano em R41) — `showFounderDot` deixa de ser usado mas o prop fica para compatibilidade até R44.
- A11y: `aria-label="Conta verificada — fundador"`, `title` igual.

## 2. Dedupe da chip "Avaliação 86%"

**Problema**: a mesma informação aparece duas vezes — na **KPI strip** (chip `AVALIAÇÃO 86% · 04/05`) e dentro da **AssessmentSection colapsada** (`✓ Avaliação · 86% completo`). Redundante.

**Solução**:
- Manter **apenas** a chip dentro da janela colapsada da `AssessmentSection` (é onde faz sentido contextual — está a descrever aquilo que aquela secção contém).
- Remover o `<button>` `AVALIAÇÃO {coveragePct}% · {dateShort}` da KPI strip (lines 1593–1609 de `clients_.$clientId.tsx`). A KPI strip fica com **ACSM** + **Recovery**, mais limpa.
- O click-to-scroll para `#sintese-da-avaliacao` continua disponível através da chip dentro da secção colapsada.

## 3. CTA do Stage 3 (e 4 e 5) **sempre visível**, mesmo colapsado, com nome correto

**Problema**: Quando o utilizador colapsa Stage 3 (chevron-right), o botão "Gerar Blueprint" desaparece porque vive dentro do bloco `{open && (...)}` no header do `StageCard`. Resultado: para gerar tens de expandir primeiro. Além disso o nome "Gerar Blueprint" mistura EN/PT — devia ser "Gerar plano-mestre" (igual ao title do stage, em PT).

**Solução em `src/components/StageCard.tsx`**:
- Mover o bloco `{onApprove && status !== "approved" && !hideHeaderApprove && (...)}` para **fora** do `{open && (...)}`. Continua oculto quando `status === "approved"` ou quando estamos em modo "view draft" expandido (`hideHeaderApprove`), mas fica visível quando colapsado e ainda não gerado. O botão `Regenerate` continua só visível quando expandido (faz sentido: regenerar é uma acção de revisão).
- Adicionar nova prop opcional `primaryCtaWhenCollapsed?: boolean` (default true) caso queiramos voltar a esconder em algum lado.

**Solução em `src/i18n/locales/pt/assessment.json` (chave `detail.stage.generate_blueprint`)**:
- "Gerar Blueprint" → "Gerar plano-mestre →"
- "Gerar Microcycle" / equivalente → "Gerar semana-tipo →"
- "Gerar Progressions" → "Gerar progressões →"
- EN mantém "Generate blueprint", "Generate week", "Generate progressions".

## 4. Loading honesto e inline dentro do próprio Stage card

**Problema**: Carregaste "Gerar", apareceu uma caixa branca a meio do ecrã (o `toast.loading`), depois desapareceu. O Stage 3 em si não mostrou nada de relevante além de uma barrinha de 0.5px no topo. Não dá confiança.

**Solução**:

**a) Suprimir o toast** branco para os 3 stages de geração (blueprint / microcycle / progressions). Mantemos `toast.success` / `toast.error` no fim, mas removemos o `toast.loading(...)` no início — a UI inline torna-o redundante.

**b) Substituir o `generating` branch do `StageCard.tsx`** por um painel mais informativo (~120px alto) que mostra:
   - Título: `Stage 3 — Plano-mestre · a gerar`
   - Linha de status que **roda** (a cada ~1.6s) através de copy honesta do que a IA está a fazer:
     - blueprint: ["A consultar ACSM e MEV/MAV/MRV…", "A escolher arquétipos de sessão…", "A balancear volume por padrão de movimento…", "A redigir o plano-mestre…"]
     - microcycle: ["A traduzir blueprint em semana 1…", "A escolher exercícios da biblioteca FORGE…", "A calcular RPE e descansos…"]
     - progressions: ["A modelar progressão semana a semana…", "A aplicar deload na última semana…", "A escrever justificações…"]
   - Pequeno spinner amber + barra de progresso "indeterminate shimmer" mais visível (8px alto, gradient amber, já existe — só engrossar e adicionar % aproximado opcional).
   - Texto auxiliar: `Estimado ~30s. Podes manter esta página aberta.`
   - Estes labels ficam no `assessment.json` em `detail.stage.loading_steps.{blueprint|microcycle|progressions}: string[]`.

**c) Garantir que o card faz `scrollIntoView({ block: 'center' })`** quando entra em estado `generating`, para que o utilizador veja o sítio onde a coisa está a acontecer (e não procure pela caixa branca que desapareceu).

**d) `runStage` em `clients_.$clientId.tsx`**: setar `stageBusy` **antes** do try, e chamar `cardRef.current?.scrollIntoView(...)` no efeito que reage a `stageBusy`. Adicionar um `useRef` por stage ou um `id={`stage-${n}`}` e usar `document.getElementById`.

## Out of scope (parked para R44)

- Real progress percentage do servidor (precisava de SSE / polling de generation_log).
- Tour update para apontar à nova badge do header.
- Mudar a Sparkles do AppShell pill (já existente) para BadgeCheck — fica só o disco verificado, e o pill "Founder" mantém-se à esquerda do nome.

## Files to edit

- `src/components/AppShell.tsx` — adicionar BadgeCheck verificado sobre o avatar do user (top-right do header).
- `src/components/ClientAvatarUpload.tsx` — remover render do Sparkles dot (manter prop por compat).
- `src/routes/clients_.$clientId.tsx` — remover chip duplicada da KPI strip; suprimir `toast.loading` em runStage; setar `stageBusy` cedo; scroll-into-view do stage card.
- `src/components/StageCard.tsx` — CTA primária sempre visível em colapsado; novo painel `generating` com rotação de copy.
- `src/i18n/locales/pt/assessment.json` + `src/i18n/locales/en/assessment.json` — nomes corretos dos botões + arrays de loading steps.

## QA

- 1544×984 desktop: header mostra BadgeCheck amber sobreposto ao avatar do user para `aafonsodias@gmail.com`; logout/outro user → sem badge. Cliente page: KPI strip só com ACSM+Recovery; "Avaliação 86% completo" só dentro da AssessmentSection colapsada. Stage 3 colapsado mostra `Gerar plano-mestre →`. Click → card expande para `generating` panel com copy a rodar; toast branco desaparece. Após sucesso, card vira "ready" / "approved" naturalmente.
- 375px Mobile Safari: badge não tapa o menu; CTA do stage colapsado quebra para nova linha sem cortar.
- PT + EN: copy de loading rotativa traduzida nos dois.
- Logging: confirmar via console que `generation_log` continua a registar (não tocámos em servidor).
