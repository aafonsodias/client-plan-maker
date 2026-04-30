import jsPDF from "jspdf";
import type { PdfBranding, PlanData } from "./pdf";

/**
 * Compliance report PDF — what actually happened over a period vs what was planned.
 * Reads from workout_sessions.entries (planned vs actual) and aggregates:
 *   - Adherence: sessions logged vs sessions scheduled in the period
 *   - Volume: total sets, est. reps, est. tonnage (kg) when weights are numeric
 *   - Per-week breakdown
 *   - Top exercises by tonnage
 *   - Notes timeline (trainer-written observations)
 * Everything is computed from real data — no placeholders, no fabricated numbers.
 */

export type ComplianceSession = {
  id: string;
  week_number: number;
  day_label: string;
  session_date: string;
  logged_by: string;
  entries: any[];
  session_notes: string | null;
};

export type ComplianceMeta = {
  client_name: string;
  plan_title: string;
  period_label: string; // e.g. "Apr 1 – Apr 30, 2026"
  from_date?: string;
  to_date?: string;
};

type SetLine = { reps?: string; weight?: string; rpe?: string };

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(",", ".").trim();
  if (!s) return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function entrySets(entry: any): SetLine[] {
  if (Array.isArray(entry?.sets) && entry.sets.length > 0) return entry.sets as SetLine[];
  // Fallback: synthesise from .actual { sets, reps, weight }
  if (entry?.actual) {
    const setCount = parseNum(entry.actual.sets) ?? 0;
    if (setCount > 0) {
      return Array.from({ length: setCount }, () => ({
        reps: entry.actual.reps,
        weight: entry.actual.weight,
      }));
    }
  }
  return [];
}

function tonnageForEntry(entry: any): { sets: number; reps: number; tonnage: number; weighed: boolean } {
  const lines = entrySets(entry);
  let sets = 0;
  let reps = 0;
  let tonnage = 0;
  let weighed = false;
  for (const ln of lines) {
    sets += 1;
    const r = parseNum(ln.reps);
    const w = parseNum(ln.weight);
    if (r != null) reps += r;
    if (r != null && w != null) {
      tonnage += r * w;
      weighed = true;
    }
  }
  return { sets, reps, tonnage, weighed };
}

function plannedSessionsInRange(plan: PlanData | null, from?: Date, to?: Date): number {
  // Heuristic: count planned days across all weeks in the plan. If from/to are given
  // and the plan has more weeks than the range covers, we cap to the range length
  // (1 week ≈ 7 days). This stays honest when the report period is shorter than the plan.
  if (!plan?.weeks?.length) return 0;
  const totalPlannedDays = plan.weeks.reduce((acc, w) => acc + (w.days?.length ?? 0), 0);
  if (!from || !to) return totalPlannedDays;
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const weeksInRange = days / 7;
  const avgPerWeek = totalPlannedDays / plan.weeks.length;
  return Math.max(0, Math.round(avgPerWeek * weeksInRange));
}

