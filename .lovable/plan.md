Vou corrigir a abertura do “Abrir logbook do cliente” com um ajuste pequeno e focado.

Problema encontrado:
- O erro atual ainda aponta para `src/routes/log.$token.tsx` e para a variável `blocks`.
- A página tem `useMemo` antes dos primeiros retornos condicionais, mas ainda calcula valores normais (`totalSets`, `doneSets`, `sessionPct`) depois de um retorno condicional (`if (done) return ...`).
- Para eliminar definitivamente o erro de ordem de renderização, a página deve deixar de ter retornos condicionais antes de terminar todos os cálculos usados no render.

Plano:
1. Em `src/routes/log.$token.tsx`, mover os cálculos derivados (`totalSets`, `doneSets`, `sessionPct`) para junto do `blocks`, antes de qualquer `return` condicional.
2. Transformar o estado `done` num ramo dentro do `return` principal, em vez de retornar cedo antes de todos os cálculos do componente.
3. Manter o comportamento existente: confetti, mensagem de sessão registada, botão “Registar outra sessão” e redireção para `/me` ou `/clients/$clientId` continuam iguais.
4. Validar depois com uma verificação leve dos logs/runtime para confirmar que o erro de hooks deixou de aparecer.

Sem alterações de base de dados, sem mudanças ao botão no detalhe do cliente e sem mexer na lógica de geração do plano.