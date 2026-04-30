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
export async function generatePlanPdf(
  meta: PdfMeta,
  plan: PlanData,
  branding: PdfBranding,
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;

  // Resolve logo + theme
  let logoData = branding.logo_data_url ?? null;
  if (!logoData && branding.logo_url) logoData = await urlToDataUrl(branding.logo_url);

  let theme: Theme = LIGHT_THEME;
  if (logoData) {
    const lum = await computeLogoLuminance(logoData);
    // dark logo (lum < 0.45)  -> light page
    // light logo (lum >= 0.55) -> dark page
    // ambiguous (0.45..0.55)  -> default light (safer print)
    if (lum != null && lum >= 0.55) theme = DARK_THEME;
    else theme = LIGHT_THEME;
  }

  // Page background painter — invoked at the start of every new page
  const paintPage = () => {
    setFill(doc, theme.bg);
    doc.rect(0, 0, W, H, "F");
  };

  paintPage();

  let y = M;

  const ensureSpace = (need: number) => {
    if (y + need > H - M - 24) {
      doc.addPage();
      paintPage();
      y = M;
    }
  };

  // ----- Cover page -----
  // Logo top-left
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", M, M, 56, 56, undefined, "FAST");
    } catch {
      /* ignore */
    }
  }

  // Brand stamp top-right
  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const brand = (branding.business_name || branding.full_name || "FORGE").toUpperCase();
  doc.text(brand, W - M, M + 14, { align: "right" });
  if (branding.tagline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(branding.tagline, W - M, M + 26, { align: "right" });
  }

  // Hero block
  const heroTop = M + 140;
  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TRAINING PROGRAM", M, heroTop);

  setText(doc, theme.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  const titleLines = doc.splitTextToSize(meta.title, W - M * 2);
  doc.text(titleLines, M, heroTop + 36);

  // Accent rule
  setDraw(doc, theme.accent);
  doc.setLineWidth(2);
  doc.line(M, heroTop + 36 + titleLines.length * 32 + 8, M + 60, heroTop + 36 + titleLines.length * 32 + 8);
  doc.setLineWidth(0.5);

  // Client + meta
  const metaTop = heroTop + 36 + titleLines.length * 32 + 36;
  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PREPARED FOR", M, metaTop);
  doc.text("DURATION", M + 220, metaTop);
  doc.text("PHASES", M + 360, metaTop);

  setText(doc, theme.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(meta.client_name, M, metaTop + 18);
  doc.text(meta.duration_weeks ? `${meta.duration_weeks} weeks` : "—", M + 220, metaTop + 18);
  doc.text(`${plan.weeks?.length ?? 0}`, M + 360, metaTop + 18);

  // Summary
  if (meta.summary) {
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(meta.summary, W - M * 2);
    doc.text(lines, M, metaTop + 60);
  }

  // Footer signature on cover
  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const coverFooter = [branding.contact_email, branding.contact_phone].filter(Boolean).join("  ·  ");
  if (coverFooter) doc.text(coverFooter, M, H - M);

  // ----- Day pages -----
  for (const week of plan.weeks ?? []) {
    // Week divider page header (inline, no separate page)
    doc.addPage();
    paintPage();
    y = M;

    // Week banner — minimal: small label + huge ghost number
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`WEEK ${String(week.week_number).padStart(2, "0")}`, M, y + 8);

    setText(doc, theme.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    const focus = (week.focus || "Training week").toUpperCase();
    doc.text(focus, M, y + 36);

    // Ghost week number
    setText(doc, theme.inkGhost);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(140);
    doc.text(String(week.week_number), W - M, y + 110, { align: "right" });

    setText(doc, theme.ink);
    y += 140;

    // Accent rule
    setDraw(doc, theme.accent);
    doc.setLineWidth(2);
    doc.line(M, y, M + 60, y);
    doc.setLineWidth(0.5);
    y += 18;

    if (week.rationale) {
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(week.rationale, W - M * 2);
      doc.text(lines, M, y);
      y += lines.length * 13 + 12;
    }

    for (let di = 0; di < (week.days ?? []).length; di++) {
      const day = week.days[di];

      // Each day starts on a fresh page for that booklet feel
      doc.addPage();
      paintPage();
      y = M;

      // Top brand strip
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(`${brand}  ·  WEEK ${week.week_number}`, M, M - 16);
      doc.text(meta.client_name.toUpperCase(), W - M, M - 16, { align: "right" });

      // Ghost day number
      setText(doc, theme.inkGhost);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(120);
      doc.text(String(di + 1).padStart(2, "0"), W - M, y + 90, { align: "right" });

      // Day label
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(day.day_label.toUpperCase(), M, y + 8);

      setText(doc, theme.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      const focusLines = doc.splitTextToSize(day.focus || "Session", W - M * 2 - 100);
      doc.text(focusLines, M, y + 36);
      y += 36 + focusLines.length * 26 + 4;

      setDraw(doc, theme.accent);
      doc.setLineWidth(2);
      doc.line(M, y, M + 60, y);
      doc.setLineWidth(0.5);
      y += 18;

      if (day.rationale) {
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(day.rationale, W - M * 2);
        doc.text(lines, M, y);
        y += lines.length * 13 + 14;
      }

      // ---- Section renderer for warmup/cooldown/etc (low importance, dashed) ----
      const renderLightSection = (title: string, items?: SectionItem[]) => {
        if (!items || items.length === 0) return;
        ensureSpace(40);

        // Dashed rule + label
        setDraw(doc, theme.rule);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(M, y, W - M, y);
        doc.setLineDashPattern([], 0);
        y += 10;

        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(title.toUpperCase(), M, y);
        y += 12;

        // Two-column layout when ≥3 items
        const twoCol = items.length >= 3;
        const colW = twoCol ? (W - M * 2 - 20) / 2 : W - M * 2;
        let col = 0;
        let rowY = y;
        let maxRowY = y;

        setText(doc, theme.ink);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        for (const it of items) {
          const x = M + col * (colW + 20);
          const label = it.duration ? `${it.name}  ·  ${it.duration}` : it.name;
          const labelLines = doc.splitTextToSize(label, colW);
          const noteLines = it.notes ? doc.splitTextToSize(it.notes, colW) : [];
          const blockH = labelLines.length * 12 + (noteLines.length ? noteLines.length * 11 + 2 : 0) + 8;

          if (rowY + blockH > H - M - 24) {
            doc.addPage();
            paintPage();
            y = M;
            rowY = y;
            maxRowY = y;
          }

          setText(doc, theme.ink);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(labelLines, x, rowY + 10);
          let inner = rowY + 10 + labelLines.length * 12;
          if (noteLines.length) {
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(noteLines, x, inner);
            inner += noteLines.length * 11;
          }
          maxRowY = Math.max(maxRowY, inner + 8);
          if (twoCol) {
            col = 1 - col;
            if (col === 0) rowY = maxRowY;
          } else {
            rowY = maxRowY;
          }
        }
        y = maxRowY + 6;
      };

      renderLightSection("Warmup", day.warmup);
      renderLightSection("Activation", day.activation);
      renderLightSection("Dynamic stretches", day.dynamic_stretches);
      renderLightSection("Cardio", day.cardio);

      // ---- MAIN WORK ----
      if ((day.exercises ?? []).length > 0) {
        ensureSpace(40);

        // Solid accent bar + label (high importance)
        setFill(doc, theme.accent);
        doc.rect(M, y, 28, 3, "F");
        setText(doc, theme.ink);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("MAIN WORK", M + 36, y + 4);
        y += 18;

        for (let i = 0; i < day.exercises.length; i++) {
          const ex = day.exercises[i];

          // Pre-compute layout
          const ghostNum = String(i + 1).padStart(2, "0");
          const cardLeft = M;
          const cardRight = W - M;
          const cardW = cardRight - cardLeft;
          const statBoxW = 70;
          const statBoxH = 36;
          const statsX = cardRight - statBoxW * 3 - 8;

          // Cue + rationale split (compat with legacy technique_cues)
          const rawCue = ex.cue ?? "";
          const rawRationale = ex.rationale ?? "";
          const techCues = ex.technique_cues ?? "";
          let cueText = rawCue || "";
          let rationaleText = rawRationale || "";
          if (!cueText && techCues) {
            const m = techCues.trim().match(/^([^.!?\n]{4,140}[.!?])\s*(.*)$/);
            if (m) {
              cueText = m[1].trim();
              if (!rationaleText) rationaleText = (m[2] || "").trim();
            } else {
              cueText = techCues.slice(0, 100);
              if (!rationaleText && techCues.length > 100) rationaleText = techCues;
            }
          }

          const muscles = [
            ...(ex.primary_muscles ?? []),
            ...((ex.secondary_muscles ?? []).map((m) => `(${m})`)),
          ].join(" · ");

          // Estimate height
          const nameLines = doc.splitTextToSize(ex.name, statsX - cardLeft - 50);
          const cueLines = cueText ? doc.splitTextToSize(cueText, cardW - 16) : [];
          const ratLines = rationaleText ? doc.splitTextToSize(rationaleText, cardW - 16) : [];
          const cardH =
            18 + // top padding
            nameLines.length * 18 +
            (muscles ? 14 : 0) +
            (cueLines.length ? cueLines.length * 12 + 8 : 0) +
            (ratLines.length ? ratLines.length * 11 + 6 : 0) +
            18; // bottom padding
          const finalH = Math.max(cardH, statBoxH + 36);

          ensureSpace(finalH + 8);

          // Card background (subtle)
          setFill(doc, theme.bgSubtle);
          doc.rect(cardLeft, y, cardW, finalH, "F");

          // Superset accent left border
          if (ex.superset_id) {
            setFill(doc, theme.accent);
            doc.rect(cardLeft, y, 3, finalH, "F");
          }

          // Optional flag — small dashed top border
          if (ex.optional) {
            setDraw(doc, theme.inkMuted);
            doc.setLineDashPattern([2, 2], 0);
            doc.line(cardLeft + 8, y + 4, cardLeft + 60, y + 4);
            doc.setLineDashPattern([], 0);
          }

          // Ghost exercise number
          setText(doc, theme.inkGhost);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(40);
          doc.text(ghostNum, cardLeft + 14, y + finalH - 12);

          // Name
          setText(doc, theme.ink);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          const nameX = cardLeft + 56;
          let textY = y + 24;
          doc.text(nameLines, nameX, textY);
          textY += nameLines.length * 18;

          // Variant + superset chip line
          const chips: string[] = [];
          if (ex.variant) chips.push(ex.variant);
          if (ex.superset_id) chips.push(`Superset ${ex.superset_id}`);
          if (ex.optional) chips.push("Optional");
          if (chips.length) {
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.text(chips.join("  ·  ").toUpperCase(), nameX, textY - 4);
          }

          // Muscles
          if (muscles) {
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(muscles, nameX, textY + 8);
            textY += 14;
          }

          // Cue (action — non-italic, slightly darker)
          if (cueLines.length) {
            textY += 6;
            setText(doc, theme.ink);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.text(cueLines, nameX, textY);
            textY += cueLines.length * 12;
          }

          // Rationale (italic, muted)
          if (ratLines.length) {
            textY += 4;
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.text(ratLines, nameX, textY);
            textY += ratLines.length * 11;
          }

          // Stats: Sets / Reps / Rest in three boxes top-right
          const statTop = y + 12;
          const stats: Array<[string, string]> = [
            ["SETS", String(ex.sets ?? "—")],
            ["REPS", String(ex.reps ?? "—")],
            ["REST", String(ex.rest ?? "—")],
          ];
          if (ex.rpe) stats.push(["RPE", String(ex.rpe)]);
          if (ex.tempo) stats.push(["TEMPO", String(ex.tempo)]);

          // Render up to 3 visible boxes; if RPE/tempo present, prefer Sets/Reps/Rest then a row beneath
          const main = stats.slice(0, 3);
          const extra = stats.slice(3, 5);

          for (let s = 0; s < main.length; s++) {
            const [label, val] = main[s];
            const bx = statsX + s * statBoxW;
            // Box border (subtle)
            setDraw(doc, theme.rule);
            doc.setLineWidth(0.5);
            doc.rect(bx, statTop, statBoxW - 6, statBoxH);
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.text(label, bx + 6, statTop + 11);
            setText(doc, theme.ink);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.text(val, bx + 6, statTop + 28);
          }
          if (extra.length) {
            const exTop = statTop + statBoxH + 4;
            for (let s = 0; s < extra.length; s++) {
              const [label, val] = extra[s];
              const bx = statsX + s * statBoxW;
              setText(doc, theme.inkMuted);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7);
              doc.text(`${label}  ${val}`, bx + 2, exTop + 8);
            }
          }

          // Notes (legacy)
          if (ex.notes && !cueText && !rationaleText) {
            const noteLines = doc.splitTextToSize(ex.notes, cardW - 16);
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(noteLines, nameX, textY + 6);
          }

          y += finalH + 8;
        }

        // Log grid hint — minimal weight × reps row for manual entry
        ensureSpace(50);
        y += 4;
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text("LOG", M, y + 8);
        setDraw(doc, theme.rule);
        doc.setLineWidth(0.5);
        const cellW = (W - M * 2 - 30) / 5;
        for (let s = 0; s < 5; s++) {
          const x = M + 30 + s * cellW;
          doc.line(x, y + 22, x + cellW - 6, y + 22);
          setText(doc, theme.inkMuted);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text(`SET ${s + 1}`, x, y + 18);
        }
        y += 32;
      }

      renderLightSection("Cooldown", day.cooldown);
      if (day.finisher_enabled !== false) {
        renderLightSection("Optional finisher", day.finisher);
      }
    }
  }

  // ----- Footer on every page -----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const footer = [branding.business_name, branding.contact_email, branding.contact_phone]
      .filter(Boolean)
      .join("  ·  ");
    if (footer && i > 1) doc.text(footer, M, H - 24);
    doc.text(`${i} / ${pageCount}`, W - M, H - 24, { align: "right" });
  }

  doc.save(`${meta.client_name.replace(/\s+/g, "_")}_${meta.title.replace(/\s+/g, "_")}.pdf`);
}