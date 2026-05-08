# Fix "Ver →" não navega no BriefMinimumSheet

## Diagnóstico

O handler `onJumpToSection` (linha 3390 de `src/routes/clients_.$clientId.tsx`) faz apenas `document.getElementById(\`sec-${sid}\`)?.scrollIntoView(...)`. Falha em três cenários:

1. **Modo Focus está ativo por defeito** — só a secção `activeId` é renderizada. As outras (anthro, readiness, performance, screen…) nem existem no DOM, logo `getElementById` retorna `null` e nada acontece.
2. **`identity` aponta para `sectionId: "client-overview"`** (em `src/lib/brief-minimum.ts:92`), mas `client-overview` é um `data-tour`, não um `id`. Não há `#sec-client-overview` no DOM.
3. Mesmo em modo "ver tudo", se a secção estiver colapsada o scroll vai para o cabeçalho mas o conteúdo continua escondido.

## Solução

### 1. `src/routes/clients_.$clientId.tsx`
Substituir o handler ingénuo por um que dispare um `CustomEvent('assessment:jump', { detail: { sectionId } })` no `window` antes de fechar o sheet. Tratar `client-overview` como caso especial → scroll para `[data-tour="client-overview"]`.

### 2. Dentro de `AssessmentTabs` (mesmo ficheiro, ~linha 3640)
Adicionar um `useEffect` que escuta `assessment:jump`:
- Se `sectionId` ∈ `sectionIds`: `setActiveId(sectionId)` (sai automaticamente do focus mode na secção certa) e `ctx.setOpen(sectionId, true)`.
- A seguir, num `requestAnimationFrame` (para esperar o re-render), faz `document.getElementById(\`sec-${sectionId}\`)?.scrollIntoView({ behavior: "smooth", block: "start" })`.
- Cleanup do listener no unmount.

### 3. `src/lib/brief-minimum.ts`
Manter `sectionId: "client-overview"` para o item `identity` (é o anchor correto do cartão de identidade no topo) — o handler do passo 1 já trata este caso à parte via `[data-tour="client-overview"]`.

## Ficheiros tocados

- `src/routes/clients_.$clientId.tsx` (handler `onJumpToSection` + listener dentro de `AssessmentTabs`)

Sem mudanças de schema, sem nova i18n.

## QA

1. Abrir `/clients/$id`, clicar "Iniciar briefing IA" → sheet abre.
2. Clicar "Ver" em **Sexo, data nascimento…** → fecha sheet, faz scroll suave para o cartão de identidade no topo.
3. Clicar "Ver" em **Local de treino…** → muda para a secção `training` (sai do focus de `meds`), abre-a, faz scroll.
4. Clicar "Ver" em **FC repouso…** → muda para `performance`, abre, scroll.
5. Repetir em modo "ver tudo" (sem focus) → continua a abrir secção colapsada e a fazer scroll.