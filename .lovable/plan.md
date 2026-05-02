## Diagnóstico do PDF da Sofia (4 páginas)

Olhei página a página. Está a funcionar — mas tem ruído que estraga a folha como ferramenta de ginásio.

**Problemas reais que vi:**

1. **Página 4, cabeçalho cortado.** A primeira linha começa com "INE), PUSH-FORGE VARIATION, ANTI-ROTATION…" — é o resto do título do dia anterior a fugir para a página seguinte. O wrap do título do bloco está a transbordar.

2. **REGISTO MANUAL duplica a tabela de cima.** Hoje o plano tem:
   - Tabela principal: # · EXERCISE · CUE · SETS · REPS · REST · RPE · TEMPO · W2 · W3 · W4
   - Logo abaixo: outra tabela com # · EXERCÍCIO · S1 · S2 · S3 · S4 (vazia)
   
   O PT lê em cima, escreve em baixo, e tem de procurar o número do exercício duas vezes. Para uma folha A4 que vai amassada no bolso, isto é demasiado.

3. **As colunas W2/W3/W4 só fazem sentido a partir da semana 2.** Na página da semana 1, ocupam 3 colunas com "—" ou progressões que ainda não interessam.

4. **Falta um campo "OBSERVAÇÕES"** — o que o PT escreve à mão (joelho hoje, dormiu mal, mudei o exercício 3) hoje não tem onde caber.

5. **Título do dia 3 fica "Horizontal pressing (DB neutral-grip, landmine), push-up variation, anti-r…"** — truncado. Ou cabe inteiro em duas linhas, ou usamos o nome curto "Upper Push & Stability".

## Proposta — uma só tabela, leitura + escrita

Em vez de duas tabelas, uma só. As colunas W2/W3/W4 desaparecem em folhas da semana 1 e dão lugar a **S1 · S2 · S3 · S4** (slots de mão escritos pelo PT). Para a semana 2+, as colunas de progressão voltam mas mais magras e os slots de escrita ficam por baixo de cada linha como uma sub-linha fina.

Layout proposto (semana 1):

```text
# EXERCÍCIO          CUE              SETS REPS REST RPE  S1        S2        S3        S4
01 Dead bug          Ribs down…       3    8/s  60s  6.5  ___ ___   ___ ___   ___ ___   ___ ___
02 Goblet squat      Knees out…       4    8    120s 6.5  ___ ___   ___ ___   ___ ___   ___ ___
…
```

Cabeçalho da página (uma linha apenas):

```text
DATA ____  INÍCIO ____  FIM ____  PESO ____ kg  SONO ____ h  RPE ACORDAR ____
OBSERVAÇÕES ___________________________________________________________________
              ___________________________________________________________________
```

Vantagens:
- O PT lê e escreve na mesma linha do mesmo exercício — zero deslocação visual
- Cabe na mesma página A4 sem aperto
- Uma linha de "OBSERVAÇÕES" no topo resolve os recados gerais; tempo já não exige duas tabelas
- Para semanas 2+ mantemos uma coluna fina "alvo" (ex: `@6.5 +0.5`) ao lado dos slots em vez de 3 colunas separadas

## Mudanças concretas no código

**`src/lib/pdf.ts`** (substituir o bloco actual de duas tabelas):
- Remover o segundo bloco `REGISTO MANUAL` (linhas ~735-834)
- Na tabela principal, substituir as colunas `W2 · W3 · W4` por `S1 · S2 · S3 · S4` quando `weekNumber === 1`
- Para `weekNumber >= 2`, manter uma única coluna fina "alvo desta semana" + slots S1–S4 escritos
- Adicionar tira fina por cima da tabela: `DATA · INÍCIO · FIM · PESO · SONO · RPE ACORDAR` (já existe, manter — mas integrada com a tabela, não separada)
- Adicionar 2 linhas para "OBSERVAÇÕES" abaixo da tira de campos rápidos
- Garantir que o título da sessão faz `splitTextToSize` correcto (corrige o overflow da página 4)
- Truncar/pular o subtítulo longo: usar `arc.short_name || arc.name` se existir; fallback ao nome longo com `splitTextToSize` em 2 linhas máximas

**Não tocar agora em:**
- Esquema da BD
- Lógica de geração de plano (Anthropic)
- Como o PT importa de volta (foto / OCR continua igual)

## Sobre os "desafios extra" (escada de agilidade, dead hang, dupla tarefa cognitiva)

Esta pergunta é de produto, não de código. A minha leitura honesta:

- **Sim, faz sentido** — encaixa no posicionamento "saúde através de exercício" (dead hang = descompressão da coluna; dupla tarefa = cognição motora; escada = coordenação)
- **Mas não agora.** O software ainda está a fazer o básico bem feito. Adicionar uma biblioteca de "challenges" agora é peso morto até a folha de registo estar afinada e o PT estar a usar a app em sessões reais.
- **Sugestão:** guardar como nota no `mem/tasks/backlog.md` com a tag `[depois-de-prova-de-uso]`. Quando voltarmos, fazemos uma "biblioteca de finalizadores" opcional que o PT puxa para o último bloco de uma sessão (1 click → adiciona dead hang 1×30s ou ladder drill 3×). Não é uma feature pesada quando chegarmos lá.

## O que peço para confirmares antes de avançar

1. **Layout da nova tabela única** (S1–S4 ao lado dos campos planeados, não em tabela separada) — ok?
2. **Campo OBSERVAÇÕES no topo** com 2 linhas em branco — ok? Ou preferes no rodapé da página?
3. **"Desafios extra" para o backlog** — confirmo que parqueio sem implementar?

Diz "continua" se concordas com tudo, ou aponta o que mudar.