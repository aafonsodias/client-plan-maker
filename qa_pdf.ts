import { downloadAssessmentSummary } from "@/lib/pdf-assessment-summary";
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
const full = { id: "x", smart_specific: "Hipertrofia geral, ganhar 4kg massa magra em 16 semanas", smart_measurable: "+4kg massa magra", experience_level: "intermediate", years_training: 3, training_days_per_week: 4, session_duration_minutes: 60, training_location: "ginásio comercial", available_equipment: ["barra","halteres","cabos","rack","bicicleta","corda","kettlebells"], parq:{}, med_flags:[], injuries:[], sleep_quality:"good", stress_level:"moderate" };
const incomplete = { id: "y", smart_specific: "Perder peso" };
const risky = { id:"z", smart_specific:"Voltar a treinar após pausa de 2 anos", experience_level:"beginner", training_days_per_week:2, session_duration_minutes:30, training_location:"casa", available_equipment:[], parq:{q1:true,q2:true,q3:true}, med_flags:["beta_blocker","anticoagulant","insulin"], injuries:[{region:"ombro D"},{region:"joelho E"},{region:"lombar"}], pain_notes:"dor lombar ao levantar peso", sleep_quality:"poor", stress_level:"high", readiness_stage:"contemplation", risk:{bmi_category:"obese"} };
await downloadAssessmentSummary({ assessment: full, client: { full_name: "Maria Full" }, locale: "pt-PT", t: t as any });
await downloadAssessmentSummary({ assessment: incomplete, client: { full_name: "Joao Incompleto" }, locale: "pt-PT", t: t as any });
await downloadAssessmentSummary({ assessment: risky, client: { full_name: "Ana Risco" }, locale: "pt-PT", t: t as any });
await downloadAssessmentSummary({ assessment: null, client: null, locale: "pt-PT", t: t as any });
console.log("done");
