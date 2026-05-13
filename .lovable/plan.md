
# Fundação do Protocol e gate de MVP

Documento único que fixa: (1) o que o produto **é**, (2) a arquitectura mínima que o sustenta, (3) o que tem de estar a funcionar para sair de beta privado. Tudo o resto é gordura adiável.

## 1. Identidade do produto (uma frase)

> Software para personal trainers gerarem, em 90 segundos, planos de treino cientificamente defensáveis a partir de uma avaliação real do cliente — com a marca do treinador no PDF.

Três coisas, e só estas, justificam o preço:
1. **Avaliação ACSM-grade adaptada ao equipamento disponível** (não "quick plan").
2. **Prescrição com base em evidência** (Bompa wave, NSCA increments, RPE auto-regulado).
3. **PDF white-label** que o treinador entrega com o nome dele.

Tudo o que não serve um destes três pilares é distracção até haver 50 PTs a pagar.

## 2. As 5 fronteiras do sistema (não negociáveis)

```text
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Assessment  │──▶│    Brief     │──▶│ Programming  │
│   (input)    │   │  (AI síntese)│   │ (determ. ctx)│
└──────────────┘   └──────────────┘   └──────────────┘
                                              │
                                              ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│     PDF      │◀──│  ViewModel   │◀──│ Microcycle + │
│   + /me      │   │   (puro)     │   │ Progressions │
└──────────────┘   └──────────────┘   └──────────────┘
```

Regra: **cada caixa lê apenas da caixa anterior, através de um tipo Zod versionado.** Se a Stage 3 precisa de algo da Assessment, passa pela Brief. Sem atalhos, sem `generation_meta` como saco de gatos.

## 3. Arquitectura mínima (o que tem de existir)

| Camada | Ficheiro único | Responsabilidade |
|---|---|---|
| Tipos | `src/server/contract.ts` | Zod schemas v1 para Assessment, Brief, ProgrammingCtx, Blueprint, Microcycle, Progressions, ViewModel |
| Resolução | `src/server/programming-context.server.ts` | `resolveProgrammingContext(planId)` → `{tier, rpeFloor, rpeCeiling, weeksToProgress, source}` |
| Matriz de campos | `src/lib/assessment-matrix.ts` | Tabela declarativa: `field → required_for → derives_to → blocks_finish_when` |
| View-model | `src/lib/plan-view-model.ts` | `buildPlanViewModel(planId)` puro, sem AI, sem fetches extra |
| Renderers | `src/lib/pdf.ts` + `src/components/PlanCard.tsx` | Só desenham. Zero lógica derivada |
| Criação de planos | `src/server/create-plan.functions.ts` | `createPlan({kind: "first"|"block_n+1"|"clone", parentId?})` — único caminho |
| Telemetria | `generation_log` | Toda a chamada AI escreve: stage, model, tokens, ms, retries |

Estes 7 pontos resolvem 80% dos bugs estruturais que apareceram nos últimos rounds (label "Day N", tier divergente, PDF re-derivar, lineage partido).

## 4. AI vs determinístico (linha vermelha)

| Etapa | Quem decide | Porquê |
|---|---|---|
| Brief (síntese) | AI | Subjectivo, linguagem |
| Programming context (tier, floors, deload) | Determinístico | Prescritível, auditável |
| Blueprint (arquétipos, mapa semana) | AI | Combinatória |
| Microcycle Semana 1 | AI | Selecção de exercícios |
| Semanas 2–N | Determinístico (Bompa wave + NSCA) | Não há razão para LLM aqui |
| Auto-regulação semana seguinte | Determinístico (RPE drift) | Já está em `programNextWeek` |
| ViewModel + PDF | Puro | Render é sagrado |

**AI nunca gera mais que 1 microciclo.** Já está na memória core; aqui fica como contrato arquitectural.

## 5. Gate de MVP (o que tem de fechar para abrir beta paga)

Critério: um PT estranho cria conta, paga, e em 30 minutos entrega um PDF com o nome dele a um cliente real, **sem ajuda humana**.

### P0 — bloqueia lançamento
1. **Onboarding do PT em < 5 min**: sign-up → upload de logo + nome do estúdio → primeiro cliente.
2. **Avaliação no-equipment baseline** funciona end-to-end (chair stand, sit-and-reach, 6MWT, RPE-anchored capacity). Sem isto, não há "ACSM-grade".
3. **Pipeline AI completo num plano** sem retries manuais (Brief→Blueprint→Microcycle Sem.1→Progressions determinísticas).
4. **PDF white-label** com logo, nome, cor primária, tagline do PT — labels PT-PT corretas ("Sessão N · Foco", nunca "Day N").
5. **`/me` (casa do cliente)** funcional em modo self: hero do plano + próxima sessão + esta semana.
6. **Quota + billing**: free = 1 plano, Starter/Pro/Studio com Stripe a cobrar e a desbloquear.
7. **Reset de estado fiável**: aprovar etapa 2 invalida etapas 3-5 (já parcialmente feito; auditar).
8. **Smoke 375px Mobile Safari**: criar plano completo no telemóvel sem partir layout.

### P1 — pode esperar 2-4 semanas pós-lançamento
- Bloco N+1 com adaptação (já existe; refinar UX da transição).
- Intensity Cockpit visível (já existe; só falta tour).
- Multi-modalidade gym + running.
- Reavaliação a 14 dias com chip "due".

### P2 — explicitamente fora do MVP
- Conjugate periodisation.
- DXA / force plate / dynamometer (gated por equipment).
- Education layer no PDF do cliente.
- Schedule + revenue (já mock; manter mock até haver pedido real).
- Exercise media library (vídeos próprios).
- ES/HI nativos (LLM-translated chega).

## 6. Princípios operacionais (já core, recordar)

- **Decision order**: looks → function → ease.
- **1 concern por round.** Não misturar refactor com feature.
- **Backup antes de qualquer SQL prod.**
- **Tudo via `t()` desde o primeiro caractere.**
- **Toda a chamada AI escreve `generation_log`.**
- **No "quick plan".** O produto é avaliação → prescrição. Sempre.

## 7. Caminho de execução sugerido (4 rounds)

| Round | Foco | Saída |
|---|---|---|
| R-A | Tipos + `resolveProgrammingContext` + matriz declarativa | Refactor invisível, zero feature nova; base para o resto |
| R-B | `buildPlanViewModel` + PDF/UI a consumir só dele | Bug "Day N" e similares desaparecem estruturalmente |
| R-C | `createPlan` único + auditoria do reset de estado downstream | Lineage estável, aprovações comportam-se sempre igual |
| R-D | MVP gate P0 (onboarding sub-5min + smoke Mobile Safari + Stripe end-to-end) | Pronto para abrir beta paga |

Cada round tem critério de "feito" objectivo (tipo OK, smoke 375px OK, generation_log a escrever, PDF visualmente conferido). Sem isto, não fechamos.

---

## Pergunta para o utilizador antes de começar

Concorda em começar pelo **R-A (refactor de tipos + programming context + matriz)**? É invisível para o utilizador final mas é a única via de não voltarmos a corrigir o mesmo bug em 3 sítios. Se preferir começar pelo gate de MVP (R-D), dizemos isso explicitamente e adiamos o refactor — sabendo que cada feature nova adiciona dívida.
