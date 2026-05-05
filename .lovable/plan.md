
## 1. Clientes diversos com fotos no `CoachWorkbenchMockup`

**Ficheiro:** `src/routes/index.tsx` (`CoachWorkbenchMockup`, ~L902)

Substituir os 3 nomes atuais por 5 clientes representativos, com alternância de género F-M-F-M-F e portraits reais (já temos a infra `randomuser.me` em `src/lib/demo-avatars.ts`):

| # | Nome | Género | Origem visual |
|---|------|--------|---------------|
| 1 | Sofia Almeida | F | Europa (branca) |
| 2 | Marcus Johnson | M | EUA (negro) |
| 3 | Priya Sharma | F | Índia (sul-asiática) |
| 4 | Kenji Tanaka | M | Japão (leste-asiático) |
| 5 | Larissa Souza | F | Brasil (latina) |

Mudanças no card:
- Substituir o círculo `RS/AP/MS` por `<img>` 36px com `object-cover rounded-full ring-1 ring-accent/30` e fallback de iniciais se a imagem falhar (`onError`).
- URLs hardcoded apontando para `randomuser.me/api/portraits/{men|women}/N.jpg` (estável, sem API). Escolher Ns que melhor representem cada perfil — não pretendemos rigor étnico absoluto (o pool é limitado), apenas uma boa impressão de inclusividade.
- Reduzir padding vertical para `py-2.5` (em vez de `py-3`) para acomodar 5 linhas sem inflar o card.
- Distribuir status para parecer realista: 1× intake, 1× ready, 2× active block, 1× revisão pendente.

## 2. Estabilizar altura do rotator do hero

**Ficheiro:** `src/routes/index.tsx` (`HeroVisualRotator`, L879)

Os 3 mockups (`HeroPlanMockup`, `CoachWorkbenchMockup`, `SoloTrainerMockup`) têm alturas diferentes → a página salta a cada rotação.

**Solução simples:** wrapper com `min-h-[640px]` (ou `lg:min-h-[720px]`) para reservar o espaço da maior variante. Mantém o `animate-fade-in` existente.

```tsx
<div className="min-h-[640px] lg:min-h-[720px]">
  <div key={idx} className="animate-fade-in">…</div>
</div>
```

Ajustar valor depois de medir as 3 alturas reais; se ainda saltar levemente em mobile, adicionar `min-h-[760px]` em `sm:` apenas.

## 3. Refinar a postura "AI" pela landing/app

A crítica do feedback que mais aplica ao Protocol: "AI como copiloto, não substituto; decisão final é humana; baseada em evidência (ACSM)". Mudanças cirúrgicas, sem reescrever páginas:

**Landing (`src/routes/index.tsx` + `i18n/locales/{pt,en}/common.json`):**
- Chip "Guiado por IA" no `SoloTrainerMockup` → **"Copiloto IA · tu decides"** / "AI copilot · you decide".
- No `CoachWorkbenchMockup`, footer "Construído por um coach" mantém-se (já é honesto).
- Adicionar uma micro-linha sob o H1 do hero (ou no `personalized_hint`): **"IA enquadra. Tu decides. ACSM como base."** — uma frase, não um parágrafo.
- Onde aparece "Personalizado pela IA" no `HeroPlanMockup` → **"Enquadrado por IA · validado por ti"**.

**Atlas (copilot global):** validar que o subtítulo do AtlasGenie/AtlasDock já reflete "copiloto", não "assistente que faz por ti". (Read-only check; alterar só se o copy atual for ambíguo.)

**O que NÃO fazemos agora** (backlog, fora do escopo):
- Repensar o ModelPicker UX.
- Banner "como usamos IA" dedicado — se o utilizador quiser, criamos depois um `/about/ai` curto.
- Social/forum/comparações (wet dream, fica no backlog).

## Ficheiros tocados

- `src/routes/index.tsx` — clientes diversos + foto, `min-h` no rotator, copy IA dos chips
- `src/i18n/locales/pt/common.json` + `src/i18n/locales/en/common.json` — novas chaves para chips IA refinados

## Fora do escopo deste round

- Mudar pool de portraits para auto-hospedados (continuamos com randomuser.me; já é o que o demo seeder usa).
- Criar componente `<DemoAvatar>` partilhado (pode vir num round de refactor).
- Página `/about/ai` ou manifesto público — fica no backlog se quiseres.
