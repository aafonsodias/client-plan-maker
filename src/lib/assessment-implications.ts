/**
 * Round 3 — Deterministic prescription implications for the Assessment
 * Summary PDF.
 *
 * Pure function. No I/O, no AI, no network. Reads only the assessment
 * row shape already used across the cockpit. Each rule maps to an i18n
 * key under `assessment.summary_pdf.implications.*` so the renderer can
 * translate without re-implementing the rules.
 *
 * Copy contract: rule strings MUST never use the words "diagnosis",
 * "treatment", "pathology" or "medical clearance". The disclaimer line
 * is the only place those words may appear.
 */

export type ImplicationSeverity = "danger" | "warn" | "neutral" | "success";

export type Implication = {
  id: string;
  severity: ImplicationSeverity;
  copyKey: string;
  copyVars?: Record<string, string | number>;
};

function parqYesCount(a: any): number {
  const parq = a?.parq;
  if (!parq || typeof parq !== "object") return 0;
  return Object.values(parq).filter((v) => v === true).length;
}

function medFlags(a: any): string[] {
  const f = a?.med_flags;
  return Array.isArray(f) ? f.map((s) => String(s).toLowerCase()) : [];
}

export function buildAssessmentImplications(a: any): Implication[] {
  const out: Implication[] = [];
  if (!a || typeof a !== "object") {
    return [{ id: "none", severity: "success", copyKey: "summary_pdf.implications.none" }];
  }

  // 1. PAR-Q
  const parqCount = parqYesCount(a);
  if (parqCount > 0) {
    out.push({
      id: "parq",
      severity: "danger",
      copyKey: "summary_pdf.implications.parq",
      copyVars: { count: parqCount },
    });
  }

  // 2. BMI / risk
  const bmiCat = String(a?.risk?.bmi_category ?? "").toLowerCase();
  if (bmiCat === "obese" || bmiCat === "obesity" || bmiCat === "obese_class_1" || bmiCat === "obese_class_2" || bmiCat === "obese_class_3") {
    out.push({ id: "risk_obese", severity: "warn", copyKey: "summary_pdf.implications.risk_obese" });
  }

  // 3-5. Medications
  const meds = medFlags(a);
  if (meds.includes("beta_blocker")) {
    out.push({ id: "beta_blocker", severity: "warn", copyKey: "summary_pdf.implications.beta_blocker" });
  }
  if (meds.includes("anticoagulant")) {
    out.push({ id: "anticoagulant", severity: "warn", copyKey: "summary_pdf.implications.anticoagulant" });
  }
  if (meds.includes("insulin") || meds.includes("hypoglycemic")) {
    out.push({ id: "hypoglycemia", severity: "warn", copyKey: "summary_pdf.implications.hypoglycemia" });
  }

  // 6. Injuries
  const injuries: any[] = Array.isArray(a?.injuries) ? a.injuries : [];
  if (injuries.length > 0) {
    const regions = injuries
      .map((i) => String(i?.region ?? i?.area ?? i?.label ?? "").trim())
      .filter(Boolean)
      .slice(0, 5);
    out.push({
      id: "injuries",
      severity: "warn",
      copyKey: "summary_pdf.implications.injuries",
      copyVars: {
        count: injuries.length,
        regions: regions.join(", ") || "—",
      },
    });
  }

  // 7. Active pain notes
  const painNotes = String(a?.pain_notes ?? "").trim();
  if (painNotes.length > 0) {
    out.push({ id: "pain_notes", severity: "warn", copyKey: "summary_pdf.implications.pain_notes" });
  }

  // 8. Recovery signals
  const sleep = String(a?.sleep_quality ?? "").toLowerCase();
  const stress = String(a?.stress_level ?? "").toLowerCase();
  if (sleep === "poor" || stress === "high") {
    out.push({ id: "low_recovery", severity: "neutral", copyKey: "summary_pdf.implications.low_recovery" });
  }

  // 9. Readiness stage
  const stage = String(a?.readiness_stage ?? "").toLowerCase();
  if (stage === "precontemplation" || stage === "contemplation") {
    out.push({ id: "readiness", severity: "neutral", copyKey: "summary_pdf.implications.readiness" });
  }

  // 10. Experience
  const exp = String(a?.experience_level ?? "").toLowerCase();
  if (exp === "beginner" || exp === "novice") {
    out.push({ id: "beginner", severity: "neutral", copyKey: "summary_pdf.implications.beginner" });
  }

  // 11. Equipment
  const equip: any[] = Array.isArray(a?.available_equipment) ? a.available_equipment : [];
  if (equip.length === 0) {
    out.push({ id: "no_equipment", severity: "neutral", copyKey: "summary_pdf.implications.no_equipment" });
  }

  // 12. Frequency
  const days = Number(a?.training_days_per_week ?? 0);
  if (Number.isFinite(days) && days > 0 && days <= 2) {
    out.push({ id: "low_frequency", severity: "neutral", copyKey: "summary_pdf.implications.low_frequency" });
  }

  // 13. Session duration
  const dur = Number(a?.session_duration_minutes ?? 0);
  if (Number.isFinite(dur) && dur > 0 && dur < 40) {
    out.push({ id: "short_session", severity: "neutral", copyKey: "summary_pdf.implications.short_session" });
  }

  if (out.length === 0) {
    return [{ id: "none", severity: "success", copyKey: "summary_pdf.implications.none" }];
  }

  // Hard cap to keep the PDF concise (per Round 3 plan §G).
  return out.slice(0, 12);
}