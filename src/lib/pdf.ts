import jsPDF from "jspdf";

// ---------- Public types (kept compatible with existing callers) ----------
export type Exercise = {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  rpe?: string;
  tempo?: string;
  technique_cues?: string;
  equipment?: string[];
  // Pass-4 fields (optional — tolerated if absent)
  cue?: string;
  rationale?: string;
  superset_id?: string | null;
  variant?: string | null;
  optional?: boolean;
};

export type SectionItem = {
  name: string;
  duration?: string;
  notes?: string;
};

export type Day = {
  day_label: string;
  focus: string;
  rationale?: string;
  exercises: Exercise[];
  warmup?: SectionItem[];
  activation?: SectionItem[];
  dynamic_stretches?: SectionItem[];
  cooldown?: SectionItem[];
  finisher?: SectionItem[];
  finisher_enabled?: boolean;
  cardio?: SectionItem[];
};
export type Week = { week_number: number; focus: string; rationale?: string; days: Day[] };
export type PlanData = { weeks: Week[] };

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
  logo_url?: string | null;
};

export type PdfMeta = {
  title: string;
  summary?: string | null;
  client_name: string;
  duration_weeks?: number | null;
};

// ---------- Asset + luminance helpers ----------
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

/**
 * Compute mean perceptual luminance of an image (0=black, 1=white),
 * ignoring near-transparent pixels. Used to pick a contrasting PDF theme.
 */
async function computeLogoLuminance(dataUrl: string): Promise<number | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const max = 64;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 32) continue; // ignore transparent
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      // Rec. 709 luma
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += l;
      count++;
    }
    if (!count) return null;
    return sum / count;
  } catch {
    return null;
  }
}

// ---------- Theme ----------
type Theme = {
  mode: "light" | "dark";
  bg: [number, number, number];
  bgSubtle: [number, number, number];
  ink: [number, number, number];
  inkMuted: [number, number, number];
  inkGhost: [number, number, number];
  rule: [number, number, number];
  accent: [number, number, number];
  bannerBg: [number, number, number];
  bannerInk: [number, number, number];
};

const LIGHT_THEME: Theme = {
  mode: "light",
  bg: [252, 251, 248],         // warm cream, not stark white
  bgSubtle: [246, 244, 238],
  ink: [16, 18, 22],
  inkMuted: [120, 118, 112],
  inkGhost: [232, 229, 222],   // very soft for huge numbers
  rule: [220, 216, 208],
  accent: [232, 165, 71], // FORGE amber
  bannerBg: [246, 244, 238],
  bannerInk: [16, 18, 22],
};

const DARK_THEME: Theme = {
  mode: "dark",
  bg: [14, 15, 19],
  bgSubtle: [24, 26, 31],
  ink: [242, 238, 230],
  inkMuted: [148, 146, 140],
  inkGhost: [44, 46, 52],
  rule: [50, 52, 58],
  accent: [232, 165, 71],
  bannerBg: [20, 22, 27],
  bannerInk: [242, 238, 230],
};

// ---------- Drawing helpers ----------
function rgb(doc: jsPDF, c: [number, number, number]) {
  return c;
}

function setFill(doc: jsPDF, c: [number, number, number]) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function setText(doc: jsPDF, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}
function setDraw(doc: jsPDF, c: [number, number, number]) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

// ---------- Main ----------
/**
 * Compact-luxury booklet. Design rules:
 *  - 1-week plan should fit ~3-5 pages (1 cover-overview + ~1 page/session).
 *  - No charSpace, no per-letter "tracking" hacks (root cause of kerning artifacts).
 *  - No decorative ghost numbers. No standalone week-divider pages. No empty log grid.
 *  - MAIN WORK rendered as a dense table, not as 150pt cards. Stat columns measured.
 *  - Warmup/Activation/Cooldown rendered as single-line bullets (no rationale fluff).
 *  - Adaptive theme: dark logo → light page, light logo → dark page.
 */
