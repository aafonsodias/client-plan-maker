## Goal

Na secção **Treino** da ficha de cliente (`/clients/$id`), substituir a lista plana de 8 equipamentos por uma versão idêntica à dos slides do intake: catálogo completo, etiquetado por cores por categoria, com pesquisa por nome — e colapsada por defeito.

## What changes

### 1. Extrair `EquipmentPicker` para componente partilhado

Atualmente vive como função interna em `src/routes/intake.$token.tsx` (linhas ~871–933). Mover para:

- `src/components/EquipmentPicker.tsx` — exporta o componente tal como está hoje (input de pesquisa, legenda colorida, grelha flat de pills coloridas por `EquipmentCategory`, toggle por canonical EN).
- Intake passa a importar daí, sem mudanças de comportamento.

Mantém a paleta `CAT_TONE` actual (amber/sky/violet/emerald/rose/teal/muted) e usa `EQUIPMENT_CATALOG` + `searchEquipment` de `@/lib/equipment-catalog`.

### 2. Substituir o bloco actual em `clients_.$clientId.tsx`

No `SectionBlock id="training"` (linha ~2494), substituir esta área:

```tsx
<Label>{t("training_block.available_equipment")}</Label>
<div>{EQUIPMENT_OPTIONS.map(...)}</div>
```

Por um `<details>` colapsado por defeito com:

- **Summary (linha sempre visível):**
  - Label "Equipamento disponível"
  - Chip com contagem `N seleccionados` (cor: emerald se >0, muted se 0)
  - Preview inline das 3 primeiras pills coloridas seleccionadas (cor da categoria), `+X` se houver mais
  - Chevron à direita
- **Conteúdo expandido:** `<EquipmentPicker value={assessment.available_equipment} onChange={...} />`

O `<details>` arranca **fechado**. Quando o utilizador expande, vê o picker completo do intake (pesquisa + legenda + grelha colorida).

`EQUIPMENT_OPTIONS` deixa de ser usado neste local; apaga-se se não tiver outros consumidores (verifico antes de remover).

### 3. i18n

Adicionar 2 chaves novas em `src/i18n/locales/{en,pt}/assessment.json` sob `training_block`:
- `equipment_count_zero` → "Nenhum seleccionado" / "None selected"
- `equipment_count_n` → "{{n}} seleccionados" / "{{n}} selected"

Reutiliza `intake:equipment_search` para o placeholder da pesquisa (já existe).

## Out of scope

- Não mexer no schema nem no formato persistido (`available_equipment: string[]` com EN canonical continua igual).
- Não mexer nos slides do intake além de trocar o import.
- Não mexer no PDF nem no brief (já lêem `available_equipment`).

## Files touched

- `src/components/EquipmentPicker.tsx` — **new** (extracção)
- `src/routes/intake.$token.tsx` — remover função interna, importar do novo módulo
- `src/routes/clients_.$clientId.tsx` — substituir bloco de equipamento por `<details>` + `EquipmentPicker`
- `src/i18n/locales/en/assessment.json`, `src/i18n/locales/pt/assessment.json` — 2 chaves novas
