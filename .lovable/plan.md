## Problema

1. **Zonas invisíveis** — no SVG actual, `fillOpacity={0}` quando não selecionadas e o desenho de fundo é só uma silhueta contínua. Visualmente, joelho/ombro/peito não se distinguem do braço ou abdómen — o cliente não percebe que são áreas tappable.
2. **Faltam zonas** anatomicamente importantes:
   - **Cotovelo** (epicondilites — actualmente só existe "antebraço")
   - **Clavícula / AC joint** (lesões anteriores acima da clavícula, mediais — distintas do peitoral)
   - **Esterno / linha média torácica** (referidas costo-condrais)
3. **Sub-resolução** dentro de zonas grandes:
   - **Joelho**: anterior (patelofemoral) vs medial vs lateral (LCM/LCL) — hoje é uma caixa só
   - **Ombro**: anterior (deltóide ant./bicípite longo) vs lateral (subacromial) — hoje é uma caixa só
   - **Peito**: peitoral major vs esterno vs sub-clavicular
4. **"Outras lesões" perdidas** — o campo `note` (texto livre que o cliente escreve no `InjuryEditor`) **existe na DB** mas **NÃO é puxado** em `fetchInjuryBansForPlan` (`stage3-microcycle.functions.ts:823`). O `select` só lê `body_zone, severity, injury_label`. Se o cliente escrever "tendinite no manguito rotador, faz semanas que dói no movimento de alcançar para trás", essa nota **nunca chega ao prompt** do AI.

## Plano

### A. Refinar visualmente o boneco (`src/components/BodyMap.tsx`)

- **Tornar zonas sempre ligeiramente visíveis**: `stroke="currentColor"` com `strokeOpacity={0.18}` permanente + tracejado leve (`strokeDasharray="2 3"`) para sinalizar interactividade sem poluir. Hover sobe para 0.4. Selecionado mantém o preenchimento atual.
- **Anatomia outline mais densa**: adicionar contornos de joelhos (rótula), ombros (deltóide), cotovelos, clavícula, esterno e gémeos para o utilizador *ver* a anatomia.

### B. Adicionar zonas novas (front + back)

Front:
- `clavicle_left`, `clavicle_right` — pequena faixa horizontal acima do peito, junto à base do pescoço
- `sternum` — faixa central entre os dois peitorais
- `pec_left`, `pec_right` — substituem o `chest` único (mantém-se `chest` como alias para retrocompatibilidade dos dados existentes)
- `elbow_left`, `elbow_right` — entre bícep e antebraço
- `knee_anterior_left/right`, `knee_medial_left/right`, `knee_lateral_left/right` — substituem `knee_left/right` (alias mantido)
- `shoulder_anterior_left/right`, `shoulder_lateral_left/right` — substituem `shoulder_left/right` (alias mantido)

Back:
- `elbow_back_left/right`, `scapula_left/right` (entre `traps` e `upper_back`), `sacrum` (entre `lumbar` e os glúteos)

Todas com `label_key` em `common.json` (PT/EN). Manter PT-PT formal ("você").

### C. Backwards compatibility

- `getZone(legacyId)` continua a devolver a zona "pai" para `chest`, `knee_left`, `shoulder_left` etc., para que registos antigos em `assessment_injuries.body_zone = 'chest'` continuem a renderizar (mostrados como peito inteiro selecionado).
- `zoneFamily()` em `exercise-filters.server.ts` ganha mapeamentos para os novos ids:
  - `clavicle|ac_joint|sternum|pec` → `shoulder` (para AC) + nova família `chest_wall`
  - `elbow_*` → `elbow` (já existe a família, mas não havia zona)
  - `knee_anterior|medial|lateral` → `knee`
  - `shoulder_anterior|lateral` → `shoulder`
  - `scapula` → `upper_back`
  - `sacrum` → `low_back`

### D. Catálogo de labels (`src/lib/injury-labels.ts`)

Adicionar:
- `tennis_elbow` / `golfer_elbow` — `affects_zones` passa a incluir os novos `elbow_*` (hoje só estão em `forearm_*`)
- `ac_joint_sprain` — sobre `clavicle_*`
- `costochondritis` — sobre `sternum`
- `pec_strain` — sobre `pec_left/right`
- `patellofemoral_pain` — sobre `knee_anterior_*`
- `mcl_sprain` / `lcl_sprain` — `knee_medial_*` / `knee_lateral_*`
- `biceps_tendinopathy` — sobre `shoulder_anterior_*`
- `subacromial_impingement` — sobre `shoulder_lateral_*`

i18n keys correspondentes em `injuries.lbl.*` + `injuries.note.*` (PT/EN).

### E. Capturar "outras lesões" no plano (gap real)

`src/server/phased/stage3-microcycle.functions.ts:823, 831`:
- Mudar o `select` para `body_zone, severity, injury_label, note`
- Passar `note` para `InjuryRow` (extender o tipo em `exercise-filters.server.ts` com `note?: string | null`)
- Em `injuryBansPromptBlock()`, se houver pelo menos uma `note` não vazia, adicionar um bloco extra:
  ```
  CLIENT-REPORTED INJURY CONTEXT (free-text, take literally):
  - [zone] severity X/5: "<note>"
  ```
  Antes do bloco "INJURY-DRIVEN BANS". Isto dá ao AI o contexto que o trainer/cliente escreveu mesmo quando não há um label catalogado.
- Não alterar `bansForZone` — notas são *contexto*, não regras automáticas (evita que o AI invente bans em cima de texto livre sem citação).

### F. Migration

Não é precisa migration — o campo `note` já existe na tabela.

### G. QA

1. Smoke 375px Mobile Safari: tocar nas novas zonas, verificar que os labels aparecem em PT.
2. Verificar que um plano regenerado com uma `note` "dor a alcançar para trás" inclui essa frase no prompt (log em `generation_log.injury_filters_applied`).
3. Confirmar que `body_zone='chest'` antigo continua a renderizar como peito inteiro.
4. `bunx tsc --noEmit`.

## Detalhes técnicos

### Resumo dos ficheiros tocados

| Ficheiro | Mudança |
|---|---|
| `src/components/BodyMap.tsx` | Novas zonas, contornos densos, stroke permanente |
| `src/lib/injury-labels.ts` | Novos labels + zonas mapeadas |
| `src/i18n/locales/{en,pt}/common.json` | `injuries.zone.*` + `injuries.lbl.*` + `injuries.note.*` novos |
| `src/server/phased/exercise-filters.server.ts` | `zoneFamily()` mapeia novos ids; `InjuryRow` ganha `note?` |
| `src/server/phased/stage3-microcycle.functions.ts` | `select` puxa `note`; novo bloco "CLIENT-REPORTED INJURY CONTEXT" no prompt |

### Não tocado (decisão deliberada)

- `assessment_injuries` schema — sem migration
- `InjuryEditor.tsx` — já permite escrever `note`
- PDFs — fora de scope desta ronda
- Outras superfícies que mostram lesões (continuam a chamar `getZone(id)` que devolve a zona pai por alias)
