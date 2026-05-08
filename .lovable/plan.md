
# Ver como cliente — modo global de pré-visualização

## A estratégia é boa? Sim, e melhor do que parece.

O que está a propor é o padrão **"impersonation / view-as"** que ferramentas sérias (Stripe, Intercom, Linear) usam para QA de produto. Em vez de andar a saltar entre páginas isoladas a tentar imaginar o que o cliente vê, ativa um **modo persistente** que reescreve toda a navegação como se fosse o cliente. Vantagens:

1. **Você organiza-se**: vê em tempo real, página a página, exatamente o que o cliente vê — e decide o que cortar/adicionar.
2. **Acumula decisões**: cada página visitada em modo cliente vira uma decisão de design ("isto fica, isto esconde-se, isto reescreve-se em linguagem de cliente").
3. **Base técnica para o produto final**: a mesma flag (`viewAs=clientId`) que o treinador usa para QA é a flag que o cliente real usa quando faz login. **Construímos uma vez, usamos duas vezes.**

## Como o cliente terá acesso só ao que decidirmos (a parte que pediu para ensinar)

Há três camadas a separar:

1. **Camada de rotas (URL)** — controlo na navegação
   Cada rota declara se é `trainer-only`, `client-visible`, ou `both`. O `__root.tsx` lê o modo atual (trainer normal vs. view-as-client vs. cliente real autenticado) e:
   - Em modo cliente: esconde do menu/header tudo o que é trainer-only.
   - Se o cliente tentar abrir uma URL trainer-only diretamente: `redirect → /me`.

2. **Camada de dados (RLS no Supabase)** — controlo na base de dados
   As políticas RLS já garantem que `clients.user_id = auth.uid()` só vê os próprios dados. Isto **já está**. O modo "view as" do treinador usa as credenciais do treinador (vê tudo), mas a UI finge que é o cliente — é só visual. Quando o cliente real faz login, RLS bloqueia tudo o resto automaticamente.

3. **Camada de UI (componentes)** — controlo no que se renderiza
   Componentes consultam `useViewMode()` e escondem botões de admin, edição, custos, etc. Em modo preview, escrita está bloqueada (já fazemos isto no `/me`).

**Regra de ouro**: nunca confiar só na UI. Cada uma das três camadas tem de bloquear independentemente. UI esconde → router redirige → RLS recusa.

## Plano em 3 fatias (cada uma entrega valor sozinha)

### Fatia 1 — Infra do "view as" (esta ronda)

- **`ViewAsContext`** (`src/contexts/ViewAsContext.tsx`): guarda `{ mode: "trainer" | "preview", clientId?, client? }`. Persistido em `sessionStorage` para sobreviver a refresh mas não a logout.
- **`ViewAsBar`**: barra âmbar fixa no topo quando ativo. Mostra "A ver como **{nome do cliente}**", dropdown para trocar de cliente, botão "Sair do modo cliente". Aparece em **todas** as páginas (montada no `__root.tsx`).
- **Botão "Ver como cliente"** ao lado do "+ Novo cliente" no `/dashboard`. Abre um popover com lista de clientes (search + avatar) e ativa o modo.
- **Hook `useViewAs()`**: `{ isPreview, clientId, exit, switchClient }` para qualquer componente consumir.

### Fatia 2 — Mapa de rotas e auditoria página a página (próximas rondas, contigo a conduzir)

Crio um registo de visibilidade em `src/lib/route-visibility.ts`:

```ts
export const ROUTE_VISIBILITY = {
  "/dashboard": "trainer-only",      // → redireciona para /me em preview
  "/me": "client-visible",           // já é a casa do cliente
  "/clients/$clientId": "trainer-only",
  "/plans/$id": "shared-readonly",   // cliente vê, sem custos/AI
  "/log/$token": "client-visible",
  "/schedule": "shared-readonly",    // cliente vê só as suas marcações
  "/billing": "trainer-only",
  // ...
} as const;
```

À medida que percorre cada página em modo "ver como cliente", decidimos juntos:
- **`trainer-only`** → redirect para `/me`.
- **`client-visible`** → mostra como está.
- **`shared-readonly`** → mesma rota, componentes consultam `isPreview` para esconder custos, botões de regenerar AI, edição, etc.

Para `shared-readonly`, em vez de duplicar páginas, criamos pequenos wrappers `<TrainerOnly>{...}</TrainerOnly>` e `<ClientFacing>{...}</ClientFacing>` que mostram/escondem secções. Mantém uma única source of truth por página.

### Fatia 3 — Cliente real autenticado (quando o produto for partilhar)

- Login do cliente via magic-link (Supabase OTP, sem password).
- `__root.tsx` deteta: se `clients.user_id == auth.uid()` e o utilizador não tem `profiles` (não é treinador), entra automaticamente em modo "self" (visualmente igual ao preview, mas com escrita ativa e RLS a proteger).
- Migrar o `/log/$token` (atualmente token público) para preferir auth quando disponível.

Esta fatia **não é** desta ronda. É o destino. As fatias 1 e 2 são pré-requisitos limpos.

## Detalhes técnicos (para referência)

**Ficheiros a criar nesta ronda (Fatia 1):**
- `src/contexts/ViewAsContext.tsx` — provider + hook
- `src/components/ViewAsBar.tsx` — barra âmbar fixa global
- `src/components/ViewAsClientPicker.tsx` — popover com lista de clientes
- `src/lib/route-visibility.ts` — esqueleto vazio, preenchemos na Fatia 2

**Ficheiros a alterar nesta ronda:**
- `src/routes/__root.tsx` — montar `<ViewAsProvider>` e `<ViewAsBar />`
- `src/routes/dashboard.tsx` — botão "Ver como cliente" ao lado do "+ Novo cliente"
- `mem/index.md` — adicionar regra Core sobre o modo view-as (3 camadas: route-visibility + RLS + UI)

**O que não muda nesta ronda:**
- Nada de RLS novo.
- Nada de magic-link.
- Nada de redirects automáticos (só os fazemos quando classificarmos cada rota na Fatia 2).
- O `/me` atual continua a funcionar exatamente como está.

## Pergunta antes de avançar

Quer que o botão no dashboard seja **"Ver como cliente"** (texto cheio) ou **"Modo cliente"** (mais curto, cabe melhor ao lado do "+ Novo cliente" em ecrãs estreitos)? Ambos com ícone `Eye`.

Se aprovar, implemento a Fatia 1 e começamos a percorrer rotas juntos na próxima mensagem.
