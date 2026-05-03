
## 1. Logbook clicável (drawer da sessão)

**Onde**: `src/components/ResultsPanel.tsx` (tabela "Logbook") e `src/routes/plans.$planId.tsx`.

- Tornar cada linha do Logbook clicável (não só o ícone).
- Abrir um `Sheet` lateral com:
  - cabeçalho: data · `Wn · Day label · focus`
  - lista de exercícios (prescrição vs actuals: sets×reps×carga, RPE)
  - bloco "Feedback do cliente" (se existir `client_feedback.text`)
  - botão "Editar no Workbench" → leva ao dia correspondente
- Reutilizar `SessionDayView` se ele já renderiza isto; caso contrário, criar um pequeno `LogbookSessionSheet.tsx`.

## 2. PDF do plano — uniformizar e limpar

**Onde**: `src/lib/pdf.ts` (`generatePlanPdf`).

Problemas confirmados pelo PDF enviado:
- Cabeçalhos de sessão inconsistentes ("Day 1 — Upper Push & Pull" vs "Day 2 — Week 1"). Causa: arquetipos usam `day_label` cru, e quando o `day_label` foi gerado como "Day 2" sem focus, mostra "Week 1" no lugar do focus.
- Página de "Plan at a glance" é redundante quando já existe título de sessão por página.
- Footers/headers pesados; faltam regras consistentes.

Acções:
1. **Normalizador de cabeçalho de sessão**: helper `formatSessionHeader(arc)` que devolve sempre `"<Day N> · <Focus>"`, derivando "Day N" da posição na semana (1..N) e nunca usando "Week X" como focus. Aplicar tanto no header de página como na tabela "Plan at a glance".
2. **Remover** o cabeçalho duplicado "Day 2 — Week 1" no fundo da página (origem da confusão na screenshot do PDF).
3. **Tipografia**: 1 pt a mais nas linhas da tabela principal, line-height +10%, e separar `sets×reps` da coluna `RPE/tempo` com pipe vertical em vez de espaço.
4. **Cover**: encolher a banda do cabeçalho para 56pt e baixar o KPI strip para ficar com mais respiro.
5. **Smoke test**: gerar 1 PDF de regressão com plano demo e abrir como imagem (`pdftoppm`) para QA visual antes de fechar.

## 3. Documentos do cliente + Ask Forge como router de ficheiros

**Bucket novo** (migration): `client-documents` (privado), path `{trainerId}/{clientId}/<uuid>-<filename>`. RLS: trainer só vê os seus.

**UI**: nova aba "Documentos" em `clients_.$clientId.tsx`:
- lista de ficheiros (nome, tipo, data, download via signed URL)
- drag-and-drop / botão upload (`uploadClientDocument` server fn)
- ícone por tipo (PDF, imagem, etc.)

**Ask Forge router** (`src/components/AskForgeDock.tsx` + nova `routeUpload.functions.ts`):
- Aceitar anexos no painel de chat (já temos contexto de cliente activo).
- Se for **imagem** → pedir ao Lovable AI Gateway (Gemini 2.5 Flash, vision) para classificar em: `posture_photo` | `medication_label` | `medical_exam` | `other`.
  - posture_photo → `client-photos` no slot livre (front/side/back/face).
  - medication_label → OCR do nome + regista em `clients.extended.medications[]`.
  - medical_exam → `client-documents` com tag "exam".
- Se for **PDF/doc** → `client-documents` (tag "exam" por defeito; AI sugere tag).
- Mostrar no chat um card "Arquivado em X" com link e opção "mover para Y".

## 4. Voz no Ask Forge

**Onde**: `src/components/AskForgeDock.tsx`.

- Botão microfone usando `window.SpeechRecognition` / `webkitSpeechRecognition` (graceful fallback se indisponível).
- Locale = `pt-PT` por defeito (cair no idioma do i18n).
- Estado visual (a gravar / a transcrever) e tecla espaço para parar.
- Sem dependências novas; sem servidor.

## 5. Logo + Hero da landing

**Logo**:
- Substituir `src/assets/forge-logo.png` pela versão do GPT (já copiada para `src/assets/forge-logo-gpt.png`). Se a luminância testar bem, promover para `forge-logo.png` (ficheiro principal, mantendo o nome para o resto da app).
- `BrandMark`: aumentar `md` (h-14/w-14) e `lg` (h-20/w-20). Reforçar glow âmbar (drop-shadow duplo, raio maior em `lg`).

**Hero** (`src/routes/index.tsx`, secção `Hero`):
Reorganização para "ease of use, function, beauty":
- Coluna esquerda passa a ter ordem fixa: BrandMark `lg` + wordmark → eyebrow ("Forge personal training plans, instantly") → H1 (2 linhas máx) → sub (1 linha) → 1 chip social-proof → CTA primário + secundário → micro-copy "Conta grátis · 1 cliente · 1 plano · sem cartão".
- Remover o segundo BrandMark do hero (está no nav já).
- Coluna direita: manter `HeroPlanMockup` mas com glow ainda mais subtil para o logo grande respirar.
- Mobile: BrandMark `md`, H1 a 3.25rem.

## 6. Limpeza de redundâncias detectadas

- Logo aparece no nav e dentro do hero — passa a aparecer só no hero (mais impacto) com nav a usar apenas wordmark + glow.
- Botão "Ver exemplo de plano PDF" fica como link discreto sob o CTA, em vez de ocupar uma row inteira nos benefits.

---

## Detalhes técnicos

**Migration** (storage):
```sql
insert into storage.buckets (id, name, public) values ('client-documents','client-documents', false);
-- RLS: trainer dono do path (split_part(name,'/',1) = auth.uid()::text)
create policy "trainers manage own docs" on storage.objects
  for all using (bucket_id='client-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id='client-documents' and (storage.foldername(name))[1] = auth.uid()::text);
```

**Server functions a criar**:
- `src/server/client-documents.functions.ts` → `listClientDocuments`, `uploadClientDocument`, `deleteClientDocument`, `getSignedDocUrl`.
- `src/server/forge-router.functions.ts` → `classifyAndRouteUpload({ clientId, file })` chamando Lovable AI Gateway (`google/gemini-2.5-flash`).

**Ficheiros editados**:
- `src/lib/pdf.ts`, `src/components/ResultsPanel.tsx` (+ novo `LogbookSessionSheet.tsx`), `src/components/AskForgeDock.tsx`, `src/components/BrandMark.tsx`, `src/routes/index.tsx`, `src/routes/clients_.$clientId.tsx`, `src/assets/forge-logo.png`.

**Sem alterações**: schema de planos, motor de geração, demo seeding.

---

## QA antes de fechar

1. Gerar PDF do mesmo plano demo e abrir como imagem para confirmar que todos os blocos de sessão dizem `Day N · Focus`, sem "Week X" como focus.
2. Abrir Logbook → clicar numa linha → ver sessão completa no drawer.
3. No Ask Forge, fazer upload de uma imagem de exame e confirmar que aparece em "Documentos" do cliente.
4. Mic no Ask Forge ditando uma frase em PT.
5. Lighthouse rápido na landing: hero acima da dobra mostra logo grande + H1 sem scroll em 1440×900.
