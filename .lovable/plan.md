## Objetivo

Tornar o bloco de Medicação mais útil: ao tocar num medicamento aparece campo para a dose; no fim há um "Outro" para adicionar medicação não listada; remove-se a caixa de texto livre que está no topo (já não faz sentido com os chips estruturados).

## Comportamento proposto (391px e desktop)

1. **Remover** a `TextField` "Medicação (texto livre)" no topo do bloco (linha 2284).
2. **Cada chip seleccionado expande** uma linha leve por baixo do nome+efeito com um input compacto de dose:
   - Placeholder: `ex.: 5 mg/dia` (PT) / `e.g. 5 mg/day` (EN).
   - Aparece só quando `aria-pressed=true`, com `mt-2 border-t border-amber-500/15 pt-2`.
   - Click no input não dá toggle ao chip (`stopPropagation`).
   - Vazio é válido — apenas marcar o medicamento já é informação útil.
3. **Secção "Outro" no fim** da grelha (full-width, abaixo dos chips):
   - Botão tonal `+ Adicionar outro medicamento` (rounded-full, `bg-muted/40`, ícone `Plus`).
   - Cada entrada criada = card com mesmo aspecto dos chips amber, com 2 inputs (`Nome` + `Dose`) e um botão `×` para remover.
   - Suporta múltiplos.

## Persistência (sem migração)

Mantemos os dois campos existentes em `assessment`:

- **`med_flags: string[]`** — continua a guardar os canónicos (`"Beta-blocker"`, `"Statin"`, …). Inalterado, screening ACSM continua a funcionar.
- **`medications: string`** — passa a ser **sintetizado** a partir do estado estruturado, no formato legível:
  ```
  Beta-blocker (5 mg/dia); Statin; Outro: Vitamina D 2000UI; Outro: Magnésio 400mg
  ```
  Isto preserva a coluna DB, mantém compatibilidade com qualquer leitura a jusante (PDF, AI brief), e permite re-parsear ao montar para reidratar doses/outros.

Helper novo em `src/lib/meds-format.ts`:
- `serializeMeds(flags, doses, others) → string`
- `parseMeds(medications) → { doses: Record<canonical,string>, others: { name, dose }[] }`

## Ficheiros a tocar

- `src/routes/clients_.$clientId.tsx` — substituir o bloco linhas 2283-2319; remover a `TextField` de topo; novo subcomponente local `MedChip` com input de dose; nova secção "Outro" com lista local + botão adicionar.
- `src/lib/meds-format.ts` — novo, com `serializeMeds`/`parseMeds`.
- `src/i18n/locales/pt/assessment.json` e `en/assessment.json` — adicionar:
  - `meds_block.dose_placeholder`
  - `meds_block.add_other` ("Adicionar outro medicamento" / "Add another medication")
  - `meds_block.other_name_placeholder` ("Nome" / "Name")
  - `meds_block.other_dose_placeholder` ("Dose" / "Dose")
  - `meds_block.other_remove_aria`
  - **remover** `meds_block.free_text` (já não usado).

## Estética (mantém o tom amber actual)

- Input de dose dentro do chip: `h-7 text-[11px] bg-background/60 border-amber-500/20 focus-visible:ring-amber-500/40`, `tabular-nums`.
- Botão "Adicionar outro": `mt-2 w-full rounded-full bg-muted/40 hover:bg-muted/70 text-xs font-medium text-muted-foreground hover:text-foreground py-2 inline-flex items-center justify-center gap-1.5` com `<Plus className="h-3.5 w-3.5"/>`.
- Cards "Outro": mesmo border amber dos seleccionados, com 2 inputs lado a lado (`grid-cols-[1fr_auto]` no mobile, `grid-cols-[1fr_120px_auto]` desktop) + botão `×` ghost.

## Smoke test (391×844)

- Tocar Beta-blocker → aparece input de dose, escrever "5 mg" → guardar → recarregar → dose persiste e chip continua activo.
- Adicionar 2 "Outros" → remover o do meio → o restante persiste.
- Desmarcar um chip com dose preenchida → dose limpa silenciosamente.
- `medications` final no DB lê-se como frase humana (verificar via Lovable Cloud).
