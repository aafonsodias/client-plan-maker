## Diagnóstico

A imagem 1 mostra o sintoma: depois do **Stage 1 — Brief approved**, os cards Stage 2/3/4 ficam em *placeholder* eternamente, com a frase "Will appear here once the previous stage is approved" — apesar de a stage anterior estar, de facto, aprovada. Olhando para `src/routes/clients_.$clientId.tsx` (linhas 1878-1884), a causa é literal:

```tsx
{inlineBrief.approved && (
  <>
    <StageCard stageNumber={2} title="Blueprint"     status="placeholder" />
    <StageCard stageNumber={3} title="Microcycle"    status="placeholder" />
    <StageCard stageNumber={4} title="Progressions"  status="placeholder" />
  </>
)}
```

Os três cards estão *hardcoded* como `placeholder`. Não há botão, não há acção, não há próximo passo — dead end.

A imagem 2 é o segundo sintoma: depois do brief aprovado, a barra de cima continua a mostrar **"Gerar rascunho do plano"** com `briefCoverage 14/14` — sugere que ainda há algo por gerar, quando na verdade o próximo passo é avançar para o Blueprint.

Boa notícia: as rotas `/plans/$planId/blueprint`, `/microcycle`, `/progressions` já existem e funcionam (auto-geram quando vazias). Só falta um caminho visível do client page até lá.

---

## Prompt-skeleton aplicado a este round

**GOAL:** Fazer com que, depois de aprovar o brief no client page, o trainer veja claramente como continuar para Blueprint → Microcycle → Progressions, com um botão iluminado em cada stage card.

**CONTEXT:** `src/routes/clients_.$clientId.tsx` (~L1797-1886) tem 4 `StageCard`s; só o Stage 1 está vivo, 2-4 são placeholders. As rotas downstream `plans.$planId.{blueprint,microcycle,progressions}.tsx` já existem e auto-geram. `inlineBrief.planId` já está em scope.

**TASK:** Substituir os 3 placeholders por cards "ready" com CTA "Gerar →" que navega para a rota correspondente; e mudar o botão grande de cima ("Gerar rascunho do plano") para "Continuar para Blueprint →" quando `inlineBrief.approved === true`.

**CONSTRAINTS:**
- Sem refactor de `StageCard` (já suporta `status="ready"` + `onApprove` + `approveLabel`).
- Sem mexer nas server fns nem nas rotas downstream.
- Sem tocar nas outras 99% das linhas do `clients_.$clientId.tsx`.
- Strings em pt-PT (idioma actual do utilizador).

**ACCEPTANCE:**
1. Após aprovar Stage 1, o card Stage 2 fica iluminado com botão **"Gerar Blueprint →"**; clicar navega para `/plans/$planId/blueprint`.
2. Stage 3 e Stage 4 também ficam visíveis em estado *ready* (não placeholder), com botões equivalentes — gated pelo `generation_state.stage` actual do plano (Stage 3 só fica accionável depois de blueprint aprovado, Stage 4 depois de microcycle).
3. O CTA grande no topo, depois do brief aprovado, deixa de dizer "Gerar rascunho do plano" e passa a "Continuar para Blueprint →" (link para `/plans/$planId/blueprint`).
4. Estado de `briefCoverage 14/14` é escondido depois de approved (não faz sentido continuar a mostrar progresso de algo já feito).

**ROLLBACK:** Reverter via History tab para o snapshot deste turn. As rotas downstream e server fns não são tocadas.

---

## Implementação (1 ficheiro)

**`src/routes/clients_.$clientId.tsx`** (única alteração):

### Mudança 1 — substituir os 3 placeholders (~L1878-1884)

Em vez de `placeholder`, cada card vira `ready` com `approveLabel="Gerar Blueprint →"` (etc.) e `onApprove` que navega para a rota respectiva. Determinar quais ficam *enabled* pelo `generation_state.stage` (já lido em scope na lista de planos):

- Stage 2 (Blueprint): sempre `ready` quando brief aprovado.
- Stage 3 (Microcycle): `ready` se `approved_stages` inclui `"blueprint"`, senão `placeholder`.
- Stage 4 (Progressions): `ready` se `approved_stages` inclui `"microcycle"`, senão `placeholder`.

Usar `useNavigate()` (já importado) com `navigate({ to: "/plans/$planId/blueprint", params: { planId: inlineBrief.planId } })`.

Para saber o estado actual sem refetch, ler o `generation_state` que já vem no `setInlineBrief` (adicionar campo `approvedStages: string[]` ao state `inlineBrief` — extensão mínima do tipo local).

### Mudança 2 — CTA do topo após approved (~L1698-1781)

Quando `inlineBrief?.approved === true`, em vez do botão "Gerar rascunho do plano" (`startPhasedPlanFn`), mostrar um `<Button asChild>` com `<Link to="/plans/$planId/blueprint" params={{ planId: inlineBrief.planId }}>Continuar para Blueprint →</Link>` e esconder o pill `Pré-visualização do brief · 14/14`.

### Mudança 3 — i18n strings

Adicionar a `src/i18n/locales/pt/assessment.json` (e o equivalente `en/`):
```
"phased.continue_to_blueprint": "Continuar para Blueprint →"
"phased.generate_blueprint": "Gerar Blueprint →"
"phased.generate_microcycle": "Gerar Microcycle →"
"phased.generate_progressions": "Gerar Progressions →"
"phased.locked_needs_blueprint": "Aprova o Blueprint primeiro"
"phased.locked_needs_microcycle": "Aprova o Microcycle primeiro"
```

---

## Out of scope (próximos rounds)

- Inline generation dos stages 2-4 dentro do client page (sem navegar) — exige montar 3 mini-editores aqui, é grande.
- A2-lite (re-análise silenciosa de locale) — fica adiado.
- Visual rework A5/B4 (radar + BP inputs) — fica adiado.

---

## Sobre o template "GOAL/CONTEXT/TASK..."

Funcionou bem para este round. Sugestão de uso futuro contigo:

- **GOAL**: 1 frase, 1 outcome observável pelo cliente final do trainer ("o trainer consegue clicar Continuar e chegar ao Blueprint").
- **CONTEXT**: só os ficheiros + linhas onde a alteração acontece. Se eu não conseguir abrir o ficheiro com a info que dás, faltou contexto.
- **TASK**: uma operação. Se tens 3 verbos diferentes ("substituir + adicionar + traduzir"), provavelmente são 3 prompts.
- **CONSTRAINTS**: lista o que **não** posso tocar — é onde mais valor entregas, porque me impede de cair em refactors paralelos.
- **ACCEPTANCE**: critérios mensuráveis (clica X → vê Y). Evita "fica bonito".
- **ROLLBACK**: na maioria dos casos é só "History tab → snapshot anterior". Vale a pena escrever quando há migrations/schema changes.

Diz **"avança"** para implementar.
