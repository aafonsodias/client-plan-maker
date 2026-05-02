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
async function loadLogoMeta(
  dataUrl: string,
): Promise<{ luminance: number | null; width: number; height: number } | null> {
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
    if (!ctx) return { luminance: null, width: img.width, height: img.height };
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
    return {
      luminance: count ? sum / count : null,
      width: img.width,
      height: img.height,
    };
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
  // Landscape A4 — 842 × 595 pt. Wider canvas means the dense exercise
  // table no longer clips and we can fit one whole session per page.
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;

  // Resolve logo + theme
  let logoData = branding.logo_data_url ?? null;
  if (!logoData && branding.logo_url) logoData = await urlToDataUrl(branding.logo_url);

  let theme: Theme = LIGHT_THEME;
  let logoMeta: { luminance: number | null; width: number; height: number } | null = null;
  if (logoData) {
    logoMeta = await loadLogoMeta(logoData);
    if (logoMeta?.luminance != null && logoMeta.luminance >= 0.55) theme = DARK_THEME;
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

  // ---------- Helpers ----------
  const norm = (s: string) =>
    String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  const exKey = (name: string) => norm(name);

  /** Compute a short delta string by diffing W2/3/4 against W1 for the same exercise. */
  const diffDelta = (
    base: Exercise | undefined,
    later: Exercise | undefined,
  ): string => {
    if (!later) return "—";
    if (!base) return "new";
    const out: string[] = [];
    const a = (v?: string) => String(v ?? "").trim();
    if (a(base.sets) !== a(later.sets) && a(later.sets)) out.push(`${later.sets} sets`);
    if (a(base.reps) !== a(later.reps) && a(later.reps)) out.push(`${later.reps} reps`);
    if (a(base.rpe) !== a(later.rpe) && a(later.rpe)) out.push(`@${later.rpe}`);
    if (a(base.rest) !== a(later.rest) && a(later.rest)) out.push(`rest ${later.rest}`);
    // Detect load chip baked into notes (e.g. "+2.5kg")
    const loadM = (later.notes ?? "").match(/(?:^|\s)([+\-]\s*\d+(?:\.\d+)?\s*(?:kg|lb|%))/i);
    if (loadM) out.push(loadM[1].replace(/\s+/g, ""));
    return out.length ? out.join(" · ") : "—";
  };

  // Group sessions by archetype (day_label + focus). One archetype = one PDF page.
  // Each archetype carries an array of (week → day) so we can emit delta columns.
  type Archetype = {
    key: string;
    label: string;
    focus: string;
    weeks: { week_number: number; day: Day }[];
    base: Day; // first occurrence used for prep/main/cool prescription
  };
  const archetypes: Archetype[] = [];
  const byKey = new Map<string, Archetype>();
  for (const w of plan.weeks ?? []) {
    for (const d of w.days ?? []) {
      const k = `${norm(d.day_label || "")}__${norm(d.focus || "")}`;
      let arc = byKey.get(k);
      if (!arc) {
        arc = { key: k, label: d.day_label || "Session", focus: d.focus || "", weeks: [], base: d };
        byKey.set(k, arc);
        archetypes.push(arc);
      }
      arc.weeks.push({ week_number: w.week_number, day: d });
    }
  }
  const totalWeeks = plan.weeks?.length ?? 0;
  const numWeeks = Math.min(totalWeeks, 4); // we render at most W1..W4 columns

  // ============================================================
  // PAGE 1 — COVER (compact landscape)
  // ============================================================
  const headerBandH = 70;
  setFill(doc, theme.bannerBg);
  doc.rect(0, 0, W, headerBandH, "F");

  // Logo, aspect-correct, fit into 40x40 box
  if (logoData && logoMeta) {
    try {
      const box = 40;
      const s = Math.min(box / Math.max(1, logoMeta.width), box / Math.max(1, logoMeta.height));
      const lw = Math.max(8, Math.round(logoMeta.width * s));
      const lh = Math.max(8, Math.round(logoMeta.height * s));
      const lx = M + (box - lw) / 2;
      const ly = (headerBandH - lh) / 2;
      doc.addImage(logoData, "PNG", lx, ly, lw, lh, undefined, "FAST");
    } catch { /* ignore */ }
  }
  // When a logo image is present it usually already carries the wordmark,
  // so we skip the duplicated brand text and only render the tagline (if any)
  // to the right of the mark. Without a logo we keep the text wordmark.
  const brandX = logoData ? M + 52 : M;
  if (!logoData) {
    setText(doc, theme.bannerInk);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(brand, brandX, 30);
  }
  if (branding.tagline) {
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(fitText(branding.tagline, W / 2 - brandX), brandX, logoData ? 38 : 44);
  }

  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PREPARED FOR", W - M, 28, { align: "right" });
  setText(doc, theme.bannerInk);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(fitText(meta.client_name, 240), W - M, 46, { align: "right" });

  setDraw(doc, theme.accent);
  doc.setLineWidth(2);
  doc.line(0, headerBandH, W, headerBandH);
  doc.setLineWidth(0.5);

  y = headerBandH + 28;

  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("TRAINING PROGRAM", M, y);
  y += 14;

  setText(doc, theme.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  const titleLines = doc.splitTextToSize(meta.title, W - M * 2).slice(0, 2);
  doc.text(titleLines, M, y + 4);
  y += titleLines.length * 24 + 6;

  setDraw(doc, theme.accent);
  doc.setLineWidth(2);
  doc.line(M, y, M + 40, y);
  doc.setLineWidth(0.5);
  y += 16;

  if (meta.summary) {
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    const sumLines = doc.splitTextToSize(meta.summary, W - M * 2).slice(0, 2);
    doc.text(sumLines, M, y);
    y += sumLines.length * 12 + 10;
  }

  // KPI strip
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
    ["ARCHETYPES", String(archetypes.length)],
  ];
  const kpiW = (W - M * 2 - 8 * (kpis.length - 1)) / kpis.length;
  for (let i = 0; i < kpis.length; i++) {
    const x = M + i * (kpiW + 8);
    setFill(doc, theme.bgSubtle);
    doc.rect(x, y, kpiW, 38, "F");
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(kpis[i][0], x + 8, y + 12);
    setText(doc, theme.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(kpis[i][1], x + 8, y + 30);
  }
  y += 38 + 18;

  // Plan-at-a-glance: one row per archetype × week
  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PLAN AT A GLANCE", M, y);
  y += 4;
  setDraw(doc, theme.rule);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 12;

  // Header row
  const glanceLeftW = 220;
  setText(doc, theme.inkMuted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("SESSION", M, y);
  doc.text("FOCUS", M + 110, y);
  for (let wi = 0; wi < numWeeks; wi++) {
    const wx = M + glanceLeftW + 60 + wi * 80;
    doc.text(`W${wi + 1} EX`, wx, y, { align: "center" });
  }
  y += 4;
  setDraw(doc, theme.rule);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 10;

  for (const arc of archetypes) {
    if (y + 14 > H - M - 20) break;
    setText(doc, theme.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(fitText(arc.label, 100), M, y);
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(fitText(arc.focus || "—", glanceLeftW - 10), M + 110, y);
    for (let wi = 0; wi < numWeeks; wi++) {
      const wx = M + glanceLeftW + 60 + wi * 80;
      const w = arc.weeks.find((ww) => ww.week_number === wi + 1);
      const exCount = w?.day.exercises?.length ?? 0;
      setText(doc, theme.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(exCount ? `${exCount}` : "—", wx, y, { align: "center" });
    }
    y += 13;
  }

  // ============================================================
  // ARCHETYPE PAGES — 1 per session archetype
  // ============================================================
  const renderInlineStrip = (title: string, items: SectionItem[] | undefined) => {
    if (!items || items.length === 0) return;
    // single shaded strip, comma-separated bullets, max 2 lines
    const inline = items
      .map((i) => `${i.name}${i.duration ? ` ${i.duration}` : ""}`)
      .join("  ·  ");
    setFill(doc, theme.bgSubtle);
    // measure required height (2 lines max)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const wrap = doc.splitTextToSize(inline, W - M * 2 - 60).slice(0, 2);
    const stripH = 8 + wrap.length * 11;
    ensureSpace(stripH + 6, pageHeader);
    doc.rect(M, y, W - M * 2, stripH, "F");
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(title, M + 8, y + 11);
    setText(doc, theme.ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(wrap, M + 56, y + 11);
    y += stripH + 6;
  };

  // Combine prep / cool inputs from base day.
  const collectPrep = (d: Day): SectionItem[] => [
    ...(d.warmup ?? []),
    ...(d.activation ?? []),
    ...(d.dynamic_stretches ?? []),
    ...(d.cardio ?? []),
  ];
  const collectCool = (d: Day): SectionItem[] => [
    ...(d.cooldown ?? []),
    ...(d.finisher_enabled !== false ? d.finisher ?? [] : []),
  ];

  for (const arc of archetypes) {
    newPage(`${arc.label.toUpperCase()} · ${arc.focus.toUpperCase()}`);

    // Session header — single row
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(arc.label.toUpperCase(), M, y);
    setText(doc, theme.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(fitText(arc.focus || "Session", W - M * 2 - 200), M, y + 18);

    // Right-side meta: ex count and approx sets
    const baseEx = arc.base.exercises ?? [];
    const setsEstimate = baseEx.reduce((acc, e) => {
      const n = parseInt(String(e.sets ?? "").replace(/[^\d]/g, ""), 10);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`${baseEx.length} ex · ~${setsEstimate} sets`, W - M, y + 18, { align: "right" });

    y += 24;
    setDraw(doc, theme.accent);
    doc.setLineWidth(2);
    doc.line(M, y, M + 40, y);
    doc.setLineWidth(0.5);
    y += 10;

    // PREP strip
    renderInlineStrip("PREP", collectPrep(arc.base));

    // ---- MAIN WORK table ----
    if (baseEx.length > 0) {
      // Build per-exercise W2/3/4 deltas by matching name across weeks
      const weekDayMap = new Map<number, Day>();
      for (const w of arc.weeks) weekDayMap.set(w.week_number, w.day);
      const w1Day = weekDayMap.get(1) ?? arc.base;
      const w1Index = new Map<string, Exercise>();
      for (const ex of w1Day.exercises ?? []) w1Index.set(exKey(ex.name), ex);

      // Column geometry — landscape A4 = 842pt wide, M=36 → 770pt usable
      const colNumW = 22;
      const colExW = 200;
      const colCueW = 150;
      const statCols = ["SETS", "REPS", "REST", "RPE", "TEMPO"];
      const statColW = 38;
      const deltaCols = Math.max(0, numWeeks - 1); // W2..W4
      const deltaColW = 70;

      // Compute total and shrink cue column if needed
      const required =
        colNumW + colExW + colCueW + statCols.length * statColW + deltaCols * deltaColW;
      const slack = (W - M * 2) - required;
      const cueW = Math.max(110, colCueW + slack);

      const xNum = M;
      const xEx = xNum + colNumW;
      const xCue = xEx + colExW;
      const xStat0 = xCue + cueW;
      const xDelta0 = xStat0 + statCols.length * statColW;

      // Header
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text("#", xNum + 4, y);
      doc.text("EXERCISE", xEx, y);
      doc.text("CUE", xCue, y);
      for (let s = 0; s < statCols.length; s++) {
        doc.text(statCols[s], xStat0 + s * statColW + statColW / 2, y, { align: "center" });
      }
      for (let dI = 0; dI < deltaCols; dI++) {
        doc.text(`W${dI + 2} Δ`, xDelta0 + dI * deltaColW + deltaColW / 2, y, { align: "center" });
      }
      y += 4;
      setDraw(doc, theme.rule);
      doc.setLineWidth(0.4);
      doc.line(M, y, W - M, y);
      y += 10;

      // Row geometry
      const rowH = 18;

      // Track superset groups for bracket post-pass
      type Bracket = { id: string; topY: number; botY: number };
      const brackets: Bracket[] = [];
      let openBracket: Bracket | null = null;

      for (let i = 0; i < baseEx.length; i++) {
        const ex = baseEx[i];
        ensureSpace(rowH + 2, pageHeader);
        const rowTop = y;

        // Zebra fill (every other row) — very subtle
        if (i % 2 === 1) {
          setFill(doc, theme.bgSubtle);
          doc.rect(M, rowTop, W - M * 2, rowH, "F");
        }

        // Number
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(String(i + 1).padStart(2, "0"), xNum + 4, rowTop + 12);

        // Name
        setText(doc, theme.ink);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text(fitText(ex.name, colExW - 4), xEx, rowTop + 12);

        // Cue (single line)
        let cueText = (ex.cue ?? "").trim();
        if (!cueText && ex.technique_cues) cueText = ex.technique_cues.trim();
        if (!cueText && ex.notes) cueText = ex.notes.trim();
        if (cueText) {
          setText(doc, theme.inkMuted);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.text(fitText(cueText, cueW - 6), xCue, rowTop + 12);
        }

        // Stats
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
          const cx = xStat0 + s * statColW + statColW / 2;
          setText(doc, hot ? theme.accent : theme.ink);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.text(fitText(val, statColW - 6), cx, rowTop + 12, { align: "center" });
        }

        // Delta columns: compare W{n+2} day exercises by name to this W1 row
        const baseForDelta = w1Index.get(exKey(ex.name)) ?? ex;
        for (let dI = 0; dI < deltaCols; dI++) {
          const wn = dI + 2;
          const dDay = weekDayMap.get(wn);
          const later = dDay?.exercises?.find((e) => exKey(e.name) === exKey(ex.name));
          const delta = diffDelta(baseForDelta, later);
          const cx = xDelta0 + dI * deltaColW + deltaColW / 2;
          setText(doc, delta === "—" ? theme.inkMuted : theme.ink);
          doc.setFont("helvetica", delta === "—" ? "normal" : "bold");
          doc.setFontSize(8);
          doc.text(fitText(delta, deltaColW - 6), cx, rowTop + 12, { align: "center" });
        }

        // Superset tracking
        if (ex.superset_id) {
          if (!openBracket || openBracket.id !== ex.superset_id) {
            openBracket = { id: ex.superset_id, topY: rowTop, botY: rowTop + rowH };
            brackets.push(openBracket);
          } else {
            openBracket.botY = rowTop + rowH;
          }
        } else {
          openBracket = null;
        }

        y = rowTop + rowH;
      }

      // Draw superset brackets AFTER rows (no clipping)
      for (const b of brackets) {
        const bx = M - 6;
        setDraw(doc, theme.accent);
        doc.setLineWidth(1.4);
        // vertical
        doc.line(bx, b.topY + 2, bx, b.botY - 2);
        // top cap
        doc.line(bx, b.topY + 2, bx + 4, b.topY + 2);
        // bottom cap
        doc.line(bx, b.botY - 2, bx + 4, b.botY - 2);
      }

      y += 6;
    }

    // COOL strip
    renderInlineStrip("COOL", collectCool(arc.base));
  }

  // ---- Footers on every page ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  doc.save(`${meta.client_name.replace(/\s+/g, "_")}_${meta.title.replace(/\s+/g, "_")}.pdf`);
}

// ===========================================================================
// Logsheet PDF — printable A4 for the gym wall ("placa") with blank rows
// to write actual reps/load/RPE next to each prescribed set. One page per
// session-archetype × selected week. The trainer brings these back to the
// app via Importar Registo.
// ===========================================================================

export async function generateLogsheetPdf(
  meta: PdfMeta,
  plan: PlanData,
  branding: PdfBranding,
  opts?: { week?: number },
) {
  const targetWeek = opts?.week ?? 1;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;

  let logoData = branding.logo_data_url ?? null;
  if (!logoData && branding.logo_url) logoData = await urlToDataUrl(branding.logo_url);
  let theme: Theme = LIGHT_THEME;
  if (logoData) {
    const lm = await loadLogoMeta(logoData);
    if (lm?.luminance != null && lm.luminance >= 0.55) theme = DARK_THEME;
  }
  const brand = (branding.business_name || branding.full_name || "FORGE").toUpperCase();

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

  // Find the requested week. Falls back to whatever week exists.
  const week =
    plan.weeks.find((w) => w.week_number === targetWeek) ?? plan.weeks[0];
  if (!week) {
    setFill(doc, theme.bg);
    doc.rect(0, 0, W, H, "F");
    setText(doc, theme.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Plano sem semanas para imprimir.", M, M + 20);
    doc.save(`${meta.client_name.replace(/\s+/g, "_")}_logsheet.pdf`);
    return;
  }

  let pageIdx = 0;
  for (const day of week.days ?? []) {
    pageIdx++;
    if (pageIdx > 1) doc.addPage();

    setFill(doc, theme.bg);
    doc.rect(0, 0, W, H, "F");

    // Header band
    setFill(doc, theme.bannerBg);
    doc.rect(0, 0, W, 56, "F");
    setText(doc, theme.bannerInk);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(brand, M, 22);
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("FOLHA DE REGISTO", M, 38);
    setText(doc, theme.bannerInk);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(meta.client_name, W - M, 22, { align: "right" });
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Semana ${week.week_number}  ·  ${day.day_label || "Sessão"}  ·  ${day.focus || ""}`,
      W - M,
      38,
      { align: "right" },
    );

    setDraw(doc, theme.accent);
    doc.setLineWidth(2);
    doc.line(0, 56, W, 56);

    // Manual fill row: data, hora, RPE acordar, peso, sono
    let y = 72;
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const fields: Array<[string, number]> = [
      ["DATA", 80],
      ["INÍCIO", 50],
      ["FIM", 50],
      ["RPE ACORDAR", 60],
      ["PESO HOJE (kg)", 70],
      ["SONO (h)", 50],
    ];
    let fx = M;
    for (const [label, w] of fields) {
      doc.text(label, fx, y);
      setDraw(doc, theme.rule);
      doc.setLineWidth(0.5);
      doc.line(fx, y + 16, fx + w - 8, y + 16);
      fx += w;
    }
    y += 28;

    // Table header
    const exercises = day.exercises ?? [];
    const colNumW = 22;
    const colExW = 170;
    const colSetsW = 38;
    const colRepsW = 38;
    const colRpeW = 32;
    const colRestW = 38;
    const fixedW = colNumW + colExW + colSetsW + colRepsW + colRpeW + colRestW;
    const setsHeader = "REGISTO (escrever no ginásio)";
    const setsW = W - M * 2 - fixedW;

    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    let cx = M;
    doc.text("#", cx + 4, y); cx += colNumW;
    doc.text("EXERCÍCIO", cx, y); cx += colExW;
    doc.text("SETS", cx + colSetsW / 2, y, { align: "center" }); cx += colSetsW;
    doc.text("REPS", cx + colRepsW / 2, y, { align: "center" }); cx += colRepsW;
    doc.text("RPE", cx + colRpeW / 2, y, { align: "center" }); cx += colRpeW;
    doc.text("DESCANSO", cx + colRestW / 2, y, { align: "center" }); cx += colRestW;
    doc.text(setsHeader, cx + 4, y);

    y += 4;
    setDraw(doc, theme.rule);
    doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 8;

    const usableH = H - y - 60; // leave room for footer + notes block
    const rowsLeft = Math.max(1, Math.floor(usableH / 28) - 1);
    const exToRender = exercises.slice(0, rowsLeft);

    for (let i = 0; i < exToRender.length; i++) {
      const ex = exToRender[i];
      const rowTop = y;
      const rowH = 28;
      if (i % 2 === 1) {
        setFill(doc, theme.bgSubtle);
        doc.rect(M, rowTop, W - M * 2, rowH, "F");
      }
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      let xx = M;
      doc.text(String(i + 1).padStart(2, "0"), xx + 4, rowTop + 12); xx += colNumW;
      setText(doc, theme.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(fitText(ex.name, colExW - 4), xx, rowTop + 12); xx += colExW;
      // cue line under name
      const cue = (ex.cue || ex.technique_cues || ex.notes || "").toString().trim();
      if (cue) {
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(fitText(cue, colExW - 4), M + colNumW, rowTop + 22);
      }

      setText(doc, theme.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(String(ex.sets ?? "—"), xx + colSetsW / 2, rowTop + 12, { align: "center" }); xx += colSetsW;
      doc.text(String(ex.reps ?? "—"), xx + colRepsW / 2, rowTop + 12, { align: "center" }); xx += colRepsW;
      doc.text(String(ex.rpe ?? "—"), xx + colRpeW / 2, rowTop + 12, { align: "center" }); xx += colRpeW;
      doc.text(String(ex.rest ?? "—"), xx + colRestW / 2, rowTop + 12, { align: "center" }); xx += colRestW;

      // REGISTO blanks: build "S1: __×__ @__   S2: __×__ @__   S3: __×__ @__"
      const setsCount = Math.max(
        1,
        Math.min(6, parseInt(String(ex.sets ?? "").replace(/[^\d]/g, ""), 10) || 3),
      );
      const slotW = setsW / setsCount;
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      for (let s = 0; s < setsCount; s++) {
        const sx = xx + s * slotW + 4;
        doc.text(`S${s + 1}:`, sx, rowTop + 11);
        // reps blank
        setDraw(doc, theme.rule);
        doc.setLineWidth(0.4);
        doc.line(sx + 16, rowTop + 12, sx + 36, rowTop + 12);
        // × load blank
        doc.text("×", sx + 38, rowTop + 11);
        doc.line(sx + 44, rowTop + 12, sx + Math.max(70, slotW - 30), rowTop + 12);
        // @ rpe blank
        doc.text("@", sx + Math.max(72, slotW - 28), rowTop + 11);
        doc.line(
          sx + Math.max(80, slotW - 20),
          rowTop + 12,
          sx + slotW - 6,
          rowTop + 12,
        );
        // notes line beneath
        doc.line(sx, rowTop + 24, sx + slotW - 6, rowTop + 24);
      }

      y += rowH;
      setDraw(doc, theme.rule);
      doc.setLineWidth(0.2);
      doc.line(M, y, W - M, y);
    }

    if (exercises.length > exToRender.length) {
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text(
        `+ ${exercises.length - exToRender.length} exercício(s) não couberam nesta página — imprima também a folha de treino.`,
        M,
        y + 14,
      );
      y += 18;
    }

    // Notas livres
    y += 10;
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("NOTAS DA SESSÃO", M, y);
    y += 8;
    setDraw(doc, theme.rule);
    doc.setLineWidth(0.4);
    const notesBottom = H - 36;
    for (let ly = y + 12; ly < notesBottom; ly += 14) {
      doc.line(M, ly, W - M, ly);
    }

    // Footer
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      `${brand}  ·  ${branding.contact_email ?? ""}`,
      M,
      H - 18,
    );
    doc.text(`Página ${pageIdx}`, W - M, H - 18, { align: "right" });
  }

  doc.save(
    `${meta.client_name.replace(/\s+/g, "_")}_W${week.week_number}_logsheet.pdf`,
  );
}

// ===========================================================================
// Assessment report PDF — 2 pages max, brand-aware, locale-aware.
// ===========================================================================

type RenderAssessmentArgs = {
  assessment: any;
  client: { full_name?: string | null; email?: string | null } | null;
  t?: (key: string, opts?: any) => string;
};

function safe(v: unknown, fallback = "—"): string {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(typeof iso === "string" && iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "client";
}

export function renderAssessmentPdf({ assessment, client, t }: RenderAssessmentArgs) {
  const tr = (k: string, fb: string) => (t ? t(k, { defaultValue: fb }) : fb);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  const INK: [number, number, number] = [24, 24, 27];
  const MUTED: [number, number, number] = [113, 113, 122];
  const RULE: [number, number, number] = [228, 228, 231];
  const ACCENT: [number, number, number] = [217, 119, 6]; // amber-600

  let y = M;

  // ---------- Header ----------
  setText(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(tr("pdf.title", "Assessment Report"), M, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setText(doc, MUTED);
  const headerRight = `${tr("pdf.performed_on", "Performed on")}: ${fmtDate(assessment?.performed_on ?? assessment?.created_at)}`;
  doc.text(headerRight, W - M, y, { align: "right" });

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(doc, INK);
  doc.text(safe(client?.full_name, tr("pdf.client", "Client")), M, y);

  if (client?.email) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(doc, MUTED);
    doc.text(client.email, W - M, y, { align: "right" });
  }

  y += 8;
  setDraw(doc, ACCENT);
  doc.setLineWidth(1.2);
  doc.line(M, y, M + 36, y);
  y += 14;

  // ---------- Section helper ----------
  const sectionTitle = (label: string) => {
    if (y > H - 80) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(doc, MUTED);
    doc.text(label.toUpperCase(), M, y);
    y += 4;
    setDraw(doc, RULE);
    doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 10;
  };

  const kv = (rows: Array<[string, string]>, cols = 2) => {
    const colW = (W - M * 2) / cols;
    const rowH = 24;
    const perPage = Math.ceil(rows.length / cols);
    for (let i = 0; i < rows.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = M + col * colW;
      const ry = y + row * rowH;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setText(doc, MUTED);
      doc.text(rows[i][0].toUpperCase(), x, ry);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setText(doc, INK);
      const valLines = doc.splitTextToSize(rows[i][1], colW - 8);
      doc.text(valLines.slice(0, 1), x, ry + 11);
    }
    y += perPage * rowH + 6;
  };

  const paragraph = (text: string) => {
    if (!text || text === "—") return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setText(doc, INK);
    const lines = doc.splitTextToSize(text, W - M * 2);
    for (const line of lines) {
      if (y > H - 60) {
        doc.addPage();
        y = M;
      }
      doc.text(line, M, y);
      y += 12;
    }
    y += 4;
  };

  // ---------- Demographics & goals ----------
  sectionTitle(tr("pdf.section_overview", "Overview"));
  kv(
    [
      [tr("pdf.primary_goal", "Primary goal"), safe(assessment?.primary_goal)],
      [tr("pdf.experience", "Experience"), safe(assessment?.experience_level)],
      [tr("pdf.training_days", "Days/week"), safe(assessment?.training_days_per_week)],
      [tr("pdf.session_duration", "Session (min)"), safe(assessment?.session_duration_minutes)],
      [tr("pdf.location", "Location"), safe(assessment?.training_location)],
      [tr("pdf.years_training", "Years training"), safe(assessment?.years_training)],
    ],
    3,
  );

  // ---------- Readiness / risk ----------
  sectionTitle(tr("pdf.section_readiness", "Readiness & risk"));
  kv(
    [
      [tr("pdf.parq", "PAR-Q+"), assessment?.parq_passed === false ? tr("pdf.parq_flagged", "Flagged") : tr("pdf.parq_clear", "Cleared")],
      [tr("pdf.acsm_risk", "ACSM risk"), safe(assessment?.acsm_risk_category)],
      [tr("pdf.bp", "BP (mmHg)"), assessment?.systolic_bp_mmhg && assessment?.diastolic_bp_mmhg ? `${assessment.systolic_bp_mmhg}/${assessment.diastolic_bp_mmhg}` : "—"],
      [tr("pdf.rhr", "Resting HR"), safe(assessment?.resting_heart_rate)],
    ],
    4,
  );

  // ---------- Lifestyle ----------
  sectionTitle(tr("pdf.section_lifestyle", "Lifestyle"));
  kv(
    [
      [tr("pdf.sleep", "Sleep (1-10)"), safe(assessment?.sleep_quality)],
      [tr("pdf.stress", "Stress (1-10)"), safe(assessment?.stress_level)],
      [tr("pdf.hydration", "Water (glasses)"), safe(assessment?.hydration_glasses_per_day)],
      [tr("pdf.capacity_vs_pb", "Capacity vs PB"), safe(assessment?.current_capacity_vs_pb)],
    ],
    4,
  );

  // ---------- Movement screen ----------
  sectionTitle(tr("pdf.section_movement", "Movement screen (1-5)"));
  kv(
    [
      [tr("pdf.squat", "Squat depth"), safe(assessment?.squat_depth_score)],
      [tr("pdf.hinge", "Hip hinge"), safe(assessment?.hip_hinge_score)],
      [tr("pdf.overhead", "Overhead reach"), safe(assessment?.overhead_reach_score)],
      [tr("pdf.sl_balance", "Single-leg balance"), safe(assessment?.single_leg_balance_score)],
    ],
    4,
  );

  // ---------- Notes (only if present) ----------
  const notes: Array<[string, string]> = [
    [tr("pdf.injuries", "Injuries"), assessment?.injuries],
    [tr("pdf.medical", "Medical conditions"), assessment?.medical_conditions],
    [tr("pdf.preferences", "Preferences"), assessment?.preferences],
    [tr("pdf.imbalances", "Known imbalances"), assessment?.known_imbalances],
  ].filter(([, v]) => v && String(v).trim().length > 0) as Array<[string, string]>;

  if (notes.length > 0) {
    sectionTitle(tr("pdf.section_notes", "Notes"));
    for (const [label, value] of notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(doc, MUTED);
      if (y > H - 60) { doc.addPage(); y = M; }
      doc.text(label.toUpperCase(), M, y);
      y += 11;
      paragraph(String(value));
    }
  }

  // ---------- SMART goal ----------
  if (assessment?.smart_specific || assessment?.smart_measurable || assessment?.smart_deadline) {
    sectionTitle(tr("pdf.section_smart", "SMART goal"));
    kv(
      [
        [tr("pdf.smart_specific", "Specific"), safe(assessment?.smart_specific)],
        [tr("pdf.smart_measurable", "Measurable"), safe(assessment?.smart_measurable)],
        [tr("pdf.smart_deadline", "Deadline"), fmtDate(assessment?.smart_deadline)],
      ],
      3,
    );
  }

  // ---------- Footer ----------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(doc, MUTED);
    doc.text(
      tr("pdf.confidential", "Confidential — for trainer & client use only"),
      M,
      H - 22,
    );
    doc.text(`${i} / ${pageCount}`, W - M, H - 22, { align: "right" });
  }

  const datePart = (assessment?.performed_on ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const filename = `assessment-${slugify(client?.full_name ?? "client")}-${datePart}.pdf`;
  doc.save(filename);
}