export async function generatePlanPdf(
  meta: PdfMeta,
  plan: PlanData,
  branding: PdfBranding,
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 54;

  // Resolve logo + theme
  let logoData = branding.logo_data_url ?? null;
  if (!logoData && branding.logo_url) logoData = await urlToDataUrl(branding.logo_url);

  let theme: Theme = LIGHT_THEME;
  if (logoData) {
    const lum = await computeLogoLuminance(logoData);
    if (lum != null && lum >= 0.55) theme = DARK_THEME;
    else theme = LIGHT_THEME;
  }

  const brand = (branding.business_name || branding.full_name || "FORGE").toUpperCase();

  const paintPage = () => {
    setFill(doc, theme.bg);
    doc.rect(0, 0, W, H, "F");
  };

  /** Truncate string to fit a given px width at the current font. Adds ellipsis if cut. */
  const fitText = (s: string, maxW: number): string => {
    if (doc.getTextWidth(s) <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (doc.getTextWidth(s.slice(0, mid) + "…") <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return s.slice(0, lo) + "…";
  };

  let y = M;
  let pageHeader = "";

  const drawHeader = () => {
    if (!pageHeader) return;
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(brand, M, 30);
    doc.text(pageHeader, W - M, 30, { align: "right" });
    setDraw(doc, theme.rule);
    doc.setLineWidth(0.3);
    doc.line(M, 36, W - M, 36);
  };

  const drawFooter = (pageIdx: number, total: number) => {
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const left = [branding.business_name, branding.contact_email].filter(Boolean).join("  ·  ");
    if (left) doc.text(left, M, H - 22);
    doc.text(`${pageIdx} / ${total}`, W - M, H - 22, { align: "right" });
  };

  const newPage = (header: string) => {
    doc.addPage();
    paintPage();
    pageHeader = header;
    drawHeader();
    y = M + 8;
  };

  const ensureSpace = (need: number, header: string) => {
    if (y + need > H - M - 30) newPage(header);
  };

  paintPage();

  // ============================================================
  // PAGE 1 — COVER + OVERVIEW (combined, no waste)
  // ============================================================
  const headerBandH = 110;
  setFill(doc, theme.bannerBg);
  doc.rect(0, 0, W, headerBandH, "F");

  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", M, 30, 50, 50, undefined, "FAST");
    } catch { /* ignore */ }
  }
  const brandX = logoData ? M + 64 : M;
  setText(doc, theme.bannerInk);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(brand, brandX, 50);
  if (branding.tagline) {
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(fitText(branding.tagline, W / 2 - brandX), brandX, 64);
  }

  // Right side: client + duration meta in band
  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PREPARED FOR", W - M, 50, { align: "right" });
  setText(doc, theme.bannerInk);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(fitText(meta.client_name, 240), W - M, 68, { align: "right" });

  // Accent rule under header band
  setDraw(doc, theme.accent);
  doc.setLineWidth(2);
  doc.line(0, headerBandH, W, headerBandH);
  doc.setLineWidth(0.5);

  y = headerBandH + 36;

  // Title
  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("TRAINING PROGRAM", M, y);
  y += 16;

  setText(doc, theme.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  const titleLines = doc.splitTextToSize(meta.title, W - M * 2);
  doc.text(titleLines, M, y + 4);
  y += titleLines.length * 30 + 8;

  setDraw(doc, theme.accent);
  doc.setLineWidth(2);
  doc.line(M, y, M + 48, y);
  doc.setLineWidth(0.5);
  y += 22;

  // Summary (single paragraph) — kept compact
  if (meta.summary) {
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    const sumLines = doc.splitTextToSize(meta.summary, W - M * 2);
    doc.text(sumLines, M, y);
    y += sumLines.length * 13 + 12;
  }

  // Meta strip — 4 small KPIs
  const totalSessions = (plan.weeks ?? []).reduce((acc, w) => acc + (w.days?.length ?? 0), 0);
  const totalExercises = (plan.weeks ?? []).reduce(
    (a, w) => a + (w.days ?? []).reduce((b, d) => b + (d.exercises?.length ?? 0), 0), 0,
  );
  const sessionsPerWeek = plan.weeks?.length ? Math.round(totalSessions / plan.weeks.length) : 0;
  const kpis: [string, string][] = [
    ["DURATION", meta.duration_weeks ? `${meta.duration_weeks} wk` : `${plan.weeks?.length ?? 0} wk`],
    ["SESSIONS / WK", String(sessionsPerWeek)],
    ["TOTAL SESSIONS", String(totalSessions)],
    ["EXERCISES", String(totalExercises)],
  ];
  const kpiW = (W - M * 2 - 8 * (kpis.length - 1)) / kpis.length;
  for (let i = 0; i < kpis.length; i++) {
    const x = M + i * (kpiW + 8);
    setFill(doc, theme.bgSubtle);
    doc.rect(x, y, kpiW, 50, "F");
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(kpis[i][0], x + 10, y + 14);
    setText(doc, theme.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(kpis[i][1], x + 10, y + 38);
  }
  y += 50 + 24;

  // Plan-at-a-glance: list every session as one line
  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PLAN AT A GLANCE", M, y);
  y += 6;
  setDraw(doc, theme.rule);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 12;

  for (const week of plan.weeks ?? []) {
    if (y + 16 > H - M - 30) break; // overview never spills past page 1
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`WEEK ${week.week_number}`, M, y);
    if (week.focus) {
      setText(doc, theme.ink);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(fitText(week.focus, W - M * 2 - 60), M + 60, y);
    }
    y += 14;
    for (let di = 0; di < (week.days ?? []).length; di++) {
      if (y + 14 > H - M - 30) break;
      const d = week.days[di];
      const num = String(di + 1).padStart(2, "0");
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(num, M + 8, y);
      setText(doc, theme.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(fitText(d.day_label || `Day ${di + 1}`, 110), M + 32, y);
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(fitText(d.focus || "—", W - M - (M + 156) - 40), M + 156, y);
      const ex = (d.exercises?.length ?? 0);
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`${ex} ex`, W - M, y, { align: "right" });
      y += 13;
    }
    y += 6;
  }

  // ============================================================
  // SESSION PAGES — 1 per session (target)
  // ============================================================
  for (const week of plan.weeks ?? []) {
    for (let di = 0; di < (week.days ?? []).length; di++) {
      const day = week.days[di];
      newPage(`W${week.week_number} · DAY ${di + 1}`);

      // ---- Session header (compact) ----
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(`DAY ${di + 1}  ·  ${(day.day_label || "").toUpperCase()}`, M, y);
      y += 16;

      setText(doc, theme.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      const focusLines = doc.splitTextToSize(day.focus || "Session", W - M * 2);
      doc.text(focusLines, M, y + 4);
      y += focusLines.length * 20 + 6;

      setDraw(doc, theme.accent);
      doc.setLineWidth(2);
      doc.line(M, y, M + 36, y);
      doc.setLineWidth(0.5);
      y += 14;

      // Optional intent — single short line, NOT a full paragraph
      if (day.rationale) {
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        // First sentence only — keep page 1 of session compact
        const firstSentence = (day.rationale.match(/^[^.!?]{8,200}[.!?]/)?.[0] ?? day.rationale)
          .trim();
        const intentLines = doc.splitTextToSize(firstSentence, W - M * 2);
        // Cap at 2 lines max
        const capped = intentLines.slice(0, 2);
        doc.text(capped, M, y);
        y += capped.length * 12 + 10;
      }

      // ---- Light sections (warmup / activation / dyn / cardio / cooldown / finisher) ----
      const renderLightSection = (title: string, items?: SectionItem[]) => {
        if (!items || items.length === 0) return;
        ensureSpace(28 + items.length * 13, pageHeader);

        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text(title.toUpperCase(), M, y);
        setDraw(doc, theme.rule);
        doc.setLineWidth(0.3);
        doc.line(M + 80, y - 3, W - M, y - 3);
        y += 12;

        for (const it of items) {
          ensureSpace(14, pageHeader);
          setText(doc, theme.ink);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          const dur = it.duration ? `   ·   ${it.duration}` : "";
          const line = fitText(`${it.name}${dur}`, W - M * 2 - 4);
          doc.text(`•  ${line}`, M, y);
          y += 13;
        }
        y += 8;
      };

      renderLightSection("Warmup", day.warmup);
      renderLightSection("Activation", day.activation);
      renderLightSection("Dynamic stretches", day.dynamic_stretches);
      renderLightSection("Cardio", day.cardio);

      // ---- MAIN WORK (dense table) ----
      if ((day.exercises ?? []).length > 0) {
        ensureSpace(60, pageHeader);

        // Section banner — flat, single line
        setFill(doc, theme.accent);
        doc.rect(M, y - 1, 3, 16, "F");
        setText(doc, theme.ink);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("MAIN WORK", M + 12, y + 11);
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`${day.exercises.length} exercises`, W - M, y + 11, { align: "right" });
        y += 22;

        // Column geometry
        const colNumX = M;
        const colNumW = 22;
        const colExX = colNumX + colNumW;
        // Reserve right side for stat block
        const statTotalW = 220;
        const statColW = statTotalW / 5; // SETS REPS REST RPE TEMPO
        const statStartX = W - M - statTotalW;
        const colExW = statStartX - colExX - 8;

        // Table header
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.text("#", colNumX + 4, y);
        doc.text("EXERCISE", colExX, y);
        const statLabels = ["SETS", "REPS", "REST", "RPE", "TEMPO"];
        for (let i = 0; i < statLabels.length; i++) {
          doc.text(statLabels[i], statStartX + i * statColW + statColW / 2, y, { align: "center" });
        }
        y += 4;
        setDraw(doc, theme.rule);
        doc.setLineWidth(0.4);
        doc.line(M, y, W - M, y);
        y += 10;

        let lastSuperset: string | null | undefined = undefined;

        for (let i = 0; i < day.exercises.length; i++) {
          const ex = day.exercises[i];

          // Cue extraction — keep it as ONE coaching line
          let cueText = (ex.cue ?? "").trim();
          if (!cueText && ex.technique_cues) {
            const m = ex.technique_cues.trim().match(/^([^.!?\n]{4,160}[.!?])/);
            cueText = (m?.[1] ?? ex.technique_cues.slice(0, 140)).trim();
          }
          if (!cueText && ex.notes) cueText = ex.notes.trim();

          // Pre-measure exercise name (bold 10) and cue (normal 8.5)
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          const nameLines = doc.splitTextToSize(ex.name, colExW);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          const cueLines = cueText ? doc.splitTextToSize(cueText, colExW).slice(0, 2) : [];

          const rowH =
            6 + // top pad
            nameLines.length * 12 +
            (cueLines.length ? 2 + cueLines.length * 10 : 0) +
            10; // bottom pad

          ensureSpace(rowH + 4, pageHeader);

          // Superset bracket label change
          if (ex.superset_id && ex.superset_id !== lastSuperset) {
            ensureSpace(14 + rowH, pageHeader);
            setText(doc, theme.accent);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.text(`SUPERSET ${String(ex.superset_id).toUpperCase()}`, colExX, y + 2);
            y += 8;
          }
          lastSuperset = ex.superset_id ?? null;

          const rowTop = y;

          // Superset left rule — amber, full row height
          if (ex.superset_id) {
            setFill(doc, theme.accent);
            doc.rect(M - 4, rowTop, 2, rowH, "F");
          }

          // Number
          setText(doc, theme.inkMuted);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(String(i + 1).padStart(2, "0"), colNumX + 4, rowTop + 14);

          // Name
          setText(doc, theme.ink);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(nameLines, colExX, rowTop + 14);
          let textY = rowTop + 14 + nameLines.length * 12;

          // Optional pill (inline, no dashed border)
          if (ex.optional) {
            setText(doc, theme.accent);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            const pillW = doc.getTextWidth("OPT") + 10;
            // place after name line 1 — to the right of last name line
            const lastNameW = doc.getTextWidth(nameLines[nameLines.length - 1]);
            // use 2-letter pill; we draw at end of first line for clarity
            setDraw(doc, theme.accent);
            doc.setLineWidth(0.6);
            doc.roundedRect(
              colExX + lastNameW + 6,
              rowTop + 6,
              pillW,
              11,
              2,
              2,
              "S",
            );
            doc.text("OPT", colExX + lastNameW + 6 + 5, rowTop + 14);
          }

          // Cue (single short line, muted)
          if (cueLines.length) {
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.text(cueLines, colExX, textY + 2);
            textY += 2 + cueLines.length * 10;
          }

          // Stats — measured per cell, fit-or-truncate
          const rpeNum = ex.rpe ? parseFloat(String(ex.rpe).replace(/[^\d.]/g, "")) : NaN;
          const rpeHigh = !Number.isNaN(rpeNum) && rpeNum >= 8;
          const stats: Array<[string, boolean]> = [
            [String(ex.sets ?? "—"), false],
            [String(ex.reps ?? "—"), false],
            [String(ex.rest ?? "—"), false],
            [String(ex.rpe ?? "—"), rpeHigh],
            [String(ex.tempo ?? "—"), false],
          ];
          for (let s = 0; s < stats.length; s++) {
            const [val, hot] = stats[s];
            const cx = statStartX + s * statColW + statColW / 2;
            setText(doc, hot ? theme.accent : theme.ink);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            const fitVal = fitText(val, statColW - 8);
            doc.text(fitVal, cx, rowTop + 14, { align: "center" });
          }

          // Bottom hairline divider
          setDraw(doc, theme.rule);
          doc.setLineWidth(0.25);
          doc.line(M, rowTop + rowH - 2, W - M, rowTop + rowH - 2);

          y = rowTop + rowH;
        }
        y += 8;
      }

      renderLightSection("Cooldown", day.cooldown);
      if (day.finisher_enabled !== false) {
        renderLightSection("Optional finisher", day.finisher);
      }
    }
  }

  // ---- Footers on every page ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  doc.save(`${meta.client_name.replace(/\s+/g, "_")}_${meta.title.replace(/\s+/g, "_")}.pdf`);
}