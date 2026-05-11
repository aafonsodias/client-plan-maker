import { downloadAssessmentSummary } from "@/lib/pdf-assessment-summary";
import { writeFileSync } from "fs";

// Stub jsPDF.save -> capture buffer
import jsPDF from "jspdf";
const origSave = (jsPDF.prototype as any).save;
(jsPDF.prototype as any).save = function (name: string) {
  const ab = this.output("arraybuffer");
  writeFileSync(`/tmp/${name}`, Buffer.from(ab));
  console.log("WROTE", `/tmp/${name}`);
};

const t = (k: string, opts?: any) => {
  if (opts && typeof opts === "object" && "defaultValue" in opts) {
    let s = String(opts.defaultValue);
    for (const [kk, vv] of Object.entries(opts)) {
      if (kk === "defaultValue") continue;
      s = s.replace(new RegExp(`{{\\s*${kk}\\s*}}`, "g"), String(vv));
    }
    return s;
  }
  return k;
};

const baseClient = { full_name: "Maria Silva" };

const full = {
  id: "x",
  smart_specific: "Hipertrofia geral, ganho 4kg massa magra",
  smart_measurable: "+4kg massa magra em 16 semanas",
  experience_level: "intermediate",
  years_training: 3,
  training_days_per_week: 4,
  session_duration_minutes: 60,
  training_location: "ginásio comercial",
  available_equipment: ["barra", "halteres", "máquina cabos", "rack", "leg press", "bicicleta", "corda"],
  parq: { q1: false, q2: false },
  med_flags: [],
  injuries: [],
  sleep_quality: "ok",
  stress_level: "moderate",
  experience: "intermediate",
  // mark all sections complete-ish
};

const incomplete = { id: "y", smart_specific: "Perder peso" };

const risky = {
  id: "z",
  smart_specific: "Voltar a treinar após pausa",
  experience_level: "beginner",
  training_days_per_week: 2,
  session_duration_minutes: 30,
  training_location: "casa",
  available_equipment: [],
  parq: { q1: true, q2: true, q3: true },
  med_flags: ["beta_blocker", "anticoagulant", "insulin"],
  injuries: [{ region: "ombro D" }, { region: "joelho E" }],
  pain_notes: "dor lombar ao levantar",
  sleep_quality: "poor",
  stress_level: "high",
  readiness_stage: "contemplation",
  risk: { bmi_category: "obese" },
};

await downloadAssessmentSummary({ assessment: full, client: baseClient, locale: "pt-PT", t });
await downloadAssessmentSummary({ assessment: incomplete, client: { full_name: "" }, locale: "pt-PT", t });
await downloadAssessmentSummary({ assessment: risky, client: baseClient, locale: "pt-PT", t });
await downloadAssessmentSummary({ assessment: null, client: null, locale: "pt-PT", t });
