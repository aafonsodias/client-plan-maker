
# Limpar e aligeirar — foco no que ajuda

Três frentes, todas a remover peso e a alinhar com "básico bem feito":

---

## 1. Bug do header do plano (sobreposição "Maria (demo) / Share")

**Problema:** O nome do cliente (link "→ Maria Costa (demo)") e o título estão a colidir com a barra de botões (Share · Avaliação · Exportar PDF · Folha de registo). Quatro botões à direita + título largo + nome empilhado = caos visual em ~1550px.

**Decisões:**
- **Fundir os dois botões PDF num só.** Em vez de "Exportar PDF" + "Folha de registo" (que confunde — qual escolho?), fica **um botão "PDF" com dropdown** (ou um split-button): "Plano completo" / "Folha de registo (semana X)". Menos botões, escolha clara.
- **Mover "Avaliação" para dentro de um menu "Mais" (⋯)** junto a Share. A Avaliação é trabalho de bastidor, não acção quotidiana.
- **Reduzir altura visual do header:** o título usa `<Input>` com `!text-xl` que cresce demais — passa a render-as-text com lápis de edição inline (clicar para editar). Pequena mudança, header fica 30% mais baixo.

Resultado: cliente + título à esquerda numa linha, **dois botões à direita** (PDF, Mais), os chips (Pronto, Bloco N) numa segunda linha discreta.

---

## 2. PDF: um só, com folha de registo integrada

**Hoje:** dois PDFs. `generatePlanPdf` (paisagem, denso, deixa metade da página em branco como vês na screenshot) + `generateLogsheetPdf` separado (que tu nem usas porque tens de saber que existe).

**Proposta:** **um único PDF do plano** (o "Exportar PDF" actual), em que **cada dia ocupa uma página** assim:
- **Topo (≈55%):** o que já tens — exercícios, cues, sets/reps/RPE, semanas W2–W4 com progressão (mantém-se igual; é informação de leitura).
- **Baixo (≈45%, hoje em branco):** uma **grelha de registo manual** com colunas vazias para escrever à mão:
  - Linhas de campos rápidos: `DATA · INÍCIO · FIM · RPE acordar · Peso hoje · Sono`.
  - Tabela com uma linha por exercício e **3–4 colunas vazias "S1 / S2 / S3 / S4"** para anotar `peso × reps @RPE` por série.
  - Espaço de notas livre no fim (~3 linhas).

Assim o PDF que imprimes serve ambos os usos: ler no início + escrever durante a sessão. Depois passas para o software via "Importar log".

**O `generateLogsheetPdf` separado deixa de ser necessário** → removemos a função e o segundo botão. Menos código, menos decisões.

---

## 3. Secção "Volume semanal" — aligeirar

Conforme a screenshot, o radar está a tocar nas labels e a tabela tem 5 colunas + frases longas em cada linha. Demasiado ruído para uma secção de diagnóstico.

**Mudanças cirúrgicas (sem mudar a lógica de cálculo):**
- **Radar:** mais respiração — `outerRadius` 78% → 65%, fonte das labels +1pt, abreviar "Quadricípites"→"Quad", "Isquiotibiais"→"Isquios", "Tricípites"→"Tri", "Bicípites"→"Bi". Labels deixam de tocar nos polígonos.
- **Tabela:** colapsar a coluna "MEV / MAV / MRV" para tooltip no chip "Estado" (já tens o tooltip de explicação no header). Fica: **Grupo · Séries · Estado · Sugestão**. Quatro colunas em vez de cinco.
- **Sugestão mais curta:** "Adiciona ~2 séries para chegar ao MEV (8)." → "Faltam 2 séries (alvo 8)." A informação útil é a mesma; menos texto.
- **Manter as cores do `status-tone`** (já está consistente com o resto do app — emerald/amber/red/neutral).

---

## Ficheiros tocados

- `src/routes/plans.$planId.tsx` — header (botões agrupados, título inline-edit), remover dropdown "Folha de registo".
- `src/lib/pdf.ts` — `generatePlanPdf`: adicionar bloco de registo manual no rodapé de cada página de dia. Remover `generateLogsheetPdf` (e o import).
- `src/components/volume/MuscleVolumeRadar.tsx` — radius + labels abreviadas.
- `src/components/volume/VolumeStatusTable.tsx` — eliminar coluna MEV/MAV/MRV, encurtar mensagens.

## O que NÃO mexo (para resistir ao overengineering)

- Cálculo de volume (`volume-compute.ts`, `volume-landmarks.ts`) — está bem.
- Demo Lab / bots — fica como está, só visível quando precisas de stress-test. Não estorva o fluxo normal.
- Concierge, studies feed, dropoff alerts — não tocados nesta ronda.

Aprova com "continua" e avanço.
