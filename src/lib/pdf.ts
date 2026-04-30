import jsPDF from "jspdf";

export type Exercise = {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
  // New (Pass 3) — all optional so legacy plans still parse cleanly
  primary_muscles?: string[];
  secondary_muscles?: string[];
  rpe?: string;          // e.g. "7" or "7-8"
  tempo?: string;        // e.g. "3-1-1-0"
  technique_cues?: string;
  equipment?: string[];
};

export type SectionItem = {
  name: string;
  duration?: string;     // e.g. "5 min"
  notes?: string;
};

export type Day = {
  day_label: string;
  focus: string;
  exercises: Exercise[];
  // New (Pass 3) sections — all optional
  warmup?: SectionItem[];
  activation?: SectionItem[];
  dynamic_stretches?: SectionItem[];
  cooldown?: SectionItem[];
  finisher?: SectionItem[];
  finisher_enabled?: boolean;
};
export type Week = { week_number: number; focus: string; days: Day[] };
export type PlanData = { weeks: Week[] };

/**
 * A plan is "legacy" (pre-Pass-3) if no day on any week has any of the
 * new structured sections or new exercise fields. The trainer is shown a
 * banner suggesting they regenerate to get the full Forge structure.
 */
export function isLegacyPlan(plan: PlanData): boolean {
  for (const w of plan.weeks ?? []) {
    for (const d of w.days ?? []) {
      if ((d.warmup?.length ?? 0) > 0) return false;
      if ((d.activation?.length ?? 0) > 0) return false;
      if ((d.dynamic_stretches?.length ?? 0) > 0) return false;
      if ((d.cooldown?.length ?? 0) > 0) return false;
      if ((d.finisher?.length ?? 0) > 0) return false;
      for (const ex of d.exercises ?? []) {
        if ((ex.primary_muscles?.length ?? 0) > 0) return false;
        if ((ex.secondary_muscles?.length ?? 0) > 0) return false;
        if (ex.rpe || ex.tempo || ex.technique_cues) return false;
        if ((ex.equipment?.length ?? 0) > 0) return false;
      }
    }
  }
  return (plan.weeks?.length ?? 0) > 0;
}

export type PdfBranding = {
  business_name?: string | null;
  full_name?: string | null;
  tagline?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  logo_data_url?: string | null;
};

export type PdfMeta = {
  title: string;
  summary?: string | null;
  client_name: string;
  duration_weeks?: number | null;
};

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generatePlanPdf(meta: PdfMeta, plan: PlanData, branding: PdfBranding & { logo_url?: string | null }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  // Header band
  doc.setFillColor(20, 24, 33);
  doc.rect(0, 0, W, 110, "F");

  let logoData = branding.logo_data_url ?? null;
  if (!logoData && branding.logo_url) logoData = await urlToDataUrl(branding.logo_url);
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", M, 30, 50, 50);
    } catch {
      /* ignore */
    }
  }

  doc.setTextColor(220, 255, 120);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text((branding.business_name || branding.full_name || "TRAINER").toUpperCase(), logoData ? M + 64 : M, 50);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(meta.title, logoData ? M + 64 : M, 75);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  if (branding.tagline) doc.text(branding.tagline, logoData ? M + 64 : M, 92);

  y = 140;

  // Client / meta
  doc.setTextColor(20, 24, 33);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Prepared for: ${meta.client_name}`, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (meta.duration_weeks) doc.text(`Program length: ${meta.duration_weeks} weeks`, W - M, y, { align: "right" });
  y += 18;

  if (meta.summary) {
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(meta.summary, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 13 + 8;
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(M, y, W - M, y);
  y += 18;

  const ensureSpace = (need: number) => {
    if (y + need > H - M) {
      doc.addPage();
      y = M;
    }
  };

  for (const week of plan.weeks) {
    ensureSpace(40);
    doc.setFillColor(220, 255, 120);
    doc.rect(M, y - 14, W - M * 2, 22, "F");
    doc.setTextColor(20, 24, 33);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`WEEK ${week.week_number} — ${week.focus || ""}`.trim(), M + 8, y);
    y += 18;

    for (const day of week.days) {
      ensureSpace(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 24, 33);
      doc.text(`${day.day_label} — ${day.focus}`, M, y);
      y += 14;

      // Pass-3 sections (warmup → cooldown → optional finisher)
      const renderSection = (title: string, items?: SectionItem[]) => {
        if (!items || items.length === 0) return;
        ensureSpace(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(110, 110, 110);
        doc.text(title.toUpperCase(), M, y);
        y += 11;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        for (const it of items) {
          const label = it.name + (it.duration ? `  (${it.duration})` : "");
          const noteLines = it.notes ? doc.splitTextToSize(`— ${it.notes}`, W - M * 2 - 12) : [];
          ensureSpace(12 + noteLines.length * 11);
          doc.text(label, M + 6, y);
          y += 11;
          if (noteLines.length) {
            doc.setTextColor(120, 120, 120);
            doc.text(noteLines, M + 16, y);
            y += noteLines.length * 11;
            doc.setTextColor(60, 60, 60);
          }
        }
        y += 4;
      };

      renderSection("Warmup", day.warmup);
      renderSection("Activation", day.activation);
      renderSection("Dynamic stretches", day.dynamic_stretches);

      if ((day.exercises ?? []).length > 0) {
        ensureSpace(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(110, 110, 110);
        doc.text("MAIN WORK", M, y);
        y += 11;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text("Exercise", M, y);
      doc.text("Sets", M + 240, y);
      doc.text("Reps", M + 290, y);
      doc.text("Rest", M + 350, y);
      doc.text("Notes", M + 400, y);
      y += 10;
      doc.setDrawColor(230, 230, 230);
      doc.line(M, y, W - M, y);
      y += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      for (const ex of day.exercises) {
        const muscles = [
          (ex.primary_muscles ?? []).join(", "),
          (ex.secondary_muscles ?? []).length ? `(${(ex.secondary_muscles ?? []).join(", ")})` : "",
        ].filter(Boolean).join(" ");
        const extras = [
          ex.rpe ? `RPE ${ex.rpe}` : "",
          ex.tempo ? `Tempo ${ex.tempo}` : "",
        ].filter(Boolean).join(" · ");
        const composedNotes = [
          muscles && `Muscles: ${muscles}`,
          extras,
          ex.technique_cues,
          ex.notes,
        ].filter(Boolean).join(" — ");
        const noteLines = doc.splitTextToSize(composedNotes, W - M - 400 - 10);
        const rowH = Math.max(14, noteLines.length * 12);
        ensureSpace(rowH + 6);
        doc.text(ex.name, M, y);
        doc.text(String(ex.sets ?? ""), M + 240, y);
        doc.text(String(ex.reps ?? ""), M + 290, y);
        doc.text(String(ex.rest ?? ""), M + 350, y);
        doc.text(noteLines, M + 400, y);
        y += rowH;
      }
      y += 10;

      renderSection("Cooldown", day.cooldown);
      if (day.finisher_enabled !== false) {
        renderSection("Optional finisher", day.finisher);
      }
    }

    y += 4;
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footer = [branding.business_name, branding.contact_email, branding.contact_phone].filter(Boolean).join("  ·  ");
    if (footer) doc.text(footer, M, H - 24);
    doc.text(`Page ${i} / ${pageCount}`, W - M, H - 24, { align: "right" });
  }

  doc.save(`${meta.client_name.replace(/\s+/g, "_")}_${meta.title.replace(/\s+/g, "_")}.pdf`);
}