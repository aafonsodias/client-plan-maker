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
  const M = 64; // generous editorial margins

  // Resolve logo + theme
  let logoData = branding.logo_data_url ?? null;
  if (!logoData && branding.logo_url) logoData = await urlToDataUrl(branding.logo_url);

  let theme: Theme = LIGHT_THEME;
  if (logoData) {
    const lum = await computeLogoLuminance(logoData);
    // dark logo  -> light page  | light logo -> dark page
    if (lum != null && lum >= 0.55) theme = DARK_THEME;
    else theme = LIGHT_THEME;
  }

  const paintPage = () => {
    setFill(doc, theme.bg);
    doc.rect(0, 0, W, H, "F");
  };

  const brand = (branding.business_name || branding.full_name || "FORGE").toUpperCase();

  // Tiny brand strip + page number painted on every page after cover
  const paintChrome = (pageLabel: string) => {
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(brand, M, 32);
    doc.text(pageLabel.toUpperCase(), W - M, 32, { align: "right" });
    setDraw(doc, theme.rule);
    doc.setLineWidth(0.4);
    doc.line(M, 40, W - M, 40);
  };

  paintPage();

  let y = M;
  let currentChrome = "";

  const ensureSpace = (need: number) => {
    if (y + need > H - M - 36) {
      doc.addPage();
      paintPage();
      if (currentChrome) paintChrome(currentChrome);
      y = M;
    }
  };

  // ============================================================
  // COVER PAGE
  // ============================================================
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", M, M, 64, 64, undefined, "FAST");
    } catch {
      /* ignore */
    }
  }

  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(brand, W - M, M + 18, { align: "right" });
  if (branding.tagline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(branding.tagline, W - M, M + 32, { align: "right" });
  }

  // Hero block — pushed down for breathing room
  const heroTop = M + 200;

  // Massive ghost mark behind the title
  setText(doc, theme.inkGhost);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(220);
  doc.text("01", W - M + 10, heroTop + 110, { align: "right" });

  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TRAINING PROGRAM", M, heroTop);

  setText(doc, theme.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(38);
  const titleLines = doc.splitTextToSize(meta.title, W - M * 2);
  doc.text(titleLines, M, heroTop + 40);

  setDraw(doc, theme.accent);
  doc.setLineWidth(2.5);
  const ruleY = heroTop + 40 + titleLines.length * 36 + 16;
  doc.line(M, ruleY, M + 80, ruleY);
  doc.setLineWidth(0.5);

  const metaTop = ruleY + 44;
  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PREPARED FOR", M, metaTop);
  doc.text("DURATION", M + 240, metaTop);
  doc.text("WEEKS", M + 380, metaTop);

  setText(doc, theme.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(meta.client_name, M, metaTop + 22);
  doc.text(meta.duration_weeks ? `${meta.duration_weeks} wks` : "—", M + 240, metaTop + 22);
  doc.text(`${plan.weeks?.length ?? 0}`, M + 380, metaTop + 22);

  if (meta.summary) {
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(meta.summary, W - M * 2 - 20);
    doc.text(lines, M, metaTop + 80);
  }

  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const coverFooter = [branding.contact_email, branding.contact_phone].filter(Boolean).join("  ·  ");
  if (coverFooter) doc.text(coverFooter, M, H - M);
  setDraw(doc, theme.accent);
  doc.setLineWidth(2);
  doc.line(M, H - M - 14, M + 24, H - M - 14);
  doc.setLineWidth(0.5);

  // ============================================================
  // WEEK + DAY PAGES
  // ============================================================
  for (const week of plan.weeks ?? []) {
    // ----- Week divider page (full page, editorial) -----
    doc.addPage();
    paintPage();
    currentChrome = `Week ${week.week_number}`;
    paintChrome(currentChrome);
    y = M;

    // Massive ghost week number, centered vertically
    setText(doc, theme.inkGhost);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(380);
    doc.text(String(week.week_number).padStart(2, "0"), W / 2, H / 2 + 90, { align: "center" });

    // Top label
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("PHASE", M, M + 80);

    setText(doc, theme.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    const focus = (week.focus || "Training week").toUpperCase();
    const focusW = doc.splitTextToSize(focus, W - M * 2);
    doc.text(focusW, M, M + 110);

    // Accent rule
    setDraw(doc, theme.accent);
    doc.setLineWidth(2.5);
    const wRuleY = M + 110 + focusW.length * 28 + 18;
    doc.line(M, wRuleY, M + 80, wRuleY);
    doc.setLineWidth(0.5);

    if (week.rationale) {
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(week.rationale, W * 0.55);
      doc.text(lines, M, wRuleY + 28);
    }

    // Days summary at bottom
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(`${(week.days ?? []).length} SESSIONS`, M, H - M);

    for (let di = 0; di < (week.days ?? []).length; di++) {
      const day = week.days[di];

      // Each day starts on a fresh page
      doc.addPage();
      paintPage();
      currentChrome = `Week ${week.week_number} · Day ${di + 1}`;
      paintChrome(currentChrome);
      y = M;

      // ===== LEVEL 1: Session header =====
      // Huge ghost day number behind everything
      setText(doc, theme.inkGhost);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(150);
      doc.text(String(di + 1).padStart(2, "0"), W - M + 8, y + 120, { align: "right" });

      // Tiny eyebrow label
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(`SESSION ${String(di + 1).padStart(2, "0")}  ·  ${day.day_label.toUpperCase()}`, M, y + 14);

      // Bold session title
      setText(doc, theme.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(30);
      const focusLines = doc.splitTextToSize(day.focus || "Session", W - M * 2 - 120);
      doc.text(focusLines, M, y + 48);
      y += 48 + focusLines.length * 32 + 6;

      setDraw(doc, theme.accent);
      doc.setLineWidth(2.5);
      doc.line(M, y, M + 80, y);
      doc.setLineWidth(0.5);
      y += 22;

      if (day.rationale) {
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10.5);
        const lines = doc.splitTextToSize(day.rationale, W - M * 2 - 80);
        doc.text(lines, M, y);
        y += lines.length * 14 + 24;
      } else {
        y += 8;
      }

      // ===== LEVEL 2 (low): warmup / cooldown / activation / dynamic / cardio =====
      const renderLightSection = (title: string, items?: SectionItem[]) => {
        if (!items || items.length === 0) return;
        ensureSpace(60);

        // Dashed rule + small muted label
        setDraw(doc, theme.rule);
        doc.setLineDashPattern([1.5, 2.5], 0);
        doc.setLineWidth(0.4);
        doc.line(M, y, W - M, y);
        doc.setLineDashPattern([], 0);
        y += 14;

        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        // letter-spacing fake via splitting
        doc.text(title.toUpperCase().split("").join(" "), M, y);
        y += 16;

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

          if (rowY + blockH > H - M - 36) {
            doc.addPage();
            paintPage();
            if (currentChrome) paintChrome(currentChrome);
            y = M;
            rowY = y;
            maxRowY = y;
          }

          setText(doc, theme.ink);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.text(labelLines, x, rowY + 10);
          let inner = rowY + 10 + labelLines.length * 12;
          if (noteLines.length) {
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8.5);
            doc.text(noteLines, x, inner);
            inner += noteLines.length * 11;
          }
          maxRowY = Math.max(maxRowY, inner + 10);
          if (twoCol) {
            col = 1 - col;
            if (col === 0) rowY = maxRowY;
          } else {
            rowY = maxRowY;
          }
        }
        y = maxRowY + 14;
      };

      renderLightSection("Warmup", day.warmup);
      renderLightSection("Activation", day.activation);
      renderLightSection("Dynamic stretches", day.dynamic_stretches);
      renderLightSection("Cardio", day.cardio);

      // ===== LEVEL 2 (high): MAIN WORK =====
      if ((day.exercises ?? []).length > 0) {
        ensureSpace(80);

        // Strong amber vertical bar + heavy label
        setFill(doc, theme.accent);
        doc.rect(M, y - 2, 4, 22, "F");
        setText(doc, theme.ink);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("MAIN WORK", M + 16, y + 14);
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(
          `${day.exercises.length} exercise${day.exercises.length === 1 ? "" : "s"}`,
          W - M,
          y + 14,
          { align: "right" },
        );
        y += 34;

        for (let i = 0; i < day.exercises.length; i++) {
          const ex = day.exercises[i];

          // ===== LEVEL 3: Exercise card — V2 tight (lateral ghost + bottom stat row) =====
          const ghostNum = String(i + 1).padStart(2, "0");
          const cardLeft = M;
          const cardRight = W - M;
          const cardW = cardRight - cardLeft;

          // Cue / rationale split (legacy compat)
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

          // Layout: lateral ghost gutter on the left, content occupies remainder, stats sit in a compact bottom row.
          const gutterW = 44;            // tighter than v1 (was effectively 64)
          const padX = 16;               // inner horizontal padding
          const padTop = 16;             // tightened from 22
          const padBottom = 14;          // tightened from 22
          const statRowH = 34;           // compact bottom row
          const statRowGap = 12;         // breathing room between content and stats
          const nameX = cardLeft + gutterW + padX;
          const contentRight = cardRight - padX;
          const contentW = contentRight - nameX;

          // Pre-measure with the actual fonts (critical to avoid overflow)
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          const nameLines = doc.splitTextToSize(ex.name, contentW);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(10.25);
          const cueLines = cueText ? doc.splitTextToSize(cueText, contentW) : [];

          doc.setFont("helvetica", "italic");
          doc.setFontSize(8.75);
          const ratLines = rationaleText ? doc.splitTextToSize(rationaleText, contentW) : [];

          // Vertical rhythm — tight but breathable
          let contentH = padTop + nameLines.length * 17;
          if (muscles) contentH += 12;
          if (cueLines.length) contentH += 8 + cueLines.length * 12.5;
          if (ratLines.length) contentH += 6 + ratLines.length * 11;
          contentH += statRowGap + statRowH + padBottom;
          const finalH = Math.max(contentH, 96);

          ensureSpace(finalH + 8);

          // Card surface — very subtle
          setFill(doc, theme.bgSubtle);
          doc.rect(cardLeft, y, cardW, finalH, "F");

          // Hairline top + bottom rules for elegance
          setDraw(doc, theme.rule);
          doc.setLineWidth(0.4);
          doc.line(cardLeft, y, cardRight, y);
          doc.line(cardLeft, y + finalH, cardRight, y + finalH);

          // Superset → strong amber left border
          if (ex.superset_id) {
            setFill(doc, theme.accent);
            doc.rect(cardLeft, y, 5, finalH, "F");
          }

          // Optional → dashed accent top edge
          if (ex.optional) {
            setDraw(doc, theme.accent);
            doc.setLineDashPattern([2, 2.5], 0);
            doc.setLineWidth(0.8);
            doc.line(cardLeft, y, cardRight, y);
            doc.setLineDashPattern([], 0);
            doc.setLineWidth(0.4);
          }

          // Lateral ghost number — left gutter, no overlap with content
          setText(doc, theme.inkGhost);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(56);
          doc.text(ghostNum, cardLeft + gutterW - 6, y + finalH / 2 + 18, { align: "right" });

          // Exercise name
          setText(doc, theme.ink);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          let textY = y + padTop + 4;
          doc.text(nameLines, nameX, textY);
          textY += nameLines.length * 17;

          // Chips line: variant / superset / optional
          const chips: string[] = [];
          if (ex.variant) chips.push(ex.variant);
          if (ex.superset_id) chips.push(`Superset ${ex.superset_id}`);
          if (ex.optional) chips.push("Optional");
          if (chips.length) {
            setText(doc, ex.optional ? theme.accent : theme.inkMuted);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.75);
            doc.text(chips.join("   ·   ").toUpperCase(), nameX, textY - 5);
          }

          // Muscles
          if (muscles) {
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.25);
            doc.text(muscles, nameX, textY + 6);
            textY += 12;
          }

          // Coaching cue
          if (cueLines.length) {
            textY += 8;
            setText(doc, theme.ink);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10.25);
            doc.text(cueLines, nameX, textY);
            textY += cueLines.length * 12.5;
          }

          // Rationale
          if (ratLines.length) {
            textY += 6;
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8.75);
            doc.text(ratLines, nameX, textY);
            textY += ratLines.length * 11;
          }

          // ===== Bottom stat row — no borders, just labels + big values, hairline above =====
          const rpeNum = ex.rpe ? parseFloat(String(ex.rpe).replace(/[^\d.]/g, "")) : NaN;
          const rpeHigh = !Number.isNaN(rpeNum) && rpeNum >= 8;

          const statRowY = y + finalH - padBottom - statRowH;
          // hairline above the stat row
          setDraw(doc, theme.rule);
          doc.setLineWidth(0.3);
          doc.line(nameX, statRowY, contentRight, statRowY);

          const stats: Array<[string, string, boolean]> = [
            ["SETS", String(ex.sets ?? "—"), false],
            ["REPS", String(ex.reps ?? "—"), false],
            ["REST", String(ex.rest ?? "—"), false],
          ];
          if (ex.rpe) stats.push(["RPE", String(ex.rpe), rpeHigh]);
          if (ex.tempo) stats.push(["TEMPO", String(ex.tempo), false]);

          const colW = (contentRight - nameX) / stats.length;
          for (let s = 0; s < stats.length; s++) {
            const [label, val, hot] = stats[s];
            const cx = nameX + s * colW;
            // subtle vertical hairline divider between cells (skip first)
            if (s > 0) {
              setDraw(doc, theme.rule);
              doc.setLineWidth(0.3);
              doc.line(cx, statRowY + 6, cx, statRowY + statRowH - 4);
            }
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.75);
            doc.text(label, cx + 8, statRowY + 13);
            setText(doc, hot ? theme.accent : theme.ink);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(val, cx + 8, statRowY + 30);
          }

          // Legacy notes fallback (only if we had no cue/rationale at all)
          if (ex.notes && !cueText && !rationaleText) {
            const noteLines = doc.splitTextToSize(ex.notes, contentW);
            setText(doc, theme.inkMuted);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.75);
            doc.text(noteLines, nameX, textY + 4);
          }

          y += finalH + 8;
        }

        // ===== LEVEL 4: Manual log grid — dotted, restrained =====
        ensureSpace(70);
        y += 12;
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text("L O G", M, y + 8);

        const logRows = ["SET", "REPS", "WEIGHT"];
        const logCols = 5;
        const logLeft = M + 60;
        const logW = W - M - logLeft;
        const cellW = logW / logCols;
        setDraw(doc, theme.rule);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([0.8, 1.6], 0);
        for (let r = 0; r < logRows.length; r++) {
          const ry = y + r * 16;
          setText(doc, theme.inkMuted);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.text(logRows[r], M, ry + 8);
          for (let c = 0; c < logCols; c++) {
            const cx = logLeft + c * cellW;
            doc.line(cx + 4, ry + 10, cx + cellW - 8, ry + 10);
          }
        }
        doc.setLineDashPattern([], 0);
        y += logRows.length * 16 + 10;
      }

      renderLightSection("Cooldown", day.cooldown);
      if (day.finisher_enabled !== false) {
        renderLightSection("Optional finisher", day.finisher);
      }
    }
  }

  // ============================================================
  // FOOTERS — every page except cover
  // ============================================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i === 1) continue;
    setText(doc, theme.inkMuted);
    setDraw(doc, theme.rule);
    doc.setLineWidth(0.3);
    doc.line(M, H - 38, W - M, H - 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const footer = [branding.business_name, branding.contact_email, branding.contact_phone]
      .filter(Boolean)
      .join("  ·  ");
    if (footer) doc.text(footer, M, H - 22);
    doc.setFont("helvetica", "bold");
    doc.text(`${String(i).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}`, W - M, H - 22, {
      align: "right",
    });
  }

  doc.save(`${meta.client_name.replace(/\s+/g, "_")}_${meta.title.replace(/\s+/g, "_")}.pdf`);
}