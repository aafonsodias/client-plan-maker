## **PLAN** — só uma revisão final, não código.

---

Migration revista está aprovada. As 3 notas resolvidas exatamente como queria. Duas micro-observações antes de aplicares — nenhuma bloqueia.

### Obs 1 — Nomes das chaves dos signs/symptoms

No trigger usaste estes nomes:

```
chest_discomfort, unreasonable_dyspnea, dizziness_syncope,
orthopnea_pnd, ankle_edema, palpitations_tachycardia,
intermittent_claudication, known_heart_murmur, unusual_fatigue

```

Mas no comment da coluna `signs_symptoms` original (Migration A) tinhas:

```
chest_pain, dyspnea, syncope, orthopnea, ankle_edema, palpitations,
claudication, murmur, unusual_fatigue

```

São listas diferentes. Os nomes do trigger são **mais clinicamente precisos** (ACSM 12e Box 2.1: "unreasonable dyspnea", "dizziness or syncope", "orthopnea or PND", "palpitations or tachycardia") — preferi-os.

**Atualiza o COMMENT da coluna** `signs_symptoms` **para espelhar as chaves canónicas do trigger.** Senão fica drift entre comment (documentação) e trigger (enforcement). Mesma lista nos dois sítios.

### Obs 2 — Backfill no fim de R2.2 deve ser idempotente

Quando correres o backfill de `cvd_risk_factors`:

- Script tem de ser **idempotente** (correr 2x seguidas dá o mesmo resultado, não duplica nada)
- Filtrar **só** assessments com `cvd_risk_factors = '{}'::jsonb` (não tocar nas que já foram classificadas pelo algorithm em writes pós-R2.2)
- Reportar contagem: `total_assessments`, `already_classified`, `newly_classified`, `errors_per_reason` no smoke report
- Wrap em transaction com savepoints por assessment — se uma falhar (e.g. dados inconsistentes), continua nas outras e reporta no fim

Não é trabalho extra agora — só queria isto explicito antes de chegares lá.

### Aprovação

**Aplica Migration A revista** com a correção do COMMENT (Obs 1). Obs 2 fica registada para R2.2.

Depois disso:

1. Mostra-me o seed dos 17 thresholds (parameter keys em snake_case descritivo) **antes** de aplicar.
2. R2.2 algorithm + smoke report. **Stop gate até eu aprovar o smoke**.
3. R2.2 backfill idempotente conforme Obs 2.
4. R2.3 só depois.

Avança.  
Migration A — Revisões às 3 notas

### Nota 1 — `cvd_risk_factors` populating strategy (resposta, sem mudar migration)

**Plano confirmado:** populated **on-write apenas** via `runPreparticipationAlgorithm()` em R2.2. Sem trigger derivado em SQL — manter a lógica de classificação ACSM Ch.2 em TypeScript (testável, citável, debugável) e não em PL/pgSQL.

- Assessments existentes ficam com `cvd_risk_factors = '{}'` (default) até serem re-saved.
- **Backfill no fim de R2.2**, depois do algoritmo passar smoke test nos perfis demo. Backfill = um one-shot script que itera assessments com `cvd_risk_factors = '{}'` e corre o classifier server-side. Reportado no smoke report.
- Coluna fica NOT NULL com default `{}` — semanticamente "ainda não classificado" = objeto vazio. UI lê `Object.keys(cvd_risk_factors).length === 0` para mostrar estado "pending classification".

**Migration não muda por causa desta nota.**

### Nota 2 — Validation trigger reforçado (mudança na migration)

Adicionar checks leves a `validate_assessment_screening_ranges()`:

```sql
-- signs_symptoms: se presente e não-vazio, tem de ser objeto;
-- chaves cardinais conhecidas, se presentes, têm de ser boolean.
IF NEW.signs_symptoms IS NOT NULL AND NEW.signs_symptoms <> '{}'::jsonb THEN
  IF jsonb_typeof(NEW.signs_symptoms) <> 'object' THEN
    RAISE EXCEPTION 'signs_symptoms must be a JSON object';
  END IF;
  FOR _key IN SELECT unnest(ARRAY[
    'chest_discomfort','unreasonable_dyspnea','dizziness_syncope',
    'orthopnea_pnd','ankle_edema','palpitations_tachycardia',
    'intermittent_claudication','known_heart_murmur','unusual_fatigue'
  ]) LOOP
    IF NEW.signs_symptoms ? _key
       AND jsonb_typeof(NEW.signs_symptoms->_key) <> 'boolean' THEN
      RAISE EXCEPTION 'signs_symptoms.% must be boolean', _key;
    END IF;
  END LOOP;
END IF;

-- submax_test.protocol: se presente, restrito ao enum.
IF NEW.submax_test IS NOT NULL
   AND NEW.submax_test ? 'protocol'
   AND NEW.submax_test->>'protocol' NOT IN ('rockport','one_and_half_mile') THEN
  RAISE EXCEPTION 'submax_test.protocol must be rockport or one_and_half_mile';
END IF;
```

Declaração `_key text` no bloco `DECLARE`. Trigger continua curto, sem loop sobre o objecto inteiro — só sobre as 9 chaves canónicas.

### Nota 3 — `prescription_parameters` empty state (resposta, sem mudar migration)

**Plano confirmado:**

- `derive.server.ts` em R2.2 corre **on-demand** dentro do pipeline phased (entre Stage 2 e Stage 3) — nunca em backfill. Planos pre-R2 ficam com `prescription_parameters = '{}'` para sempre.
- UI: chip "FITT-VP · ACSM 12e" **escondido** quando `Object.keys(prescription_parameters).length === 0`. Sem fallback "vazio/disabled" — só aparece em planos gerados pós-R2.
- Documentado em comment SQL na coluna (já lá está, vou acrescentar a nota sobre empty-state).

**Migration não muda por causa desta nota** (apenas comment refinado).

### Diff final (vs. proposta original)

1. `validate_assessment_screening_ranges()` ganha o bloco signs_symptoms + protocol enum acima.
2. Comment em `workout_plans.prescription_parameters` ganha a frase: `Empty object {} indicates pre-R2 plan; UI hides FITT-VP chip in that case.`

Tudo o resto (colunas, tabela `acsm_thresholds`, RLS, `protect_assessment_intake_columns` extension) fica idêntico ao aprovado.

### Sequência pós-aprovação

1. Aplicar Migration A revista (esta).
2. **Mostrar seed dos 17 thresholds** (INSERT separado) para review antes de aplicar — keys em snake_case descritivo (ex: `resistance_intensity_pct_1rm_novice`, `cardio_vigorous_hrr_pct_lower`). Confirma keys → aplico seed.
3. R2.2 algorithm + classifier + smoke report nos perfis demo. **Stop gate até smoke aprovado.**
4. R2.2 backfill `cvd_risk_factors` (one-shot script, reportado).
5. R2.3+ só depois.

Ok para aplicar Migration A revista?