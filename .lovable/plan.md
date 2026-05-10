## Round D — escopo confirmado

6 itens P0, 1 ficheiro principal (`src/routes/clients_.$clientId.tsx`) + componentes pequenos. Mantém-se o princípio "1 concern per round" porque tudo gira em torno do mesmo formulário. Estimativa: ~20 créditos.

---

### 1. #4 Concluir sempre ativo (CC5/C1) — já quase pronto, fechar últimas frestas

**Estado actual (`clients_.$clientId.tsx:1970–1995`):** o `onConclude` já não bloqueia. Quando incompleto, abre `incompleteWarnOpen` e gera depois da confirmação.

**Falta:**
- Reescrever copy do dialog (`assessment.generate.incomplete_*` em pt/en/es) para a mensagem certa: "Qualidade do plano reduzida — secções em falta podem ser completadas em pessoa contigo mais tarde. Gerar mesmo assim?" + confirm "Gerar com o que tenho".
- No footer do stepper (`AssessmentSection`, ~linha 4523) garantir que `disabled={concludeBusy || (isLast && !onConclude)}` continua a permitir clicar mesmo com `completedCount < totalSections` (já permite — apenas verificar e remover qualquer estilo "ghost/dimmed" condicional residual).

### 2. #19 SMART — estado seleccionado claro dentro da categoria

**Onde:** bloco do goal (templates SMART), aprox. 2441–2460 + componente `SmartGoalTemplateChip` (procurar). Hoje, dentro da aba "Força", o template seleccionado fica com diferença visual mínima.

**Mudança:**
- Adicionar `ring-2 ring-primary` + ícone `Check` num pill "Selecionado" no template activo.
- Aumentar contraste do `bg` do seleccionado vs unselected (usar `bg-primary/10` vs `bg-muted/20`).
- Garantir alinhamento das letras (user reportou desalinhamento — provavelmente `items-start` em vez de `items-center` no row).

### 3. #3 Live update das Implicações por secção (CC8 — versão incremental)

**Diagnóstico (`clients_.$clientId.tsx:977–999`):** `triggerSectionAnalyses` itera as secções sequencialmente, mas **só refaz `setSectionAnalyses` no fim de toda a queue**. Resultado: enquanto a queue corre (vários segundos × N secções), a UI mostra o estado antigo.

**Fix:** dentro do `for (const section of queue)`, depois de `analyzeSectionFn` retornar com sucesso, fazer um fetch leve de `getCoverageFn` (ou idealmente um endpoint que devolva só a análise dessa secção) e fazer `setSectionAnalyses(prev => ({ ...prev, [section]: r.analyses[section] }))` imediatamente. O fetch final no fim da queue mantém-se como reconciliação.

Nota: usa o endpoint `getCoverageFn` actual com merge parcial — não exige migração nem novo server fn.

### 4. #48 Rockport — verificar, não reconstruir

`src/components/assessment/RockportWizard.tsx` já existe e é completo (peso/idade/sexo + tempo + HR → VO₂max). Acção: confirmar que está renderizado dentro da §Performance (procurar `RockportWizard` no route) e que aparece quando `ext_cardio_test === "rockport"` (ou similar). Se não estiver visível na UI, ligar; caso contrário, marcar como done.

### 5. #11.1 Mobility — instruções mínimas viáveis por articulação

**Onde:** `clients_.$clientId.tsx:2990–3005` (loop dos `ScoreRow` para mobility).

**Mudança mínima viável (sem SVGs custom ainda):**
- Adicionar um campo `hint` curto (1 frase) por articulação no i18n (`mobility_block.tests.<joint>.hint`), ex: "Sentado, levanta o braço lateralmente até à orelha sem rodar o tronco".
- `ScoreRow` ganha prop opcional `hint?: string` → render como `<p className="body-prose text-[11px] text-muted-foreground">{hint}</p>` por baixo do label.
- 4 articulações × 3 idiomas = 12 strings curtas.

Desenhos completos ficam para Round F (#11.1 versão large).

### 6. #13.2 Movement screen — chips de critério (versão mínima)

**Onde:** componente que renderiza os 5 padrões (`SQUAT`/`HINGE`/etc.) — aprox. 3037–3070 + `formScore`/criteria UI em `src/lib/movement-criteria.ts`.

**Mudança mínima:**
- Cada critério já é uma checkbox/score. Adicionar um pequeno tooltip/hover-card (já existe `Tooltip` do shadcn) com 1 linha de texto: "Correcto: joelhos alinhados com pés · Incorrecto: valgo (joelhos para dentro)".
- Strings em `screen_block.criteria.<pattern>.<criterion>.right` / `.wrong`.
- Sem imagens reais ainda — só texto. Imagens ficam para Round F.

---

## Ficheiros tocados

- `src/routes/clients_.$clientId.tsx` — secções 2, 3, 5, 6 + verificação 4
- `src/components/assessment/RockportWizard.tsx` — só verificação/wiring se necessário
- Componente `ScoreRow` (provavelmente inline no route ou em `src/components/assessment/`) — adicionar prop `hint`
- `src/i18n/locales/{en,pt,es}/assessment.json` — copy do dialog #1, hints de mobilidade #5, critérios de screen #6

## Validação manual

1. **#4:** abrir cliente com 8/14 secções → carregar Concluir → dialog mostra "Qualidade reduzida..." → confirmar → geração arranca.
2. **#19:** §Goal, escolher categoria Força, clicar template → ring + chip "Selecionado" visíveis; mudar template → o anterior perde estado.
3. **#3:** preencher um campo na §Lifestyle → guardar (auto, 1.5s) → o bloco "Implicações" da §Lifestyle actualiza sozinho em <5s, sem esperar pelas outras secções.
4. **#48:** §Performance, escolher Rockport → wizard aparece com inputs.
5. **#11.1:** §Mobility → cada articulação tem 1 frase de instrução por baixo.
6. **#13.2:** §Screen → hover/tap num critério mostra tooltip "Correcto vs Incorrecto".

Smoke a 390×812 (mobile) e 1280×800 (desktop).

## Fora do escopo (vai para Round E/F)

CC1 collapse padronizado, CC2 sweep estético, CC4 page-per-topic, CC9 pre-stage por secção (já é por secção — só falta consolidar), CC10 nome único, e tudo o que envolva SVGs reais (mobility/screen completos, equipment, nutrition).