export async function generateComplianceReportPdf(
  meta: ComplianceMeta,
  sessions: ComplianceSession[],
  plan: PlanData | null,
  branding: PdfBranding,
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  // ---------- Header band ----------
  doc.setFillColor(20, 24, 33);
  doc.rect(0, 0, W, 110, "F");

  if (branding.logo_data_url) {
    try {
      doc.addImage(branding.logo_data_url, "PNG", M, 30, 50, 50);
    } catch {
      /* ignore */
    }
  }
  const hasLogo = !!branding.logo_data_url;

  doc.setTextColor(220, 255, 120);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    (branding.business_name || branding.full_name || "TRAINER").toUpperCase(),
    hasLogo ? M + 64 : M,
    50,
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("Compliance report", hasLogo ? M + 64 : M, 75);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(meta.period_label, hasLogo ? M + 64 : M, 92);

  y = 140;

  // ---------- Subject line ----------
  doc.setTextColor(20, 24, 33);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Client: ${meta.client_name}`, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(meta.plan_title, W - M, y, { align: "right" });
  y += 18;

  doc.setDrawColor(220, 220, 220);
  doc.line(M, y, W - M, y);
  y += 18;

  const ensureSpace = (need: number) => {
    if (y + need > H - M) {
      doc.addPage();
      y = M;
    }
  };

  // ---------- Aggregate ----------
  const from = meta.from_date ? new Date(meta.from_date) : undefined;
  const to = meta.to_date ? new Date(meta.to_date) : undefined;
  const inRange = sessions.filter((s) => {
    if (!from || !to) return true;
    const d = new Date(s.session_date);
    return d >= from && d <= to;
  });

  const planned = plannedSessionsInRange(plan, from, to);
  const completed = inRange.length;
  const adherence = planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : null;

  let totalSets = 0;
  let totalReps = 0;
  let totalTonnage = 0;
  let anyWeighed = false;

  type ExStat = { name: string; sets: number; reps: number; tonnage: number; weighed: boolean };
  const byExercise = new Map<string, ExStat>();
  type WeekStat = { week: number; sessions: number; sets: number; tonnage: number };
  const byWeek = new Map<number, WeekStat>();

  for (const s of inRange) {
    const wk = byWeek.get(s.week_number) ?? { week: s.week_number, sessions: 0, sets: 0, tonnage: 0 };
    wk.sessions += 1;
    for (const e of s.entries ?? []) {
      const { sets, reps, tonnage, weighed } = tonnageForEntry(e);
      totalSets += sets;
      totalReps += reps;
      totalTonnage += tonnage;
      if (weighed) anyWeighed = true;
      wk.sets += sets;
      wk.tonnage += tonnage;
      const name = (e.exercise_name || "(unnamed)").trim();
      const ex = byExercise.get(name) ?? { name, sets: 0, reps: 0, tonnage: 0, weighed: false };
      ex.sets += sets;
      ex.reps += reps;
      ex.tonnage += tonnage;
      ex.weighed = ex.weighed || weighed;
      byExercise.set(name, ex);
    }
    byWeek.set(s.week_number, wk);
  }

  // ---------- KPI strip ----------
  const kpis: { label: string; value: string }[] = [
    {
      label: "Adherence",
      value: adherence != null ? `${adherence}%` : `${completed} / —`,
    },
    { label: "Sessions logged", value: String(completed) },
    { label: "Total sets", value: String(totalSets) },
    {
      label: "Total tonnage",
      value: anyWeighed ? `${Math.round(totalTonnage).toLocaleString()} kg` : "—",
    },
  ];

  ensureSpace(70);
  const cardW = (W - M * 2 - 12 * (kpis.length - 1)) / kpis.length;
  for (let i = 0; i < kpis.length; i++) {
    const x = M + i * (cardW + 12);
    doc.setFillColor(248, 248, 245);
    doc.setDrawColor(230, 230, 225);
    doc.roundedRect(x, y, cardW, 56, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(kpis[i].label.toUpperCase(), x + 10, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(20, 24, 33);
    doc.text(kpis[i].value, x + 10, y + 42);
  }
  y += 56 + 18;

  if (planned > 0 && adherence != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `Based on ${planned} planned session${planned === 1 ? "" : "s"} in this period.`,
      M,
      y,
    );
    y += 14;
  }
  if (!anyWeighed) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      "Tonnage shown only when set weights are logged numerically.",
      M,
      y,
    );
    y += 12;
    doc.setFont("helvetica", "normal");
  }
  y += 6;

  // ---------- Per-week breakdown ----------
  ensureSpace(40);
  doc.setFillColor(220, 255, 120);
  doc.rect(M, y - 14, W - M * 2, 22, "F");
  doc.setTextColor(20, 24, 33);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("WEEK-BY-WEEK", M + 8, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Week", M, y);
  doc.text("Sessions", M + 80, y);
  doc.text("Sets", M + 180, y);
  doc.text("Tonnage (kg)", M + 240, y);
  y += 8;
  doc.setDrawColor(230, 230, 230);
  doc.line(M, y, W - M, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);

  const weeks = Array.from(byWeek.values()).sort((a, b) => a.week - b.week);
  if (weeks.length === 0) {
    doc.setTextColor(140, 140, 140);
    doc.text("No sessions logged in this period.", M, y);
    y += 16;
  } else {
    for (const w of weeks) {
      ensureSpace(16);
      doc.text(`Week ${w.week}`, M, y);
      doc.text(String(w.sessions), M + 80, y);
      doc.text(String(w.sets), M + 180, y);
      doc.text(w.tonnage > 0 ? Math.round(w.tonnage).toLocaleString() : "—", M + 240, y);
      y += 14;
    }
  }
  y += 10;

  // ---------- Top exercises ----------
  ensureSpace(40);
  doc.setFillColor(220, 255, 120);
  doc.rect(M, y - 14, W - M * 2, 22, "F");
  doc.setTextColor(20, 24, 33);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOP EXERCISES BY VOLUME", M + 8, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Exercise", M, y);
  doc.text("Sets", M + 260, y);
  doc.text("Reps", M + 310, y);
  doc.text("Tonnage (kg)", M + 370, y);
  y += 8;
  doc.setDrawColor(230, 230, 230);
  doc.line(M, y, W - M, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);

  const top = Array.from(byExercise.values())
    .sort((a, b) => (b.tonnage - a.tonnage) || (b.sets - a.sets))
    .slice(0, 8);

  if (top.length === 0) {
    doc.setTextColor(140, 140, 140);
    doc.text("No exercises logged.", M, y);
    y += 16;
  } else {
    for (const ex of top) {
      ensureSpace(16);
      const nameLines = doc.splitTextToSize(ex.name, 250);
      doc.text(nameLines, M, y);
      doc.text(String(ex.sets), M + 260, y);
      doc.text(String(ex.reps || "—"), M + 310, y);
      doc.text(ex.weighed ? Math.round(ex.tonnage).toLocaleString() : "—", M + 370, y);
      y += Math.max(14, nameLines.length * 12);
    }
  }
  y += 10;

  // ---------- Notes timeline ----------
  const noted = inRange.filter((s) => (s.session_notes ?? "").trim().length > 0);
  if (noted.length > 0) {
    ensureSpace(40);
    doc.setFillColor(220, 255, 120);
    doc.rect(M, y - 14, W - M * 2, 22, "F");
    doc.setTextColor(20, 24, 33);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("SESSION NOTES", M + 8, y);
    y += 22;

    for (const s of noted.sort((a, b) => a.session_date.localeCompare(b.session_date))) {
      const noteLines = doc.splitTextToSize(s.session_notes!.trim(), W - M * 2 - 12);
      ensureSpace(18 + noteLines.length * 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(20, 24, 33);
      doc.text(`${s.session_date} · Week ${s.week_number} · ${s.day_label}`, M, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(noteLines, M, y);
      y += noteLines.length * 12 + 8;
    }
  }

  // ---------- Footer ----------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footer = [branding.business_name, branding.contact_email, branding.contact_phone]
      .filter(Boolean)
      .join("  ·  ");
    if (footer) doc.text(footer, M, H - 24);
    doc.text(`Page ${i} / ${pageCount}`, W - M, H - 24, { align: "right" });
  }

  const fname = `${meta.client_name.replace(/\s+/g, "_")}_compliance_${(meta.from_date ?? "report")}.pdf`;
  doc.save(fname);
}