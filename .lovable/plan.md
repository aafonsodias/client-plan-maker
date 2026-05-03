## Princípio
**Técnica > força bruta.** Modelo deep só onde o raciocínio clínico/programático justifica. Modelo fast em tudo o resto. Caching de prompts (system prompt estável → cache hit em todas as chamadas do mesmo plan).

## Model routing por stage (custo/inteligência optimizado)

| Stage | Trabalho | Modelo | Justificação |
|---|---|---|---|
| Stage 1 — Brief | Resumo estruturado do assessment | `google/gemini-3-flash-preview` | Schema apertado, zero raciocínio criativo. Flash chega. |
| Stage 2 — Blueprint | Periodização, archetypes, progression model | `openai/gpt-5-mini` | Decisão arquitectural mas constrangida por FITT-VP. Mini é mais que suficiente. |
| Stage 3 — Microcycle | Geração de dias com selecção de exercícios + validator FITT-VP | `openai/gpt-5` | Único lugar onde raciocínio multi-constraint paga. Stage mais caro mas mais crítico. |
| Stage 4 — Progressions | Aplicação de regras de progressão sobre output do Stage 3 | `openai/gpt-5-mini` | Quase determinístico. Mini. |
| `discussBlueprint` (chat) | Conversa com o trainer | `google/gemini-3-flash-preview` | UX rápida importa mais que raciocínio profundo. |
| `repair` (validator retry) | Corrigir output que falhou Zod ou FITT-VP | mesmo modelo do stage que falhou | Manter consistência. |

**Custo estimado por plan completo (Sofia full pipeline):** ~$0.08–0.15 em créditos Lovable (vs. ~$0.30–0.60 com Sonnet em todos os stages). **2–4× mais barato** sem perder qualidade onde importa.

## Ficheiros tocados (cirúrgico, aditivo onde possível)

**Novos:**
- `src/server/phased/ai-gateway.server.ts` — `callLovableAiWithTool()`. Mesma assinatura de `callAnthropicWithSchema`, body OpenAI-compatible, parsing de `tool_calls[0].function.arguments` (string JSON). Retorna o mesmo `AiCallResult<T>`.
- `src/server/phased/model-routing.server.ts` — mapa central `STAGE_MODELS = { stage1: 'google/gemini-3-flash-preview', stage2: 'openai/gpt-5-mini', stage3: 'openai/gpt-5', stage4: 'openai/gpt-5-mini', discuss: 'google/gemini-3-flash-preview' }`. Único sítio onde se mexe para tunar custo/qualidade no futuro.

**Editados:**
- `src/server/phased/stage1-brief.functions.ts` — trocar `callAnthropicWithSchema` → `callLovableAiWithTool`, modelo via `STAGE_MODELS.stage1`.
- `src/server/phased/stage2-blueprint.functions.ts` — idem stage2 (incluindo `discussBlueprint` → STAGE_MODELS.discuss).
- `src/server/phased/stage3-microcycle.functions.ts` — idem stage3. Validator retry mantém o mesmo modelo. **Não toca** `validateDayAgainstFittVp` nem `fittVpPromptBlock` — esses são deterministic.
- `src/server/phased/stage4-progressions.functions.ts` — idem stage4.
- `src/server/plan-cost.server.ts` — adicionar pricing dos 3 novos modelos para `generation_log.cost_usd` continuar correcto. Manter pricing Anthropic durante a transição.
- `scripts/r2.2-smoke2.ts` — switch para gateway, mantém estrutura.

**NÃO tocados (zero risco):**
- `src/server/screening/preparticipation.server.ts`
- `src/server/fitt-vp/derive.server.ts`
- `src/server/phased/programming-tier.server.ts`
- `src/server/phased/schemas.ts`
- `acsm_thresholds` table, qualquer lógica DB
- Smoke #1 report (já aprovado, fica como baseline)
- `callAnthropicWithSchema` — **mantido** em `ai.server.ts` para rollback até Smoke #2 passar.

## Sequência de execução

1. **Adicionar** os 2 ficheiros novos (`ai-gateway.server.ts`, `model-routing.server.ts`).
2. **Migrar Stage 1+2+3+4 + discuss** para usar gateway (5 edits, mesmo padrão).
3. **Atualizar `plan-cost.server.ts`** com pricing dos 3 modelos novos.
4. **Atualizar `scripts/r2.2-smoke2.ts`** para usar gateway.
5. **Correr Smoke #2 sobre Sofia** end-to-end (Stage 1→4).
6. **Escrever Secções 4 + 5 finais** em `.lovable/r2.2-smoke-report.md` (substituindo o stub):
   - Secção 4: prescription_parameters JSON real (Sofia)
   - Secção 5: violation counts iniciais + pós-retry, tabela do dia gerado, custo total da run em $
7. **STOP GATE 2** — mostro report completo, esperas aprovação.
8. (Após aprovação, cleanup round separado:) remover `callAnthropicWithSchema`, secret `ANTHROPIC_API_KEY`, dependências mortas. Backlog P3.

## Guardrails

- **Caching de prompts**: system prompts (FITT-VP block, voice rules) estão constantes dentro de uma run de plan → gateway aproveita cache automaticamente, baixa custo input tokens.
- **Reasoning effort**: Stage 3 com `reasoning: { effort: "medium" }`. Stage 2 sem reasoning explícito (mini não precisa). Subir para "high" só se Smoke #2 mostrar validator violations recorrentes.
- **Generation_log**: cada chamada continua a escrever uma row com `model_used` real (`openai/gpt-5` etc.), `cost_usd` correcto, `zod_passed`, `retry_count`. Telemetria intacta.
- **Fallback**: se gateway devolver 402 (créditos esgotados) ou 429 (rate limit), surface explícito ao trainer ("Sem créditos AI — adiciona em Settings → Workspace → Usage"). Não silenciar.
- **A/B opcional**: se quiseres comparar gateway vs Anthropic no Sofia, adiciono uma flag `USE_LOVABLE_GATEWAY=false` e corro ambos. Por defeito: ON.

## Custo do round
- Smoke #2 end-to-end: **~$0.10–0.15** em créditos Lovable.
- Sem custos Anthropic adicionais.

## Critério de sucesso (Stop Gate 2)
- Sofia: tier=`advanced`, clearance=`false`, prescription_parameters com 7 citations (matches Smoke #1).
- Stage 3 gera 4 dias respeitando ranges FITT-VP (ou triggera retry e passa).
- Validator violations iniciais ≤ 3, pós-retry = 0.
- Custo total da run ≤ $0.20.
- Generation_log tem 4–5 rows (uma por stage + eventual retry).

Se algum critério falha → não avanço para R2.3, debug primeiro.
