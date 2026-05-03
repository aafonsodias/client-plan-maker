## Estado: o que ainda está pendente

Auditoria rápida revelou três frentes ativas:

1. **i18n** — ~417 strings PT hardcoded ainda em `src/components` e `src/routes`. Rounds 13-16 cobriram surfaces de plano/blocos/volume/ano. Faltam: dialogs de edição (AddExerciseDialog, ImportLogDialog), painéis de cliente (IntakeLinkPanel, PlanAssessmentSheet), Paywall, FeedbackPanel, OneRepMaxCalculator, MovementPatternCard, ShareAppButton, MesocycleTableView, SessionDayView, etc. Rotas inteiras (clients, settings, billing) ainda por sweep.
2. **Backend (DB linter)** — 11 issues:
   - 4 funções `SECURITY DEFINER` executáveis por `anon` (alto risco)
   - 4 funções `SECURITY DEFINER` executáveis por `authenticated` sem necessidade
   - 1 extensão instalada em `public`
   - 2 tabelas com RLS ligado mas sem policies
3. **Backlog** — desorganizado (linhas duplicadas para #9, #11, #15, #26 com estados inconsistentes). Difícil ler.

Fazer tudo num único turno arrisca regressões silenciosas (425 strings + 11 mudanças DB = muito raio de explosão para um round). Proposta segmentada e priorizada por risco real.

## Round 17 — DB hardening (P0, segurança)

1. **Identificar** as 4 funções com EXECUTE para `anon` e as 2 tabelas RLS-sem-policy via `read_query` (`pg_proc` + `pg_policies`).
2. **Migration** que para cada função:
   - `REVOKE EXECUTE ... FROM anon, public` se realmente não é endpoint público.
   - Mantém `GRANT EXECUTE ... TO authenticated` apenas se for chamada via PostgREST/RPC do frontend autenticado; caso contrário também revoga.
3. **Tabelas RLS-sem-policy**: ou criar policy mínima (`USING (false)` se interno), ou desativar RLS se a tabela é só backend.
4. **Extensão em public**: mover para schema `extensions` se for trivial (geralmente `pg_trgm`/`unaccent`); se houver dependências, registar como aceite e atualizar `@security-memory`.
5. Re-correr `supabase--linter` para confirmar 0 WARN restantes ou justificar os que ficam no `@security-memory`.

## Round 18 — i18n sweep dos diálogos de edição (P1)

Cobre os componentes mais visíveis a um trainer EN durante uso real:

- `AddExerciseDialog`, `ImportLogDialog`, `FeedbackPanel`, `OneRepMaxCalculator`, `PaywallDialog` (features list + botões), `ShareAppButton` (texto de partilha).

Todos com keys novas em `dialogs.*`, `paywall.*`, `share.*`, `calculator.*`, `feedback.*`. Toasts de erro/sucesso passam por `t()`.

## Round 19 — i18n sweep dos painéis de cliente + format helpers (P1)

- `IntakeLinkPanel` (incluindo `ago(min)` → helper i18n com `Intl.RelativeTimeFormat`), templates de SMS/email passam por `t()` com interpolação `{{name}}`.
- `PlanAssessmentSheet` — labels da avaliação (Experiência, Frequência, Lesões, Condições, Métrica…).
- `MovementPatternCard`, `MesocycleTableView`, `SessionDayView` (Preparação, etc.).
- Locale do `toLocaleDateString` passa a usar `i18n.language` em vez de `"pt-PT"` fixo.

## Round 20 — Backlog cleanup + smoke + publish (P2)

1. Reescrever `.lovable/backlog.md`: deduplicar linhas, agrupar por estado, manter só uma linha por #ID com o último round, adicionar #28-#30 para os rounds acima.
2. Smoke test: trocar `lng` para `en` no init, varrer `/`, `/clients`, `/clients/$id`, `/plans/$id`, `/settings`, `/billing`. Reportar qualquer string PT residual como #31 follow-up (não fazer agora).
3. Restaurar `lng: "en"` ou deixar como aplicar-pelo-cliente. Publish.

## Restrição honesta

Não dá para esmagar 417 strings num round sem regressões. Esta sequência fecha a parte crítica (segurança DB + dialogs + painéis de cliente — talvez 70-80% das strings em surfaces realmente usadas) em 4 rounds discretos e auditáveis.

## Ficheiros prováveis

- Migrations SQL novas (Round 17)
- `src/i18n/locales/{pt,en}/common.json` (Rounds 18-19)
- ~10 componentes em `src/components/*` (Rounds 18-19)
- `src/i18n/index.ts` se precisar helper `formatRelative`
- `.lovable/backlog.md` (Round 20)
- `@security-memory` se algum lint for justificadamente ignorado

Avanço com Round 17 (DB hardening)? Confirma e arranco.
