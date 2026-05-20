
# R78 — Cost guard antes do beta privado

## Porquê este é o próximo move (e não outro)

O R77 (auditoria MVP) deu veredicto **AMBER** com uma razão única: hoje, qualquer utilizador grátis pode disparar Stage 3 (`generateMicrocycleDays`), Stage 2, `synthesizeBrief`, `generateDay`, `archivePlanAndStartNextBlock` e variantes legacy **sem qualquer cap** — `checkPlanQuota` só corre na inserção da row, e a quota só sobe no `finalize`. Duas tabs abertas geram em paralelo. Não há webhook do Stripe, portanto entitlement fica 0–60s desalinhado após checkout.

Tudo o resto no backlog (slider de assessment, aesthetic passes, ES/HI nativo, NSCA) pode esperar. **Isto não pode** — abrir beta sem isto = risco de conta AI a explodir e clientes pagantes sem acesso após pagar.

Encaixa nas bets de `mem://strategy/leap-of-faith.md`: bets 1 (Value) e 2 (Pricing) ficam impossíveis de medir enquanto a quota não morde de verdade.

## Âmbito (1 round, ~10–14 créditos)

### A. Reservation + lock no servidor (P0)

1. Migração aditiva mínima:
   - `profiles.plan_quota_reserved int default 0`
   - `workout_plans.quota_reserved bool default false`
   - `workout_plans.generation_lock_acquired_at timestamptz`, `generation_lock_owner uuid`
2. `src/server/quota.server.ts`:
   - `reservePlanQuota(planId, userId)` — UPDATE condicional `(used+reserved) < limit`, idempotente via `workout_plans.quota_reserved`.
   - `releasePlanQuota(planId)` — decrementa em falha terminal / abandono.
   - `acquireGenerationLock(planId, userId, ttlMinutes=120)` — UPDATE condicional; expira por idade.
   - `releaseGenerationLock(planId, userId)`.
   - Mantém `checkPlanQuota` mas passa a contar `used+reserved`.
3. Helper `withCostGuard({ planId, stage })(fn)` que faz: ownership → checkPlanQuota → reserve (1ª chamada AI) → acquireLock → fn → releaseLock; em erro terminal, releasePlanQuota.

### B. Aplicar a wrapper às 7 entradas críticas (P0)

`synthesizeBrief`, `generateBlueprint`, `generateMicrocycleDays`, `generateDay`, `archivePlanAndStartNextBlock`, `startQuickPlan` (se ainda reachable — confirmar; R74 removeu rota, mas server fn pode persistir), legacy `generatePlanDraft/Week/Day`. Cada uma ganha o wrapper sem mudar a sua lógica de geração.

### C. Stripe webhook (P0)

- `src/routes/api/public/stripe-webhook.ts` com verificação de assinatura via `STRIPE_WEBHOOK_SECRET` (`secrets--add_secret` se faltar).
- Handlers: `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`. Escreve `subscribers` via `supabaseAdmin`.
- Manter `checkSubscription` como fallback em `/billing` mount.

### D. UX honesta (P0)

- `PaywallDialog` passa a disparar nas novas chamadas (códigos: `quota_exceeded`, `generation_locked`).
- `/billing?checkout=success` mostra "A confirmar pagamento…" até 60s (polling curto).
- Toast inline em `generation_locked` com CTA "Atualizar".

### E. Alinhar trial vs landing (P0 pequeno)

`handle_new_user_trial` cria trial de 14d que contradiz a copy "1 plano grátis". Remover o trigger (ou actualizar landing — preferir remover; é mais barato e a copy actual é a verdade que queremos defender).

## Fora do âmbito (deferido para R79+)

- Retry cap por stage e daily attempt cap (P1 do R77 — bons de ter, mas reservation+lock já mata 90% do risco).
- `.ics` export, GCal OAuth, WhatsApp Cloud API, top-ups.
- Slider de assessment, aesthetic passes, ES/HI nativo, R76, ingestion ACSM/Bompa/NSCA.

## Critério de aceitação

1. Tab A + Tab B disparam Stage 3 ao mesmo tempo → uma ganha, a outra recebe `generation_locked` com toast.
2. Free user gera 1 plano até finalize → 2ª tentativa de novo plano abre `PaywallDialog` *antes* de qualquer AI rodar.
3. Pagamento via Stripe → webhook actualiza `subscribers` em <5s sem precisar de reload.
4. Smoke PT/EN em 375px Mobile Safari sem regressão visual.
5. `mem://index.md` ganha 1 linha "Core" sobre o cost guard para travar regressão futura.

## Estimativa

~10–14 créditos. 1 migração, ~9 ficheiros tocados, 1 rota nova. Sem mudar prompts, sem mudar UI de geração.
