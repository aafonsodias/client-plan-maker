/**
 * Catálogo de aparelhos cuja saída pode ser introduzida manualmente no
 * assessment. Cada aparelho descreve N campos; cada campo conhece o domínio
 * e o `test_used` que vai usar quando gravar como `client_capacity_snapshots`.
 *
 * Adicionar um aparelho novo (Polar H10, tensiómetro Omron, ...) é só
 * estender este array — o componente `<DeviceCaptureSheet/>` consome esta
 * forma directamente.
 */

export type DeviceFieldSpec = {
  /** Identificador único dentro do aparelho. */
  key: string;
  /** Label PT humano. */
  label: string;
  /** Unidade exibida (ex: "%", "kg", "ml/kg/min"). */
  unit: string;
  /** Domínio em capacity_domains. */
  domain: string;
  /** test_used a gravar em client_capacity_snapshots. */
  testUsed: string;
  /** Placeholder do input (sem unidade — a unidade é renderizada à direita). */
  placeholder?: string;
  /** Para validação suave: limites razoáveis. */
  min?: number;
  max?: number;
  /** True quando este campo só interessa a uns utilizadores; fica num
   *  bloco "Avançado" colapsado. */
  advanced?: boolean;
};

export type DeviceSpec = {
  id: string;
  /** Nome curto que aparece no botão e no título da Sheet. */
  label: string;
  /** Descrição uma-linha sob o título. */
  description: string;
  /** Domínio "principal" — usado como hint visual e para filtrar. */
  primaryDomain: string;
  /** Lista de campos (na ordem em que aparecem no formulário). */
  fields: DeviceFieldSpec[];
};

/**
 * Tanita (ou qualquer balança de bioimpedância): peso e composição corporal.
 * Os field IDs (`test_used`) são consistentes com os já usados em
 * `backfill_measurement_snapshots_phase_a` para o mesmo cliente poder ter
 * histórico contínuo se trocar de balança.
 */
export const TANITA: DeviceSpec = {
  id: "tanita_bia",
  label: "Balança Tanita",
  description: "Bioimpedância — composição corporal completa numa medição.",
  primaryDomain: "body_composition",
  fields: [
    { key: "weight",      label: "Peso",                 unit: "kg",     domain: "body_composition",     testUsed: "weight",                placeholder: "ex. 78.4", min: 25, max: 250 },
    { key: "bf",          label: "% Gordura",            unit: "%",      domain: "body_composition",     testUsed: "body_fat_bia",          placeholder: "ex. 22.4", min: 2,  max: 70 },
    { key: "muscle",      label: "% Massa muscular",     unit: "%",      domain: "body_composition",     testUsed: "muscle_mass_pct",       placeholder: "ex. 38.1", min: 10, max: 80 },
    { key: "visceral",    label: "Gordura visceral",     unit: "índice", domain: "body_composition",     testUsed: "visceral_fat",          placeholder: "ex. 7",    min: 1,  max: 60 },
    { key: "water",       label: "Água total",           unit: "%",      domain: "body_composition",     testUsed: "total_body_water_pct",  placeholder: "ex. 55.2", min: 20, max: 80 },
    { key: "bone",        label: "Massa óssea",          unit: "kg",     domain: "body_composition",     testUsed: "bone_mass",             placeholder: "ex. 3.1",  min: 0.5, max: 10, advanced: true },
    { key: "bmr",         label: "Metabolismo basal",    unit: "kcal",   domain: "body_composition",     testUsed: "bmr_kcal",              placeholder: "ex. 1620", min: 600, max: 4000, advanced: true },
    { key: "metabolic_age", label: "Idade metabólica",   unit: "anos",   domain: "body_composition",     testUsed: "metabolic_age",         placeholder: "ex. 32",   min: 10, max: 99, advanced: true },
    // Segmental (modelos BC-545/601/etc.) — ficam em "avançado" para não
    // assustar a maior parte das ocasiões.
    { key: "trunk_fat",   label: "Tronco — % gordura",   unit: "%",      domain: "body_composition",     testUsed: "trunk_fat_pct",         placeholder: "ex. 19.0", min: 1, max: 70, advanced: true },
    { key: "right_arm_fat", label: "Braço D — % gordura", unit: "%",     domain: "body_composition",     testUsed: "right_arm_fat_pct",     placeholder: "ex. 18.2", min: 1, max: 70, advanced: true },
    { key: "left_arm_fat",  label: "Braço E — % gordura", unit: "%",     domain: "body_composition",     testUsed: "left_arm_fat_pct",      placeholder: "ex. 18.5", min: 1, max: 70, advanced: true },
    { key: "right_leg_fat", label: "Perna D — % gordura", unit: "%",     domain: "body_composition",     testUsed: "right_leg_fat_pct",     placeholder: "ex. 24.0", min: 1, max: 70, advanced: true },
    { key: "left_leg_fat",  label: "Perna E — % gordura", unit: "%",     domain: "body_composition",     testUsed: "left_leg_fat_pct",      placeholder: "ex. 24.3", min: 1, max: 70, advanced: true },
  ],
};

/**
 * Dinamómetro de preensão (Jamar, Camry, etc.). Registamos as 3 tentativas
 * por mão para podermos calcular o melhor valor e a assimetria — só o
 * **melhor por mão** vai para `client_capacity_snapshots` (o detalhe das
 * tentativas fica em `notes` para auditoria).
 */
export const JAMAR: DeviceSpec = {
  id: "jamar_grip",
  label: "Força de preensão (Jamar)",
  description: "Cotovelo a 90°, 3 tentativas por mão, 1 min de descanso. Vale o melhor.",
  primaryDomain: "muscular_endurance",
  fields: [
    { key: "right_t1", label: "Direita — tentativa 1", unit: "kg", domain: "muscular_endurance", testUsed: "grip_right_t1", placeholder: "ex. 38.0", min: 1, max: 120 },
    { key: "right_t2", label: "Direita — tentativa 2", unit: "kg", domain: "muscular_endurance", testUsed: "grip_right_t2", placeholder: "ex. 40.5", min: 1, max: 120 },
    { key: "right_t3", label: "Direita — tentativa 3", unit: "kg", domain: "muscular_endurance", testUsed: "grip_right_t3", placeholder: "ex. 39.2", min: 1, max: 120 },
    { key: "left_t1",  label: "Esquerda — tentativa 1", unit: "kg", domain: "muscular_endurance", testUsed: "grip_left_t1",  placeholder: "ex. 36.0", min: 1, max: 120 },
    { key: "left_t2",  label: "Esquerda — tentativa 2", unit: "kg", domain: "muscular_endurance", testUsed: "grip_left_t2",  placeholder: "ex. 37.5", min: 1, max: 120 },
    { key: "left_t3",  label: "Esquerda — tentativa 3", unit: "kg", domain: "muscular_endurance", testUsed: "grip_left_t3",  placeholder: "ex. 36.8", min: 1, max: 120 },
  ],
};

export const DEVICES: DeviceSpec[] = [TANITA, JAMAR];

export function findDevice(id: string): DeviceSpec | undefined {
  return DEVICES.find((d) => d.id === id);
}
