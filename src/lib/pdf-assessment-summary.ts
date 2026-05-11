import jsPDF from "jspdf";
import {
  ASSESSMENT_SESSION_SECTION_IDS,
  SELF_INTAKE_SECTION_IDS,
  assessmentGroupCounts,
  assessmentPhase,
  isSectionCompleteForPhase,
  type AssessmentSectionId,
} from "@/lib/assessment-phase";
import { buildAssessmentImplications, type ImplicationSeverity } from "@/lib/assessment-implications";

/**
 * Round 3 — Deterministic Assessment Summary PDF.
 *
 * 2–3 page client-side PDF built from the existing `assessment` and
 * `client` rows already loaded in the cockpit. No AI, no server fn,
 * no schema. Photos are intentionally excluded for privacy.
 *
 * Mirrors the layout pattern of `trainer-resource-pdf.ts` (jsPDF, A4,
 * deterministic sections) but lives in its own file to keep the
 * massive `pdf.ts` (workout PDF) untouched.
 *
 * Disclaimer is rendered on every page footer; rule copy never uses
 * "diagnóstico", "tratamento", "patologia" or "clearance médico"
 * outside the disclaimer string itself.
 */

type Tt = (k: string, opts?: any) => string;

type Args = {
  assessment: any;
  client: any;
  trainer?: { full_name?: string | null; business_name?: string | null } | null;
  locale?: string;
  t: Tt;
};

// Status-tone palette (RGB tuples for jsPDF setFillColor/setTextColor).
const INK: [number, number, number] = [14, 17, 22];
const MUTED: [number, number, number] = [91, 100, 112];
const RULE: [number, number, number] = [229, 225, 216];
const SOFT_BG: [number, number, number] = [250, 247, 241];
const GOLD: [number, number, number] = [184, 134, 47];

const SEV_COLOR: Record<ImplicationSeverity, [number, number, number]> = {
  danger: [239, 68, 68],
  warn: [245, 158, 11],
  neutral: [148, 163, 184],
  success: [16, 185, 129],
};

function hex(t: [number, number, number]): string {
  return "#" + t.map((n) => n.toString(16).padStart(2, "0")).join("");
}

function safe(s: any, fallback = "—"): string {
  if (s == null) return fallback;
  const v = String(s).trim();
  return v === "" ? fallback : v;
}

