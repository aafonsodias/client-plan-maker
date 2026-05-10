## Diagnóstico

**Bug 1 — Diálogo "Concluir avaliação parcial" mostra `0/14`**
A correção anterior trocou a fonte do contador para `progressTotals`, mas essa variável é da geração de **dias do plano** (`workout_plan_days`), não da avaliação. Daí dar `0/0 → 0/14`.

A fonte correcta já existe e está usada no rail (e no `summaryLine`):
```ts
const sectionStatus = SECTIONS.map(s => ({ ...s, complete: isSectionComplete(s.id, assessment) }))
const completedCount = sectionStatus.filter(s => s.complete).length    // ← este
const totalSections = SECTIONS.length                                  // ← este
```

A mesma confusão existe na *guarda* que decide se mostra o diálogo (linhas 1991 e 3270), que hoje usa `briefCoverage` (cobertura de **análises AI**, não de preenchimento). Resultado: mesmo com 14/14 preenchidas, se uma análise AI ainda não correu, a guarda dispara o diálogo.

**Bug 2 — Botão "Gerar rascunho do plano" reapareceu no desktop**
Na §14 (Performance), o bloco `showGenerateCta` (linhas 3154–3316) renderiza um CTA grande com `t("generate.button")` = *"Gerar rascunho do plano"*. Isto é "lixo" — o único caminho válido para fechar a avaliação é o botão **Concluir** no footer do stepper (já liga à síntese ou à guarda de safety/incompleto, conforme estado).

A condição actual `activeSection === "performance"` não filtra por viewport, então no desktop o botão aparece sempre que a §14 está activa.

---

## Plano

### 1. Corrigir contador do diálogo (`incompleteWarnOpen`)
- Substituir `done: progressTotals.done, total: progressTotals.total || 14` por `done: completedCount, total: totalSections` no `AlertDialogDescription`.
- Estes valores já estão calculados acima no mesmo componente (linhas 1582–1584).

### 2. Corrigir guarda "assessment está completa?"
- Nas duas chamadas (`onConclude` linha 1991 e CTA legado linha 3270), substituir:
  ```ts
  const assessmentComplete = !!briefCoverage && briefCoverage.total > 0 && briefCoverage.done >= briefCoverage.total;
  ```
  por:
  ```ts
  const assessmentComplete = completedCount >= totalSections;
  ```
- A guarda passa a reflectir o que o utilizador vê no rail (14/14), não a cobertura de análises AI (que é assíncrona).

### 3. Remover o CTA "Gerar rascunho do plano"
- Apagar todo o bloco `{showGenerateCta && (...)}` (linhas 3154–3316), **mantendo** apenas:
  - o strip verde *"Plano pronto para esta avaliação"* (3155–3176) — útil quando há plano,
  - o strip *resume* da geração em curso (3127–3140),
  - o `<GenerationProgress>` enquanto `busy` (3141–3152).
- A `AlertDialog` de safety (parqYes/risco alto) continua acessível via `onConclude` (linhas 1981–1985), portanto não se perde nada funcional.
- Limpar variáveis órfãs criadas só para esse CTA (`showGenerateCta`, e remover comentário desactualizado nas linhas 668–675 sobre "Gerar rascunho do plano").

### 4. Limpeza i18n
- Marcar `assessment.generate.button` ("Gerar rascunho do plano") como deprecated por comentário, mas **não apagar** ainda — a chave é referenciada pelo CTA legado nos 4 locais; após a remoção (passo 3) já não tem call-sites e pode ficar como string órfã para um round de limpeza futuro (não vale custo de tradução agora).

---

## Ficheiros tocados

- `src/routes/clients_.$clientId.tsx` (única alteração de código)

## Validação

- Abrir `/clients/<id>` com 14/14 preenchidas → carregar **Concluir**:
  - se há plano pronto → vai para a síntese (sem diálogo).
  - se não há plano e está completo → arranca a geração directamente, sem diálogo.
- Forçar 13/14 → **Concluir** mostra diálogo a dizer *"Avaliação incompleta (13/14 secções)"*, não 0/14.
- §14 activa em desktop (1547×812) → **não** existe botão "Gerar rascunho do plano"; só o footer do stepper com **Anterior / 14/14 / Concluir**.
- §14 activa em mobile (390×812) → comportamento inalterado (já estava escondido por `isMobileStepper`).
