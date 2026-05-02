## O que vejo no print

A página do plano tem:
- Header (botões: Share, Avaliação, PDF, Importar registo, Re-ancorar RPE, Delete, BrandMark)
- SUMMARY (32 anos, female, 166cm…)
- Banda do Bloco (estás no Bloco 1, "Iniciar Bloco 2")
- Banda amarela "Validação automática indisponível"
- Tabs: View · Edit · Log · **Resultados** · Progresso
- Tab Resultados aberta: 4 KPIs (Sessões, Adesão, RPE Médio, Tonelagem)
- Logo abaixo: gráfico "Tendência de RPE por sessão"
- **Depois há um vazio gigante até ao fim da página** — só com o título e subtítulo do gráfico, sem dados visíveis no fold
- Página 2 do PDF mostra Volume semanal e Top 5 exercícios — já dentro do scroll

Concordo: o fold da Tab "Resultados" está sub-aproveitado. O gráfico de tendência ocupa demasiada altura para o pouco que diz com 6 sessões. E os módulos visuais que valem a pena (volume semanal, top 5) estão escondidos no scroll.

## Ponto 2 — Análise de volume: prévia ou póstuma?

Não dizes disparate. Tens razão em parte, mas há nuance. Deixa-me ser honesto:

**O que a "Volume semanal" mostra hoje** (`src/components/volume/VolumeSection.tsx`): é um cálculo do **plano prescrito** — soma de séries por grupo muscular do que a IA programou, comparado contra os landmarks MEV/MAV/MRV (Israetel/Helms). Não usa dados de logbook.

**Implicação:**
- Se o plano não cumpre MEV/MAV no papel, **o auditor já devia ter chumbado antes do PT publicar** — esse é o teu argumento e está correcto. Mostrar "está abaixo de MEV" depois do plano estar `PRONTO` cheira a auditoria post-mortem que devia ter sido pré-flight.
- Mas há um caso legítimo para mostrar **volume realizado** (póstumo) na Tab Resultados: o que o cliente *fez* difere do que estava prescrito (saltou séries, parou cedo, RPE 10 cortou trabalho). Aí sim a análise de volume vale como retrospectiva.

**Conclusão honesta:** estás a apontar uma incoerência real. O componente actual está no sítio errado para o que faz. Duas opções:

1. **Mover o `VolumeSection` para o Blueprint (pré-flight)** — aparece enquanto o PT está a desenhar/aprovar, com semáforo claro: "este plano está abaixo de MEV em 3 grupos — confirma?". Não aparece na vista do plano `PRONTO`.
2. **Reescrever em "volume realizado vs prescrito" para a Tab Resultados** — usa dados de `workout_sessions` (já temos no compliance report). Mostra: "esta semana fizeste 12/16 séries de quadricípites previstas". Isto é trabalho de uns dias, não para agora.

A solução barata e correcta agora é a **opção 1**: mover o componente actual para o Blueprint, e tirar do plano `PRONTO`. Quando voltarmos, fazemos o "realizado vs prescrito" para a Tab Resultados.

## O que proponho fazer agora

### A. Aproveitar melhor a Tab Resultados (`src/routes/plans.$planId.tsx`)

Reorganizar a Tab Resultados em **grid denso** em vez de stack vertical alto:

```text
[ KPI Sessões ] [ KPI Adesão ] [ KPI RPE médio ] [ KPI Tonelagem ]
[ Tendência RPE por sessão (compacto, h≤200px) ] [ Top 5 exercícios — progressão (lado a lado) ]
[ Volume semanal realizado (placeholder honesto: "Só disponível quando ≥3 semanas registadas") ]
[ Logbook (tabela existente) ]
```

Mudanças concretas:
- Reduzir altura do gráfico "Tendência de RPE" (hoje aparenta 400px+, baixar para ~180px)
- Pôr "Tendência RPE" e "Top 5 exercícios" lado a lado em `lg:grid-cols-2`
- Remover o `<VolumeSection plan={...} />` desta vista

### B. Mover `VolumeSection` para a vista Blueprint (`src/routes/plans.$planId.blueprint.tsx`)

- Aparece apenas no Blueprint, com cabeçalho re-redigido: "Volume prescrito vs landmarks (Israetel/Helms) — verifica antes de publicar"
- Quando o plano está `PRONTO` e o PT volta ao Blueprint, ainda pode consultar — coerente com "isto é uma verificação de desenho"

### C. Ajuste honesto na vista do plano `PRONTO`

Onde estava o VolumeSection, colocar uma frase pequena e clara:
> "Análise de volume vs landmarks no separador **Blueprint**. Aqui mostramos volume realizado quando houver ≥3 semanas registadas."

Sem placeholder gráfico falso. Sem promessa que ainda não cumprimos.

## Ficheiros que vou mexer

- `src/routes/plans.$planId.tsx` — remover VolumeSection da vista principal e da Tab Resultados; reorganizar Resultados em grid denso; reduzir altura do gráfico de tendência
- `src/routes/plans.$planId.blueprint.tsx` — montar VolumeSection com novo cabeçalho de contexto

## O que NÃO vou tocar agora

- Lógica de cálculo de volume (`src/lib/volume-compute.ts`, landmarks) — fica intacta
- Auditor IA / chumbar plano por volume insuficiente — é um trabalho separado e maior; fica em backlog como **"Volume gate no auditor pré-publicação"**
- Reescrever para "realizado vs prescrito" — fica em backlog como **"Volume realizado na Tab Resultados (precisa ≥3 semanas de logs)"**

## Pergunta única antes de avançar

Concordas com mover a análise de volume para o Blueprint (pré-flight) e arrumar a Tab Resultados em grid denso? Ou preferes manter o volume na vista actual mas só com aviso "isto é o prescrito, não o realizado"?

Diz "continua" se aprovas o plano acima.