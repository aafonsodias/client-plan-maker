## Objetivo
Fechar os 3 itens P1/P2 que ainda restam no backlog (R22, R23, R24) numa única sessão.

## R22 — Sweep i18n final em src/routes (#32)

Alvo: ~250 literals PT detectados via `rg` em rotas grandes.

Ficheiros:
- `src/routes/clients_.$clientId.tsx` (~1.5k linhas) — secções de avaliação, intake, fotos, notas, blocos.
- `src/routes/plans.$planId.tsx` + sub-rotas (`brief`, `blueprint`, `microcycle`, `progressions`, `sessions`) — toasts, headers, empty states.
- `src/routes/billing.tsx` — labels de plano e faturação.
- `src/routes/templates.tsx`, `plans.index.tsx`, `plans.new.tsx` — toasts/empty states residuais.

Ações:
1. Varrer cada ficheiro com `rg "[À-úçãõ]"` para listar literais PT.
2. Adicionar chaves novas em `src/i18n/locales/pt/common.json` e `en/common.json` sob namespaces existentes (`clients.*`, `plan.*`, `billing.*`).
3. Substituir literais por `t("...")`. Datas → `toLocaleDateString(i18n.language === "pt" ? "pt-PT" : "en-US", ...)` (padrão já em uso em FeedbackPanel/LogbookTimeline).

## R23 — Sync subscription_tier ↔ plan_quota_limit (#34)

Problema: webhook Stripe escreve `subscribers.subscription_tier` mas `profiles.plan_quota_limit` pode ficar dessincronizado, quebrando o gate de quotas em `quota.server.ts`.

Ações:
1. Migration: criar função `sync_plan_quota_from_tier(uid uuid)` que mapeia tier → cap (Starter 8 / Pro 30 / Studio 80) e faz `UPDATE profiles SET plan_quota_limit = ... WHERE id = uid`.
2. Trigger `AFTER INSERT OR UPDATE OF subscription_tier ON public.subscribers` que chama a função para o `user_id` da row.
3. Backfill: `UPDATE profiles p SET plan_quota_limit = ...` cruzando com `subscribers` actuais.
4. Manter regra "1 cliente = 1 plano": cap de planos == cap de clientes (já no Core).

## R24 — Export PDF do bloco com evolução (#35)

Estender `src/lib/pdf.ts` (gerador actual) para blocos N≥2.

Ações:
1. Em `src/lib/pdf.ts`, adicionar secção "Evolução vs Bloco N-1" no topo do PDF quando `plan.block_number > 1`:
   - Chip Δ% load + e1RM (reaproveitar `computeCapacityGain` de `src/lib/capacity-gain.ts`).
   - Linha de transição (`block_transition_summary`).
2. Reutilizar a estrutura visual do `CapacityGainCard` (mas em layout PDF: tabela simples por padrão de movimento).
3. Botão "Export PDF" em `plans.$planId.tsx` já existe — apenas garantir que passa `priorPlan` quando aplicável (ler via `prior_plan_id`).
4. QA: gerar PDF para um plano demo bloco 2, converter páginas para imagem e inspecionar (sem texto cortado, sem caixas pretas).

## Fora de âmbito
- R33 (smoke test manual PT/EN) — fica para o utilizador antes de publicar.
- Não publicar — utilizador pediu explicitamente "publicar só quando eu disser".

## Entregáveis
- ~10–15 ficheiros editados (rotas + locales).
- 1 migration SQL (trigger + backfill).
- 1 PDF de exemplo gerado em `/mnt/documents/` para QA visual.
- `.lovable/backlog.md` atualizado: itens 32, 34, 35 movidos para "Concluído"; ficar só #33 (smoke test) em aberto.
