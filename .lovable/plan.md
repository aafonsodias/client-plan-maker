## Objectivo

Limpar o topo de `/plans/$id` (acima da tabela) eliminando duplicação sem remover funcionalidade. Hoje há 7 surfaces empilhadas + título repetido 3× + 5 entradas de PDF dispersas. Resultado-alvo: 3 surfaces, 1 título, 1 menu de exportação.

## Regra de "zero perda"

Toda acção que existe hoje continua acessível em ≤ 2 cliques. Nada removido — apenas reorganizado, agrupado ou movido para o sítio mais correcto.

## Mudanças

### 1. Título: 3× → 1×
- Header da `AppShell` deixa de incluir o título do plano. Mostra: avatar+nome do cliente · chip "Bloco N · Sem X/Y" · status chip.
- Label do `<summary>` do `<details>` deixa de repetir o título — fica só "Detalhes & acções do plano ▾".
- O `<Input>` editável dentro do `<details>` continua a ser a única fonte de verdade para o título.

### 2. PDF: 5 entradas → 1 menu "Exportar ▾"
Consolidar num único `DropdownMenu` no header (sempre visível, fora do `<details>`):
- **Plano completo** (todas as semanas) — actual botão amber `exportPdf`
- **Semana actual** — actual "PDF · Sem. N" do hero
- **Avaliação do cliente** — actual `PlanAssessmentSheet`

Remover:
- Botão amber "PDF" duplicado dentro da barra de acções do `<details>` (fica só no menu)
- Sticky `Export PDF` do modo Edit (linha 946) — redundante com header

### 3. CTAs de "fechar bloco": 2 → 1
- Manter `<NextBlockCard>` (linha 741) que é o componente canónico.
- Remover o painel inline "Bloco N · pronto para fechar" + `BlockTransitionDialog` (linhas 753–812, ~60 LoC).
- Garantir que `NextBlockCard` expõe ambas as acções: "Marcar como concluído" e "Iniciar Bloco N+1" (verificar antes de remover; se faltar a primeira, portá-la para lá).

### 4. Banners empilhados: 7 → 1 "Acções pendentes"
Criar `<PlanPendingActions>` que mostra **só o item de maior prioridade**:

```
prioridade:  human-review > demo-seed > legacy-plan
             > next-week > next-block > validation
```

Os restantes ficam acessíveis num "▾ Mais (N)" dentro do mesmo cartão. Validation report e legacy banner continuam acessíveis — apenas não competem por atenção visual.

### 5. "Branding" → fora desta página
O link inline para `/settings` (linha 639) sai do header de acções. Já existe acesso a Settings na nav principal. Sem perda — só limpeza.

### 6. "Re-gerar resumo" → dentro do Summary
O botão (linhas 558–587) move-se para dentro do header colapsável do Summary, à direita do "Summary (empty)". Só aparece quando `summaryLooksLeaked()` — comportamento idêntico, posição mais lógica.

## Layout final

```
┌─ AppShell header ──────────────────────────────────────────┐
│  ← All plans  │ [avatar] Cliente → · Bloco 1 · Sem 1/4    │
│               │ [Pronto] [Exportar ▾] [Logbook]            │
└────────────────────────────────────────────────────────────┘

[ ▸ Detalhes & acções do plano ]                  ← colapsado
   └── Título editável + chips (block-evolved, rotation, lift)
   └── Acções: Share · Importar registo · Template
              · Re-ancorar RPE · Delete
   └── Summary (com "Re-gerar" inline)

[ Acções pendentes ]                              ← 1 cartão
   (mostra a prioridade mais alta; resto em "▾ Mais")

[ Tabs: View · Edit · Log · Resultados · Progresso ] [Regen]

[ TABELA ]
```

## Ficheiros tocados

- `src/components/PlanEditorSurface.tsx` — refactor principal, ~150 LoC removidas
- `src/components/AppShell.tsx` (ou wrapper de header do plano) — adicionar slot para chip+menu Exportar
- `src/components/PlanPendingActions.tsx` — **novo**, agrega os 6 banners com prioridade
- `src/components/PlanExportMenu.tsx` — **novo**, dropdown unificado dos 3 PDFs

## Validação

- Mobile 375px smoke (i18n PT-PT)
- Cada acção que existe hoje tem de continuar alcançável em ≤ 2 cliques
- Tour anchors (`data-tour="plan-header|plan-block-chip"`) preservados
- Sem alteração de lógica de negócio, sem migração de DB, sem mudança de copy fora dos 2 sítios renomeados

## Fora de âmbito

- Redesenhar `NextBlockCard` / `NextWeekCard` / `ValidationReport` internamente
- Mexer na tabela ou modos (View/Edit/Log/etc.)
- Tradução de novas strings (reutilizamos as existentes)
