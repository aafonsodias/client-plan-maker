## Goal
Eliminar de vez o erro "No QueryClient set, use QueryClientProvider to set one" ao abrir `/clients/$id` (ex: cliente "André Periquito").

## Root cause analysis
- O grep exaustivo confirma que **nenhum ficheiro em `src/`** importa `@tanstack/react-query`, `useMutation`, `useQuery`, `useQueryClient` ou `useSuspenseQuery`. O `ReassessmentSheet.tsx` já foi refactored para `useState + await recordMeasurement`.
- Mesmo assim a consola reporta o erro no chunk da rota do cliente. Duas hipóteses sobreviventes: (a) bundle ainda em cache antes do rebuild, (b) algum import dinâmico/lazy a puxar `react-query` indirectamente.
- A dependência `@tanstack/react-query@5.99` está instalada e disponível para qualquer módulo a resolver em runtime.

## Fix (single edit, defense-in-depth)
Montar `QueryClientProvider` no `__root.tsx`. É a recomendação oficial do TanStack Start quando a `@tanstack/react-query` consta em `package.json` — qualquer hook (directo ou transitivo) passa a encontrar o cliente.

### `src/routes/__root.tsx`
- Adicionar `import { QueryClient, QueryClientProvider } from "@tanstack/react-query";`
- Criar `const queryClient = new QueryClient();` ao nível do módulo do ficheiro de rota (esta app não tem SSR per-request a partilhar estado entre utilizadores no mesmo processo, e os componentes não usam queries autenticadas via QC; mantemos simples).
- Em `RootComponent`, envolver o `<I18nextProvider>` (ou imediatamente acima de `<Outlet/>`) com `<QueryClientProvider client={queryClient}>`.

```text
RootComponent
└── QueryClientProvider
    └── I18nextProvider
        └── AuthProvider
            └── ...providers...
                └── Outlet
```

Não tocar em mais nada: nem na função `getRouter`, nem nas rotas filhas.

## Out of scope / não tocar
- `ReassessmentSheet.tsx` (já refactored, sem react-query).
- `ProtocolRail.tsx`, `NextMealCue.tsx`, `clients_.$clientId.tsx` (sem react-query).
- Não remover a dependência do `package.json` neste round (evitar churn de lockfile).
- Não introduzir `ensureQueryData` / `useSuspenseQuery` em loaders existentes — fora do escopo.

## Verification
Após o edit:
1. Abrir `/clients/05237593-…` (André Periquito) e confirmar render normal.
2. Clicar no chip "Reavaliação" no `ProtocolRail` → `Sheet` deve abrir e gravar.
3. Consola limpa do erro `No QueryClient set`.

Estimativa: 1 edit, ~3-5 créditos.
