
## Diagnóstico

A página fica vazia por uma combinação de gates pessimistas, não porque a avaliação acabou:

1. **AssessmentSection retorna `null`** quando `collapsed=true` E `hideCollapsedStrip=true` (linha 4304–4305 de `clients_.$clientId.tsx`). A página passa sempre `hideCollapsedStrip` porque conta com a `ProtocolRail` para mostrar o toggle.
2. **ProtocolRail só renderiza** se `(heroPlan || plans.length > 0 || protocolRailOpen)`. Para um cliente sem plano e sem rascunho, nenhuma das três é verdade.
3. **`assessmentCollapsed`** ficou persistido a `true` numa sessão anterior em que tu colapsaste manualmente.

Resultado: zero toggle, zero conteúdo, zero forma de recuperar — só o header.

`IntakeLinkPanel` também não aparece porque a tua condição (`!submitted && !reviewed && !lastSavedAt`) falha quando há draft local (preencheste sozinho ⇒ `lastSavedAt` ficou setado).

## Objetivo

Garantir que a página do cliente **nunca fica em branco** numa fase legítima, e dar à fase "intake enviado, ainda sem dados úteis" um landing decente inspirado na linguagem do `/me`.

## O que vai mudar

### 1. Bug fix — assessment nunca desaparece (P0)

Em `clients_.$clientId.tsx`, alterar a condição que esconde o `AssessmentSection`:

- Se a `ProtocolRail` não renderiza E não há plano, **forçar `effectiveCollapsed = false`** (ignora a persistência).
- Manter o `hideCollapsedStrip` apenas quando há um toggle visível (rail aberto OU plano existe).

Resultado: o utilizador volta a ver a avaliação automaticamente quando não há outro lugar para a abrir.

### 2. Stage-1 hero (P1)

Novo componente `<ClientStageOneHero/>` em `src/components/ClientStageOneHero.tsx`. Renderiza só quando:
- Sem plano
- Sem briefing aprovado
- Não estamos em rascunho avançado

Estrutura (linguagem visual de `/me`):

```text
┌─ ClientStageOneHero ─────────────────────────────┐
│  AVALIAÇÃO · Etapa 1 de 5                        │
│  ●━━○━━○━━○━━○                                   │
│  Avaliação · Briefing · Plano-mestre · Semana · Progressões │
│                                                  │
│  [Continuar avaliação →]   [Ver como o cliente vê ↗] │
│                                                  │
│  Estado do link: enviado há 2d · ainda não aberto│
│  [Pedir nova avaliação]  [Copiar link]           │
└──────────────────────────────────────────────────┘
```

- Progresso: barra com 5 pontos (etapas do protocolo) com o atual em amber.
- CTA primário muda conforme o estado: "Continuar avaliação" se houver draft, "Pedir avaliação" se ainda nada.
- CTA secundário: "Ver como o cliente vê" → abre `/me?as={clientId}` (preview).
- Tira do estado do intake: usa `client.intake_status` + `intake_token_expires_at` para um sub-bloco compacto. Se o link já tiver caducado, badge âmbar "Caducado — gerar novo".
- Tudo via `t()` em `assessment.json` (chave `stage_one_hero.*`), PT/EN/ES.

Inserido logo após o header, antes do `IntakeLinkPanel`. O `IntakeLinkPanel` grande passa a ser secundário (dentro de um `<details>` "Detalhes do envio") porque o hero já cobre o essencial.

### 3. Limpeza pequena

- Remover do hero o `IntakeLinkPanel` solto que aparece duplicado quando `lastSavedAt` é null.
- Adicionar as 5 chaves de i18n em falta detetadas nos console logs (`training_block.loc_*`, `lifestyle_block.job_*`) — bug independente que apareceu enquanto investiguei.

## Fora de âmbito (próximos rounds)

- Conteúdo educativo / drawings no hero (Round H).
- Reformulação completa da `ProtocolRail` (continua tal como está, só deixa de ser obrigatória).
- Outros itens do `assessment-walkthrough-may-2026.md`.

## Ficheiros tocados

- `src/routes/clients_.$clientId.tsx` — fix do gate + integrar hero.
- `src/components/ClientStageOneHero.tsx` — novo.
- `src/i18n/locales/{pt,en,es}/assessment.json` — chaves do hero + as 5 chaves em falta.

## Validação

- Abrir `/clients/{id}` num cliente em estado idêntico ao do screenshot → ver hero + assessment expandida.
- Carregar em "Ver como o cliente vê" → abre `/me?as={id}` em modo preview.
- Forçar `assessmentCollapsed=true` em localStorage e recarregar → continua a ver o hero (assessment colapsada ok agora porque o hero já mostra estado).
- Criar plano de teste → hero desaparece, ProtocolRail volta a aparecer.
- Mobile 375px: hero empilhado, sem overflow.
- `bunx tsc --noEmit` limpo.

## Estimativa

~10 créditos. Concern único: "página do cliente nunca em branco na fase 1".