function fmtDate(d: Date, locale: string): string {
  try {
    return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function sanitiseFilenamePart(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "Cliente";
}

function pickClientLabel(client: any, fallback: string): string {
  const candidates: Array<unknown> = [
    client?.full_name,
    client?.name,
    client?.display_name,
    typeof client?.email === "string" ? client.email.split("@")[0] : null,
    typeof client?.id === "string" ? client.id.slice(0, 8) : null,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const v = String(c).trim();
    if (v !== "") return v;
  }
  return fallback;
}

export async function downloadAssessmentSummary(args: Args): Promise<void> {
  const { assessment: a, client, trainer, t } = args;
  const locale = args.locale ?? "pt-PT";
  const isPt = locale.toLowerCase().startsWith("pt");

  const tr = (k: string, fallback: string, opts?: any): string => {
    const out = t ? t(`assessment:${k}`, { defaultValue: fallback, ...(opts ?? {}) }) : fallback;
    return typeof out === "string" ? out : fallback;
  };

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const contentW = pageW - M * 2;
  let y = M;

  function setFont(weight: "normal" | "bold", size: number, color: [number, number, number] = INK) {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
    doc.setTextColor(hex(color));
  }

  function ensureSpace(needed: number) {
    if (y + needed > pageH - 60) {
      doc.addPage();
      y = M;
    }
  }

  function sectionTitle(text: string) {
    ensureSpace(40);
    setFont("bold", 13, INK);
    doc.text(text, M, y);
    y += 6;
    doc.setDrawColor(hex(GOLD));
    doc.setLineWidth(1);
    doc.line(M, y, M + 28, y);
    y += 16;
  }

  function row(label: string, value: string) {
    ensureSpace(18);
    setFont("bold", 9.5, MUTED);
    doc.text(label.toUpperCase(), M, y);
    setFont("normal", 11, INK);
    const wrapped = doc.splitTextToSize(value, contentW - 140) as string[];
    doc.text(wrapped, M + 140, y);
    y += Math.max(16, wrapped.length * 13);
  }

  function chip(label: string, color: [number, number, number], x: number) {
    const w = doc.getTextWidth(label) + 14;
    doc.setDrawColor(hex(color));
    doc.setLineWidth(0.6);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y - 10, w, 16, 8, 8, "S");
    setFont("bold", 8.5, color);
    doc.text(label, x + 7, y + 1);
    return x + w + 6;
  }

  // ---------- PAGE 1 — Profile + status ----------
  doc.setFillColor(hex(SOFT_BG));
  doc.rect(0, 0, pageW, 4, "F");

  // Eyebrow
  setFont("bold", 9, GOLD);
  doc.text(tr("summary_pdf.brand", "PROTOCOL"), M, y);
  setFont("normal", 8.5, MUTED);
  const eyebrow = tr("summary_pdf.eyebrow", "Resumo da avaliação · apoio à prescrição");
  doc.text(eyebrow.toUpperCase(), M, y + 12);
  // Date
  setFont("normal", 9, MUTED);
  doc.text(fmtDate(new Date(), locale), pageW - M, y, { align: "right" });
  if (trainer?.business_name || trainer?.full_name) {
    doc.text(safe(trainer.business_name ?? trainer.full_name, ""), pageW - M, y + 12, { align: "right" });
  }
  y += 36;

  // Title + client
  setFont("bold", 22, INK);
  doc.text(tr("summary_pdf.title", "Resumo da avaliação"), M, y);
  y += 22;
  setFont("normal", 12, MUTED);
  doc.text(safe(client?.full_name, tr("summary_pdf.no_name", "Cliente")), M, y);
  y += 24;

  // Status chips (phase + counts)
  const counts = assessmentGroupCounts(a);
  const phase = assessmentPhase(a);
  const phaseLabel = tr(`summary_pdf.phase.${phase}`, phase);
  const phaseColor: [number, number, number] =
    phase === "complete" ? SEV_COLOR.success : phase === "session_pending" ? SEV_COLOR.warn : SEV_COLOR.neutral;
  ensureSpace(24);
  let cx = chip(phaseLabel, phaseColor, M);
  cx = chip(`${tr("summary_pdf.status.self_intake", "Auto-avaliação")} ${counts.selfIntake.done}/${counts.selfIntake.total}`, MUTED, cx);
  chip(`${tr("summary_pdf.status.session", "Sessão")} ${counts.session.done}/${counts.session.total}`, MUTED, cx);
  y += 22;

  // Profile / training
  sectionTitle(tr("summary_pdf.sections.profile", "Perfil"));
  row(tr("summary_pdf.fields.goal", "Objectivo"), safe(a?.smart_specific));
  if (a?.smart_measurable) row(tr("summary_pdf.fields.goal_measure", "Medida"), safe(a.smart_measurable));
  row(tr("summary_pdf.fields.experience", "Experiência"), safe(a?.experience_level));
  if (a?.years_training) row(tr("summary_pdf.fields.years", "Anos a treinar"), safe(a.years_training));

  sectionTitle(tr("summary_pdf.sections.training", "Treino"));
  row(
    tr("summary_pdf.fields.frequency", "Frequência"),
    a?.training_days_per_week
      ? tr("summary_pdf.fields.frequency_value", "{{count}} sessões/semana", { count: Number(a.training_days_per_week) })
      : "—",
  );
  row(
    tr("summary_pdf.fields.session_minutes", "Duração da sessão"),
    a?.session_duration_minutes ? `${a.session_duration_minutes} min` : "—",
  );
  row(tr("summary_pdf.fields.location", "Local"), safe(a?.training_location));
  const equipArr: any[] = Array.isArray(a?.available_equipment) ? a.available_equipment : [];
  const equipShown = equipArr.slice(0, 6).map((e) => String(e)).join(", ");
  const equipExtra = equipArr.length > 6 ? ` (+${equipArr.length - 6})` : "";
  row(
    tr("summary_pdf.fields.equipment", "Equipamento"),
    equipArr.length === 0 ? tr("summary_pdf.fields.equipment_none", "Sem equipamento listado") : `${equipShown}${equipExtra}`,
  );

  // ---------- PAGE 2 — Implications ----------
  doc.addPage();
  y = M;
  sectionTitle(tr("summary_pdf.sections.implications", "Implicações para a prescrição"));
  setFont("normal", 9.5, MUTED);
  const intro = tr(
    "summary_pdf.implications_intro",
    "Lista determinística derivada da avaliação. Cada item é uma orientação para o treinador — não um diagnóstico.",
  );
  const introLines = doc.splitTextToSize(intro, contentW) as string[];
  doc.text(introLines, M, y);
  y += introLines.length * 12 + 8;

  const implications = buildAssessmentImplications(a);
  for (const imp of implications) {
    const color = SEV_COLOR[imp.severity];
    const fb =
      imp.id === "none"
        ? "Sem cautelas particulares identificadas. Aplicar parâmetros standard de iniciação."
        : imp.id;
    const text = tr(imp.copyKey, fb, imp.copyVars);
    const wrapped = doc.splitTextToSize(text, contentW - 22) as string[];
    const blockH = wrapped.length * 13 + 10;
    ensureSpace(blockH + 4);
    // Severity bar
    doc.setFillColor(hex(color));
    doc.rect(M, y - 9, 3, blockH - 4, "F");
    setFont("normal", 10.5, INK);
    doc.text(wrapped, M + 14, y);
    y += blockH;
  }

  // ---------- PAGE 3 — Session checklist ----------
  doc.addPage();
  y = M;

  const sessionMissing = ASSESSMENT_SESSION_SECTION_IDS.filter(
    (id) => !isSectionCompleteForPhase(id as AssessmentSectionId, a),
  );

  if (sessionMissing.length === 0) {
    sectionTitle(tr("summary_pdf.sections.session_checklist", "Sessão de avaliação"));
    setFont("bold", 11, SEV_COLOR.success);
    doc.text(tr("summary_pdf.session_complete", "Sessão de avaliação concluída."), M, y);
    y += 18;
    setFont("normal", 10, MUTED);
    const note = tr(
      "summary_pdf.session_complete_note",
      "Todos os itens práticos (antropometria, mobilidade, postura, screen, performance) foram registados.",
    );
    const wrapped = doc.splitTextToSize(note, contentW) as string[];
    doc.text(wrapped, M, y);
    y += wrapped.length * 13;
  } else {
    sectionTitle(tr("summary_pdf.sections.session_checklist", "Pendente — sessão de avaliação"));
    setFont("normal", 10, MUTED);
    const intro2 = tr(
      "summary_pdf.session_checklist_intro",
      "Complete estas secções na próxima sessão presencial antes de gerar o plano.",
    );
    const wrapped = doc.splitTextToSize(intro2, contentW) as string[];
    doc.text(wrapped, M, y);
    y += wrapped.length * 13 + 10;

    for (const id of sessionMissing) {
      ensureSpace(18);
      doc.setDrawColor(hex(GOLD));
      doc.setLineWidth(0.8);
      doc.rect(M, y - 8, 9, 9);
      setFont("normal", 11, INK);
      const label = tr(`sections.${id}`, id);
      doc.text(label, M + 18, y);
      y += 16;
    }

    // Self-intake gaps (informational)
    const intakeMissing = SELF_INTAKE_SECTION_IDS.filter(
      (id) => !isSectionCompleteForPhase(id as AssessmentSectionId, a),
    );
    if (intakeMissing.length > 0) {
      y += 12;
      setFont("bold", 10, MUTED);
      doc.text(tr("summary_pdf.intake_pending", "Auto-avaliação por concluir").toUpperCase(), M, y);
      y += 14;
      for (const id of intakeMissing) {
        ensureSpace(16);
        setFont("normal", 10.5, INK);
        doc.text(`• ${tr(`sections.${id}`, id)}`, M, y);
        y += 14;
      }
    }
  }

  // ---------- Footer on every page ----------
  const disclaimer = tr(
    "summary_pdf.disclaimer",
    "Documento de apoio à prescrição de exercício e revisão do treinador. Não constitui diagnóstico nem clearance médico.",
  );
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(hex(RULE));
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 42, pageW - M, pageH - 42);
    setFont("normal", 7.5, MUTED);
    const lines = doc.splitTextToSize(disclaimer, contentW - 60) as string[];
    doc.text(lines, M, pageH - 28);
    doc.text(
      tr("summary_pdf.footer_page", "Página {{page}} de {{total}}", { page: i, total }),
      pageW - M,
      pageH - 22,
      { align: "right" },
    );
  }

  // ---------- Save ----------
  const namePart = sanitiseFilenamePart(safe(client?.full_name, isPt ? "Cliente" : "Client"));
  const datePart = new Date().toISOString().slice(0, 10);
  const fileBase = isPt ? "Resumo_Avaliacao" : "Assessment_Summary";
  doc.save(`${fileBase}_${namePart}_${datePart}.pdf`);
}