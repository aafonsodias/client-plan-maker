## Problema

O ecrã de loading do `AppShell` (mostrado enquanto a sessão carrega ou quando `user` ainda não está pronto) é só um pontinho pulsante (`AppShell.tsx` linhas 117–125). Como aparece em todas as rotas autenticadas durante o boot e em hard-refresh, dá a sensação de "às vezes não há logo".

A razão histórica do dot foi evitar mismatch de hidratação SSR/CSR — qualquer texto traduzido divergia entre `en` (SSR) e `pt-PT` (cliente). O `<BrandMark/>` é puramente visual (SVG, sem cópia traduzida), por isso é seguro renderizá-lo no fallback.

## Mudança

Em `src/components/AppShell.tsx`, no bloco `if (loading || !user)`:

- Substituir o `<span>` pulsante por um `<BrandMark size="lg" />` centrado vertical/horizontal, com `animate-pulse` subtle no wrapper para indicar actividade.
- Manter `suppressHydrationWarning` no container e o `<span className="sr-only">` com `t("actions.loading")` para acessibilidade.
- Sem texto visível → continua locale-neutral, SSR e primeiro paint client batem certo.

Nada mais é tocado. Sem novas chaves i18n, sem mudanças de rota.