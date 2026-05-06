
# R73 Phase 1 — QA runtime + fixes mínimos

Objetivo: validar Phase 1 ponta-a-ponta (sem abrir Phase 2) e corrigir só regressões encontradas durante a auditoria de código + smoke no preview.

## 1. Bugs já identificados na auditoria estática

**Bug A — "Sem deload" não desativa deload**
`buildWavePlan` faz `Math.min(6, Math.max(3, deloadEveryN))`. Quando `deload_frequency = "no_deload"`, `resolveCockpit` devolve 999, mas o clamp para 6 transforma-o em deload a cada 6 semanas. Além disso, a última semana é **sempre** deload (`w === totalWeeks`). Resultado: a opção "Sem deload" mente.

Fix:
- Manter sentinel: `resolveCockpit` devolve `deload_every_n: null` (ou flag `no_deload: true`) quando `freq === "no_deload"`.
- `buildWavePlan` aceita `deloadEveryN: number | null`. Se `null`, **nunca** insere semana de deload (incluindo a final).
- `stage4-progressions.functions.ts` passa `null` em conformidade e grava `deload_every_n_weeks: null` no `generation_meta` (em vez de 999).

**Bug B — Risco de "999" em UI**
Hoje só vai parar a `generation_meta.cockpit.deload_every_n_weeks` (não user-facing), mas devemos prevenir. Após Bug A, fica `null`.

**Bug C — `/knowledge` redirect-only para auth, sem gate de admin/role**
OK (qualquer trainer pode editar o seu perfil). `/admin/system` já valida `has_role('admin')` server-side via `assertAdmin` + RLS. Sem fix necessário, só smoke confirmar.

## 2. Smoke manual no preview (browser tool)

Sequência:
1. `/knowledge` (logged-in trainer) → confirmar auto-create do default profile, editar landmark de "Peito" (ex: MEV 8→10), guardar, recarregar, confirmar valor persistido + `version` incrementou (trigger `bump_knowledge_profile_version`).
2. `/admin/system` com user não-admin → confirmar mensagem "Esta área é restrita a administradores."
3. `/admin/system` com admin (`aafonsodias@gmail.com`) → confirmar lista R64/R65/etc. e botão "Nova iteração".
4. Plano novo (Brief→Stage 4) com cockpit em "no_deload" → após fix, confirmar `wave[]` sem nenhum `tag === "deload"`.
5. Plano antigo (sem `knowledge_profile_id`) → abrir `/plans/$id`, confirmar render OK e Stage 4 a usar fallback.
6. Mobile 375px: `/knowledge`, `/admin/system`, `/clients/$id`, `/plans/$id` — confirmar sem overflow.

DB checks via `supabase--read_query`:
- `select id, knowledge_profile_id, knowledge_profile_version from workout_plans order by created_at desc limit 5;`
- `select id, version from knowledge_profiles where trainer_id = '<uid>';`
- `select count(*) from knowledge_profile_versions where profile_id = '<id>';`

## 3. Ficheiros a tocar (mínimo)

- `src/server/phased/programming-defaults.ts` — `deloadEveryN: number | null`, propagar em `WaveOptions`, `ResolvedCockpit`, `buildWavePlan` (sem deload quando `null`, incluindo última semana).
- `src/server/phased/stage4-progressions.functions.ts` — passar `cockpit.deload_every_n` (potencialmente null) e gravar `deload_every_n_weeks` como `null` quando aplicável.

## 4. Entrega

No final do build (próximo turno), respondo com:
- Smoke result por checklist item.
- Bugs encontrados (A/B/C + qualquer novo).
- Fixes aplicados com diff resumido.
- Veredicto explícito: **Phase 1 pronta** ou **bloqueios** para Logbook Modes + Progressive Detail + i18n audit.

Sem alterações de schema. Sem mexer em Phase 2.
