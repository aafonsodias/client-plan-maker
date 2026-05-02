## Auditoria

Reproduzi o erro mostrado em runtime: **hydration mismatch** entre SSR e cliente. A mensagem do React aponta dois sintomas:

1. `<html lang="en">` no SSR vs `lang="pt"` no cliente.
2. Texto `Loading…` (SSR) vs `A carregar…` (cliente) dentro do `<AppShell>` quando a sessão de auth ainda está a carregar.

### Causa raiz única

O i18n usa `i18next-browser-languagedetector` com `order: ["localStorage", "navigator"]`. Nenhuma destas fontes existe no servidor → SSR resolve sempre para `fallbackLng: "en"`. No browser, o detector lê `localStorage["forge.locale"] = "pt"` e troca para PT após hidratação. Como vários componentes (AppShell, headers, loaders) usam `useTranslation()` no primeiro render, todo o markup traduzido fica diferente em SSR vs cliente.

Este é o único erro relevante no console — o aviso `RESET_BLANK_CHECK` é ruído da iframe da Lovable e pode ser ignorado.

## Correção

Estratégia: **renderizar SSR e primeiro paint do cliente sempre no `fallbackLng`** (igual ao servidor) e só ativar o idioma persistido depois da hidratação. É a solução padrão e mínima — sem cookies, sem alterar SSR profundo.

### Mudanças

1. **`src/i18n/index.ts`**
   - Remover `LanguageDetector` da inicialização ou desativar deteção até hidratar.
   - Iniciar sempre com `lng: "en"` (igual ao SSR).
   - Exportar uma função `applyPersistedLocale()` que lê o `localStorage` e chama `i18n.changeLanguage()`. Continua a ouvir `languageChanged` para sincronizar `<html lang>`.

2. **`src/routes/__root.tsx`**
   - Dentro de `RootComponent`, num `useEffect` (corre só no cliente, depois da hidratação), invocar `applyPersistedLocale()`. Isto garante que o primeiro render do cliente é idêntico ao SSR (`en`), evitando mismatch; logo a seguir o idioma do utilizador é aplicado e a UI re-renderiza.

3. **Loaders consistentes** (limpeza pequena, mesma sessão):
   - Substituir os `Loading…` hardcoded em `src/routes/plans.$planId.tsx`, `src/routes/plans.index.tsx`, `src/routes/settings.tsx`, `src/routes/log.$token.tsx`, `src/routes/plans.$planId.sessions.tsx`, `src/routes/plans.$planId.progressions.tsx` e `src/routes/forge.tsx` por `t("actions.loading")` (ou string única). Mantém UX coerente assim que a correção principal for aplicada — sem isto, voltaríamos a ter dissonância PT/EN visual no app.

### O que NÃO mexer

- `lang="en"` no `<html>` continua estático — está correto, dado que SSR e primeiro paint cliente são EN. O `useEffect` de sincronização atualiza `document.documentElement.lang` quando o utilizador troca para PT, sem hydration mismatch.
- `AuthProvider`, `CurrencyProvider`, e o resto do shell ficam intactos.
- Nenhuma alteração de schema, RLS, ou server functions.

## Resultado esperado

- Sem `Hydration failed` no console.
- Utilizador PT continua a ver a app em PT (com um flash imperceptível de EN no primeiro frame, que é o trade-off aceite por SSR sem cookies).
- Sem regressões noutras rotas.
