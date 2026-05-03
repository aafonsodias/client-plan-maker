## Round 13 — i18n sweep das adições recentes (Rounds 8–12)

### Objetivo
Garantir que tudo o que foi construído nas últimas rondas (NextBlockCard, popovers Rotação/Main lift, WeeklyVolumeBars) tem cobertura EN. As superfícies mais antigas (BlockAdaptationCard, VolumeStatusTable, ExerciseTrendChart, YearView strip) ficam para Round 14.

### Mudanças

**1. `src/i18n/locales/pt/common.json` + `src/i18n/locales/en/common.json`**

Adicionar dois namespaces no fim:

- `blocks.next.*` — copy do NextBlockCard (deload/normal/push titles+subs, adesão, avg_rpe, block, start_next)
- `blocks.rotation.*` — chip "Rotação N%", popover (título, after_retry, no_retry, days_regenerated, pool_label)
- `blocks.main_lift.*` — chip refrescado/mantido + popover (refreshed_desc, kept_desc, new_label, prior_label)
- `volume.weekly_bars_label`, `volume.prescribed`, `volume.actual`

**2. `src/components/NextBlockCard.tsx`**
- `useTranslation("common")` → todas as strings via `t("blocks.next.*")`.
- COPY map continua, mas valores passam a ser chaves i18n resolvidas no render.
- "Iniciar Bloco N+1" → `t("blocks.next.start_next", { n: blockNumber + 1 })`.

**3. `src/components/volume/WeeklyVolumeBars.tsx`**
- Label "Prescrito vs realizado · séries" → `t("volume.weekly_bars_label")`.
- `<Bar dataKey="prescrito" name={t("volume.prescribed")} />` + idem `actual`. Recharts mostra `name` no Tooltip.
- Manter chaves internas dos dados em PT (não importam — só `name` aparece).

**4. `src/routes/plans.$planId.tsx`** — popovers Rotação + Main lift
- Trocar strings hardcoded para `t("blocks.rotation.*")` e `t("blocks.main_lift.*")`.
- Manter a lógica de `summarizeRotation` + `main_lift_audit` intacta.

**5. `.lovable/backlog.md`**
- Marcar Round 13 (#23 parcial) como ✅; criar #25 para superfícies legadas (BlockAdaptationCard, VolumeStatusTable, ExerciseTrendChart, YearView strip) na Round 14.

### Fora de scope (intencional)
- BlockAdaptationCard, VolumeStatusTable, ExerciseTrendChart, YearView strip — superfícies estáveis em PT, mexer agora arrisca regressões silenciosas. Vão para Round 14 com QA dedicado.
- CapacityGainCard — já tem alguma estrutura i18n, validar separadamente na Round 14.
- Landing page mockups — copy de marketing, decisão à parte.

### Riscos & mitigação
- **Recharts Tooltip name**: testado noutros componentes do projeto (chart.tsx). Funciona.
- **Plurais "Iniciar Bloco N"**: numérico simples, sem regras de plural — interpolation é suficiente.
- **i18n race**: as keys estão presentes em PT+EN antes dos componentes referenciarem (mesmo commit).

### Princípio
útil ✅ (componentes novos = primeira impressão para utilizador EN) · funcional ✅ · bonito ✅ (sem visual diff) · divertido ⚠️ (higiene)
