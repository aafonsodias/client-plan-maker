## O problema

Hoje o botão **"Iniciar briefing IA"** aparece assim que:
- o intake foi enviado/recebido, **OU**
- houve qualquer auto-save de campo

Resultado: o treinador (ou o próprio cliente) pode disparar a IA com a ficha quase vazia — desperdiça créditos e produz briefs sem substância. Em paralelo, não há sítio óbvio para meter dados de aparelhos que estão a ficar comuns (balança Tanita, dinamómetro Jamar de preensão).

## O princípio

A barra mínima para gerar um plano honesto é a **ficha que um PT em domicílio (ou uma pessoa comum sozinha) consegue preencher sem laboratório**. Tudo o que vier de aparelhos (Tanita, Jamar, tensiómetro, banda de FC) é **bónus opcional** que enriquece o brief mas não bloqueia.

## Plano

### 1. Gate de "Brief Mínimo Viável" (BMV)

Definir checklist server-side em `src/lib/brief-minimum.ts` com 6 condições obrigatórias (todas preenchíveis numa visita domiciliária, sem equipamento):

```text
1. Identidade básica         → sexo, data nascimento, altura, peso
2. PAR-Q                     → respondido (passa ou flagged-com-justificação)
3. Objetivo SMART            → primary_goal + smart_specific
4. Disponibilidade           → training_days_per_week + session_duration_minutes
5. Contexto/equipamento      → training_location + available_equipment (≥1)
6. Sinal de prontidão        → readiness_stage OU sleep_quality OU stress_level
```

E 3 condições "fortemente recomendadas" (não bloqueiam, mas baixam confiança):
- 1 perímetro (cintura) **ou** 1 marcador de composição
- 1 sinal cardiovascular (FC repouso **ou** TA)
- 1 movimento avaliado (squat, hinge, overhead, ou single-leg)

**Estados do CTA principal** (substituem a lógica em `clients_.$clientId.tsx:1654-1673`):

| Estado | Aparência | Ação |
|---|---|---|
| `< BMV` (faltam obrigatórios) | Botão **disabled** com chip âmbar "Faltam X campos · ver" | Scroll para 1.ª secção em falta |
| `BMV ok, recomendados <3` | Botão **enabled** + chip neutro "Brief enxuto · podes enriquecer" | Inicia briefing |
| `BMV + recomendados ok` | Botão **enabled** emerald "Pronto a gerar" | Inicia briefing |

A lista de "o que falta" abre num popover com links que fazem scroll a cada secção. Sem termos como "completion %" — é uma checklist humana ("Falta: peso, dias por semana, equipamento").

### 2. Captura de dados de aparelhos

Aproveitar o que já existe — `client_capacity_snapshots` aceita qualquer `test_used + raw_value + raw_unit` — e dar-lhe duas portas de entrada honestas dentro do assessment:

**A. "Importar da Tanita" (ou outra balança bioimpedância)**
- Botão na secção **Antropometria**, ao lado do "+ Adicionar perímetro".
- Abre uma folha (Sheet) com campos Tanita-style numa grelha:
  - Peso, % gordura, % músculo, gordura visceral, água total, idade metabólica, BMR
  - Opcional: segmental (braço E/D, perna E/D, tronco) — colapsado
- Cada campo tem placeholder com unidade ("ex: 22.4 %") e popover "Como ler?" com mini-imagem do display da Tanita.
- Submit grava 1 snapshot por campo preenchido (`domain_slug = body_composition`, `provenance = 'pt_assessed'`, `notes = 'Tanita import'`). Vazios são ignorados.
- Bonus prático: campo "Modelo" (texto livre) guardado em `notes` para rastreabilidade.

**B. "Força de preensão (Jamar)"**
- Aparece dentro da secção **Performance** como bloco próprio.
- 3 campos por mão (3 tentativas D, 3 tentativas E) em kg.
- Calcula automaticamente o **máximo por mão** + assimetria (%).
- Grava como snapshots no domínio `muscular_endurance` (ou `strength` se existir) com `test_used = 'grip_right' / 'grip_left'`.
- Popover "Como medir?" com instruções ACSM padrão (cotovelo a 90°, 3 tentativas, descanso 1 min, melhor de 3) e norma por idade/sexo abaixo do resultado.

**C. Arquitetura genérica para o futuro**
- Os 2 painéis acima são instâncias de um componente novo `<DeviceCaptureSheet>` configurado por um catálogo em `src/lib/devices.ts`:
  ```ts
  { id: 'tanita_bc601', label: 'Tanita BC-601', domain: 'body_composition',
    fields: [{ key: 'body_fat_pct', unit: '%', testUsed: 'body_fat_bia' }, ...] }
  { id: 'jamar_dyno', label: 'Dinamómetro Jamar', ... }
  ```
- Adicionar mais aparelhos no futuro (tensiómetro Omron, Polar H10, fita métrica laser…) é só estender o catálogo.

### 3. Reflexo no BMV

Os snapshots dos aparelhos satisfazem automaticamente as condições "fortemente recomendadas" do BMV:
- snapshot `body_fat_*` ou `waist_circumference` → marca "composição" como ok
- snapshot `grip_right/left` → marca "performance" como ok (extra)
- snapshot `resting_heart_rate` ou `blood_pressure_*` → marca "cardiovascular" ok

O treinador vê em tempo real o checklist a ficar verde à medida que importa.

## Ficheiros tocados

```text
src/lib/brief-minimum.ts                       (novo) — checklist + checker
src/lib/devices.ts                             (novo) — catálogo Tanita/Jamar/...
src/components/assessment/DeviceCaptureSheet.tsx (novo)
src/components/assessment/BriefMinimumChecklist.tsx (novo) — popover do botão
src/routes/clients_.$clientId.tsx              — gate do CTA + 2 botões "Importar"
src/i18n/locales/{pt,en}/assessment.json       — labels novos
src/assets/device-tanita.png                   (gerado) — referência visual
src/assets/device-jamar.png                    (gerado) — referência visual
```

Sem migrações: tudo cabe na tabela `client_capacity_snapshots` que já existe.

## Fora deste plano (registo para futuro)

- Sincronização automática Bluetooth com Polar/Tanita Wi-Fi → exige PWA + pareamento, fica para um round dedicado.
- OCR de foto do display da Tanita → adicionável depois ao mesmo `DeviceCaptureSheet`.
- Importar CSV histórico → idem.