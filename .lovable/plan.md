## Plan Rápido — refactor de coerência e honestidade

Foco: resolver os P0 que podem fazer um PT fechar a página ou ter problema legal, depois P1/P2.

### Decisão estratégica primeiro

Antes de tocar em código preciso da tua resposta a UMA pergunta:

**O Plano Rápido é (a) demonstração do motor para o PT ver, ou (b) plano entregável a um cliente real?**

- Se (a) demo: nome do cliente passa a opcional (default "Cliente Demo"), PDF leva watermark "DEMONSTRAÇÃO — refazer com intake completo antes de entregar", sem PAR-Q.
- Se (b) entregável: bloqueio com PAR-Q mínimo (3 perguntas binárias: dor torácica em esforço · medicação cardiovascular · lesão activa que limite movimento) antes de gerar.

A minha recomendação é **(a) demo, com botão grande "Promover a plano clínico" no fim que abre o intake completo pré-preenchido** — fecha o loop sem comprometer o teu posicionamento clínico. Mas é decisão tua.

---

### P0 — bloqueadores

**1. Promessa "5 campos" cumprida.** Reagrupar em 5 grupos visuais reais:
- Cliente (Nome · Idade · Sexo numa linha)
- Objectivo
- Experiência
- Frequência
- Equipamento

Sexo move-se de 2º campo para dentro do grupo "Cliente", com tooltip "?": *"Usado para calibrar cargas e zonas (ACSM). Editável depois."*

**2. Selecção visual sem ambiguidade com warn.** Hoje âmbar dessaturado em texto sobre fundo escuro lê-se como erro de validação — colide com `status-tone.ts` (warn=âmbar).
- Estado seleccionado = **fundo âmbar sólido suave + texto foreground forte + check ✓ inline**.
- Não-seleccionado = outline border, texto muted.
- Aplica-se aos botões de Sexo, Objectivo, Experiência, Dias, Equipamento.

**3. Microcopy "sem lesões" eliminado.** Substituir o parágrafo de honestidade por:

> "Plano Rápido = motor com defaults conservadores. **Não substitui intake clínico.** Para usar com cliente real, complete o PAR-Q antes de prescrever — abrir intake completo →"

Link directo para `/clients/{id}/intake` quando o plano gerar.

### P1 — coerência

**4. RPE cap deixa de estar enterrado em prosa.** Passa a ser função explícita da experiência seleccionada e mostrado como chip sob o seletor:
- Iniciante → RPE máx 7.5
- Intermédio → RPE máx 8.5
- Avançado → RPE máx 9

Chip pequeno: *"Tecto de esforço: RPE 8.5"* — actualiza ao mudar experiência. Lógica passa para `quick-plan.server.ts` (já recebe `experience`).

**5. Hierarquia visual: Objectivo ganha peso, Equipamento perde.** Objectivo = 5 cards maiores com ícone (Hipertrofia=Dumbbell, Força=Anvil/Weight, Recomp=Scale, Saúde=Heart, Performance=Trophy). Equipamento mantém-se como chips compactos.

**6. Categorias de equipamento por tipo, não por contexto.** Substituir a lista actual por:
- Barra + anilhas
- Halteres
- Kettlebells
- Máquinas
- Elásticos
- Peso do corpo

"Treino em casa" e "Halteres em casa" desaparecem (contexto, não equipamento). Migração: mapear `home`/`bodyweight` antigos para `bodyweight`, `dumbbells` mantém-se. Sem mudança de schema necessária — é só lista de IDs no frontend e o `quick-plan.server.ts` já lida com o array.

**7. CTA copy fecha o loop de promessa.** "Gerar plano agora" → **"Gerar em 60s"**. Alinha com header "5 campos → plano em 60–90s".

### P2 — polish

**8. Indicador de preenchimento subtil junto ao CTA.** *"5 de 5 preenchidos"* / *"Falta: equipamento"* em texto pequeno muted. Resolve o "porquê é que o botão está disabled" sem toast.

**9. Largura do input Nome limitada a ~320px** alinhado com a coluna Idade+Sexo.

**10. Respiração nos sub-labels** (Iniciante / `<1 ano`): `gap-1` entre as duas linhas dentro do botão, hoje colam-se.

**11. Confirmação ao Cancelar** se houver campos preenchidos: AlertDialog "Descartar este plano rápido?". Senão volta directo a `/dashboard`.

### Detalhes técnicos

- **Ficheiros tocados:** `src/routes/plans.quick.tsx` (todo o UI), `src/server/quick-plan.server.ts` (mapping de experience → rpe_cap explícito, hoje provavelmente está hardcoded), `src/lib/equipment-catalog.ts` (alinhar IDs se preciso).
- **Sem migração de DB.** A coluna `sex` já é texto livre — passar a aceitar só `male|female` no frontend não quebra dados existentes.
- **i18n:** todo o copy novo em `pt/common.json` sob namespace `quick_plan.*`. Mesmo sendo PT-only landing, mantém a regra "todo copy via t()".
- **PAR-Q mínimo** (se escolheres (b)): NÃO criar tabela nova, guardar em `clients.notes` ou novo campo `screening_passed_at` em `clients`. Decidimos depois da resposta à pergunta estratégica.

### O que NÃO faço sem ok

- Mexer no `quick-plan.server.ts` para além do RPE cap explícito.
- Adicionar PAR-Q (depende da decisão (a) vs (b)).
- Tocar no schema de `workout_plans` ou `clients`.

---

**Próximo passo:** responde-me à pergunta estratégica (a vs b) e digo se ataco tudo de uma vez ou faço P0 isolado primeiro.
