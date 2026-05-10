import jsPDF from "jspdf";
import { weekTagFor } from "@/lib/macro-index";
import {
  computeAssessmentMissions,
  distributeMissionsAcrossDays,
  missionsRemainingScore,
} from "@/lib/assessment-missions";
import { PATTERN_IDS, PATTERN_LABELS_PT, formScore, type PatternId } from "@/lib/movement-criteria";

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
  block_number?: number | null;
  block_transition_summary?: string | null;
  /**
   * Optional capacity-gain rows summarising progress vs. the prior block.
   * Pass `computeCapacityGain(prior, current).rows` (filtered to rows with a
   * meaningful deltaPct). When omitted or empty, the section is skipped.
   */
  block_evolution?: Array<{
    label: string;
    priorAvgLoadKg: number | null;
    currentAvgLoadKg: number | null;
    deltaPct: number | null;
    verdict: "gain" | "flat" | "regression" | "unknown";
  }> | null;
  /**
   * If set, render ONLY this week (1-indexed) instead of every week in the plan.
   * The cover then shows a compact macro-index strip highlighting where this
   * week sits in the meso/macro. PTs print one week at a time and update on
   * weekends, so single-week is the default rendering mode.
   */
  week_number?: number | null;
  /** 0–100 — tonal richness chip on cover (R36 carry-over). */
  assessment_completion_pct?: number | null;
  /**
   * Round 63 — pass the raw assessment + client rows so the cover can render
   * "missões para chegar a 100/100" distributed across training days. Optional;
   * when omitted, the missions section is skipped silently.
   */
  assessment?: Record<string, any> | null;
  client?: Record<string, any> | null;
  training_days_per_week?: number | null;
  /** UI locale used for session labels ("Sessão N" vs "Session N"). Defaults to PT. */
  locale?: string | null;
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
  // PROTOCOL PDF spec §12: bg #FAF8F4, text #1A1A1A, accent #D4A574 ochre.
  // We deliberately keep accent = Protocol amber (#E8A547) instead of ochre
  // because amber is the brand token used everywhere else (BrandMark, chips,
  // toneChip warn). Diverging only in PDFs would break visual continuity.
  bg: [250, 248, 244],         // #FAF8F4 — spec
  bgSubtle: [244, 241, 234],
  ink: [26, 26, 26],           // #1A1A1A — spec
  inkMuted: [120, 118, 112],
  inkGhost: [232, 229, 222],
  rule: [220, 216, 208],
  accent: [232, 165, 71],      // Protocol amber (brand) — see note above
  bannerBg: [244, 241, 234],
  bannerInk: [26, 26, 26],
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
  planArg: PlanData,
  branding: PdfBranding,
) {
  // local mutable alias so we can substitute a filtered (single-week) view below
  let plan: PlanData = planArg;
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

  const brand = (branding.business_name || branding.full_name || "PROTOCOL").toUpperCase();

  // ---------- Weekly mode setup ----------
  // If meta.week_number is provided, filter plan.weeks down to just that week
  // for archetype/session rendering, but keep allWeeks for the macro-index strip.
  const allWeeks = plan.weeks ?? [];
  const totalWeeksInPlan = allWeeks.length;
  const selectedWeekN = meta.week_number ?? null;
  const renderWeeks = selectedWeekN
    ? allWeeks.filter((w) => w.week_number === selectedWeekN)
    : allWeeks;
  // Re-bind plan to a filtered version for the rest of the function so the
  // existing archetype loop just works without further changes.
  plan = { ...plan, weeks: renderWeeks };

  // Tag a week — shared with the on-screen MacroIndexStrip so PDF and app match.
  const weekTag = (wn: number, total: number): string => weekTagFor(wn, total);

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
    const blockLabel = meta.week_number
      ? `Bloco ${meta.block_number ?? 1} · Semana ${meta.week_number}`
      : null;
    const left = [branding.business_name, meta.client_name, blockLabel, branding.contact_email]
      .filter(Boolean)
      .join("  ·  ");
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
  // Normalize labels so every page reads "Day N · <Focus>" uniformly.
  // Fix common AI artefacts where focus comes back as "Week 1" (junk) and
  // day_label is missing or already includes "— Week X".
  const isWeekJunk = (s: string) => /^\s*(week|semana)\s*\d+\s*$/i.test(s.trim());
  const stripWeekSuffix = (s: string) =>
    s.replace(/\s*[—–-]\s*(week|semana)\s*\d+\s*$/i, "").trim();
  // Locale-aware session word + focus inference from movement patterns.
  const isPt = !meta.locale || /^pt/i.test(String(meta.locale));
  const sessionWord = isPt ? "Sessão" : "Session";
  const focusFromExercises = (d: Day): string => {
    const names = (d.exercises ?? []).slice(0, 4).map((e) => String(e.name || "").toLowerCase());
    const blob = names.join(" ");
    const has = (...kw: string[]) => kw.some((k) => blob.includes(k));
    const ptMap: Record<string, string> = {
      push: "Empurrar", pull: "Puxar", squat: "Agachamento",
      hinge: "Dobradiça de anca", fullbody: "Corpo inteiro", core: "Core e estabilidade",
    };
    const enMap: Record<string, string> = {
      push: "Push", pull: "Pull", squat: "Squat",
      hinge: "Hinge", fullbody: "Full body", core: "Core & stability",
    };
    const m = isPt ? ptMap : enMap;
    if (has("squat", "agacha", "lunge", "afundo", "leg press", "prensa")) return m.squat;
    if (has("deadlift", "rdl", "hinge", "good morning", "hip thrust", "levantamento")) return m.hinge;
    if (has("bench", "supino", "press", "push up", "flexão", "dip")) return m.push;
    if (has("row", "remada", "pull", "puxa", "chin", "lat ")) return m.pull;
    if (has("plank", "prancha", "carry", "ab ", "abdo", "core")) return m.core;
    return m.fullbody;
  };
  archetypes.forEach((arc, i) => {
    // Always normalise to "{Sessão|Session} N" — index = order in the week,
    // not the raw label string. Strips leftover "Day X — " prefixes from AI.
    arc.label = `${sessionWord} ${i + 1}`;
    // Focus: drop AI junk ("Week 1"), fallback to inferred movement pattern.
    let focus = stripWeekSuffix(arc.focus || "");
    if (!focus || isWeekJunk(focus) || /^session$|^sess(ã|a)o\s*de\s*treino$/i.test(focus)) {
      focus = focusFromExercises(arc.base);
    }
    // Trim runaway focuses so the page header keeps breathing room.
    if (focus.length > 48) focus = focus.slice(0, 45).trimEnd() + "…";
    arc.focus = focus;
  });
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
    doc.setFontSize(9);
    // Reserve a small right gutter so wrapped lines never bleed past the page.
    const sumWidth = W - M * 2 - 8;
    const allLines = doc.splitTextToSize(meta.summary, sumWidth) as string[];
    const maxLines = 4;
    const sumLines = allLines.slice(0, maxLines);
    if (allLines.length > maxLines && sumLines.length > 0) {
      sumLines[sumLines.length - 1] = (sumLines[sumLines.length - 1] || "").replace(/\s*\S{0,2}$/, "") + "…";
    }
    doc.text(sumLines, M, y);
    y += sumLines.length * 11 + 10;
  }

  // KPI strip — honest in weekly mode (this week only)
  const sessionsThisRender = (plan.weeks ?? []).reduce((acc, w) => acc + (w.days?.length ?? 0), 0);
  const exercisesThisRender = (plan.weeks ?? []).reduce(
    (a, w) => a + (w.days ?? []).reduce((b, d) => b + (d.exercises?.length ?? 0), 0), 0,
  );
  const totalMesoWeeks = meta.duration_weeks ?? totalWeeksInPlan ?? plan.weeks?.length ?? 0;
  const kpis: [string, string][] = selectedWeekN
    ? [
        ["BLOCK", `${meta.block_number ?? 1}`],
        ["WEEK", `${selectedWeekN} / ${totalMesoWeeks || "?"}`],
        ["SESSIONS", String(sessionsThisRender)],
        ["EXERCISES", String(exercisesThisRender)],
        ["ARCHETYPES", String(archetypes.length)],
      ]
    : [
        ["DURATION", `${totalMesoWeeks || plan.weeks?.length || 0} wk`],
        ["SESSIONS / WK", plan.weeks?.length ? String(Math.round(sessionsThisRender / plan.weeks.length)) : "0"],
        ["TOTAL SESSIONS", String(sessionsThisRender)],
        ["EXERCISES", String(exercisesThisRender)],
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

  // ---------- Honesty banner: only W1 generated but trainer asked for a later week ----------
  if (selectedWeekN && totalWeeksInPlan === 1 && selectedWeekN > 1) {
    const bannerH = 24;
    setFill(doc, theme.bgSubtle);
    doc.rect(M, y, W - M * 2, bannerH, "F");
    setDraw(doc, theme.accent);
    doc.setLineWidth(1);
    doc.line(M, y, M, y + bannerH);
    setText(doc, theme.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(
      `Mostrando Semana 1 — semanas seguintes ainda não geradas (pediu Semana ${selectedWeekN}).`,
      M + 10,
      y + 15,
    );
    y += bannerH + 12;
  }

  // ---------- Assessment richness chip ----------
  if (typeof meta.assessment_completion_pct === "number") {
    const pct = Math.max(0, Math.min(100, Math.round(meta.assessment_completion_pct)));
    const chipW = 220;
    const chipH = 22;
    setFill(doc, theme.bgSubtle);
    doc.rect(M, y, chipW, chipH, "F");
    // Tonal accent stripe
    let stripe: [number, number, number];
    if (pct >= 80) stripe = [16, 185, 129];      // emerald
    else if (pct >= 60) stripe = theme.accent;   // amber
    else stripe = [180, 180, 180];               // muted
    setFill(doc, stripe);
    doc.rect(M, y, 3, chipH, "F");
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("AVALIAÇÃO", M + 10, y + 9);
    setText(doc, theme.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${pct}%`, M + 10, y + 19);
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const today = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
    doc.text(`gerado ${today}`, M + chipW - 8, y + 14, { align: "right" });
    y += chipH + 14;
  }

  // ---------- Assessment missions ladder (Round 63) ----------
  if (meta.assessment || meta.client) {
    const missions = computeAssessmentMissions(meta.assessment, meta.client);
    if (missions.length > 0) {
      const dpw = Math.max(1, Math.min(7, meta.training_days_per_week ?? 3));
      const distributed = distributeMissionsAcrossDays(missions, dpw);
      const remaining = missionsRemainingScore(missions);
      const blockH = Math.min(120, 24 + Math.min(8, distributed.length) * 11);
      setFill(doc, theme.bgSubtle);
      doc.rect(M, y, W - M * 2, blockH, "F");
      setDraw(doc, theme.accent);
      doc.setLineWidth(1);
      doc.line(M, y, M, y + blockH);
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("MISSÕES PARA 100/100", M + 10, y + 10);
      setText(doc, theme.ink);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        `${remaining} pts em jogo · 1 missão por dia de treino (${dpw}/sem)`,
        M + 10,
        y + 20,
      );
      setText(doc, theme.ink);
      doc.setFontSize(8);
      let rowY = y + 32;
      const maxRows = Math.min(8, distributed.length);
      for (let i = 0; i < maxRows; i++) {
        const r = distributed[i];
        const text = `Dia ${r.dayIndex} · +${r.mission.impact}pt — ${r.mission.copy}`;
        doc.text(fitText(text, W - M * 2 - 24), M + 14, rowY);
        rowY += 11;
      }
      if (distributed.length > maxRows) {
        setText(doc, theme.inkMuted);
        doc.setFontSize(7);
        doc.text(`(+${distributed.length - maxRows} missões adicionais — pede ao teu PT)`, M + 14, rowY);
      }
      y += blockH + 12;
    }
  }

  // ---------- Block evolution (only when block_number > 1) ----------
  const blockN = meta.block_number ?? 1;
  const evoRows = (meta.block_evolution ?? []).filter((r) => r.deltaPct != null);
  if (blockN > 1 && (evoRows.length > 0 || meta.block_transition_summary)) {
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(`BLOCK ${blockN} · EVOLUTION VS BLOCK ${blockN - 1}`, M, y);
    y += 4;
    setDraw(doc, theme.rule);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 12;

    if (meta.block_transition_summary) {
      setText(doc, theme.ink);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(meta.block_transition_summary, W - M * 2).slice(0, 3) as string[];
      doc.text(lines, M, y);
      y += lines.length * 11 + 6;
    }

    if (evoRows.length > 0) {
      // Pattern · prior avg load · current avg load · Δ%
      const colX = [M, M + 180, M + 320, M + 460];
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text("PATTERN", colX[0], y);
      doc.text(`BLOCK ${blockN - 1} AVG`, colX[1], y);
      doc.text(`BLOCK ${blockN} AVG`, colX[2], y);
      doc.text("Δ %", colX[3], y);
      y += 4;
      setDraw(doc, theme.rule);
      doc.setLineWidth(0.2);
      doc.line(M, y, W - M, y);
      y += 10;
      const fmtKg = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} kg`);
      for (const r of evoRows.slice(0, 6)) {
        setText(doc, theme.ink);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(fitText(r.label, 170), colX[0], y);
        doc.setFont("helvetica", "normal");
        doc.text(fmtKg(r.priorAvgLoadKg), colX[1], y);
        doc.setFont("helvetica", "bold");
        doc.text(fmtKg(r.currentAvgLoadKg), colX[2], y);
        const sign = r.deltaPct! > 0 ? "+" : "";
        const deltaTxt = `${sign}${r.deltaPct!.toFixed(1)}%`;
        // Verdict colour (fall back to ink if theme has no accent variants)
        if (r.verdict === "gain") setText(doc, theme.accent);
        else if (r.verdict === "regression") setText(doc, theme.inkMuted);
        else setText(doc, theme.ink);
        doc.text(deltaTxt, colX[3], y);
        y += 13;
      }
      y += 4;
    }
  }

  // ---------- Macro index strip (weekly mode) ----------
  // Compact row of N chips, one per week of the meso, current week highlighted.
  // PT prints one week at a time and needs to know where this week sits in
  // the block at a glance.
  if (selectedWeekN && totalMesoWeeks > 0) {
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(`BLOCO ${meta.block_number ?? 1} · SEMANA ${selectedWeekN} DE ${totalMesoWeeks}`, M, y);
    y += 4;
    setDraw(doc, theme.rule);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 12;

    const stripW = W - M * 2;
    const gap = 6;
    const chipW = (stripW - gap * (totalMesoWeeks - 1)) / totalMesoWeeks;
    const chipH = 28;
    for (let i = 0; i < totalMesoWeeks; i++) {
      const wn = i + 1;
      const cx = M + i * (chipW + gap);
      const isCur = wn === selectedWeekN;
      if (isCur) {
        setFill(doc, theme.accent);
        doc.rect(cx, y, chipW, chipH, "F");
        setText(doc, theme.bg);
      } else {
        setFill(doc, theme.bgSubtle);
        doc.rect(cx, y, chipW, chipH, "F");
        setText(doc, theme.inkMuted);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(`W${wn}`, cx + chipW / 2, y + 11, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(weekTag(wn, totalMesoWeeks), cx + chipW / 2, y + 22, { align: "center" });
    }
    y += chipH + 14;

    // THIS WEEK session list (no cross-week deltas — those live in-app)
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("ESTA SEMANA", M, y);
    y += 4;
    setDraw(doc, theme.rule);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 12;
    for (const arc of archetypes) {
      if (y + 14 > H - M - 20) break;
      setText(doc, theme.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(fitText(arc.label, 160), M, y);
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(fitText(arc.focus || "—", W - M * 2 - 260), M + 170, y);
      const exCount = arc.base.exercises?.length ?? 0;
      setText(doc, theme.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${exCount} ex`, W - M, y, { align: "right" });
      y += 13;
    }
  } else {
    // Legacy multi-week glance (kept for back-compat; unused once weekly mode is default)
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("PLAN AT A GLANCE", M, y);
    y += 4;
    setDraw(doc, theme.rule);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 12;
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
    // Truncate the running header so a long focus phrase never bleeds onto the next page.
    // Truncate by measured width, not character count, so the running header
    // never bleeds past the right margin or onto a second line.
    const rawHeader = `${arc.label} · ${arc.focus || "Session"}`.toUpperCase();
    const headerMaxW = W - M * 2 - 60;
    const headerLine = fitText(rawHeader, headerMaxW);
    newPage(headerLine);

    // Session header — single row
    setText(doc, theme.inkMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(arc.label.toUpperCase(), M, y);
    setText(doc, theme.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    // Wrap the focus title across up to 2 lines instead of truncating with ellipsis.
    const focusTitleLines = doc.splitTextToSize(arc.focus || "Session", W - M * 2 - 200).slice(0, 2);
    for (let li = 0; li < focusTitleLines.length; li++) {
      doc.text(focusTitleLines[li], M, y + 18 + li * 18);
    }
    const focusTitleHeight = (focusTitleLines.length - 1) * 18;

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

    y += 24 + focusTitleHeight;
    setDraw(doc, theme.accent);
    doc.setLineWidth(2);
    doc.line(M, y, M + 40, y);
    doc.setLineWidth(0.5);
    y += 10;

    // PREP strip
    renderInlineStrip("PREP", collectPrep(arc.base));

    // ---- MAIN WORK table ----
    if (baseEx.length > 0) {
      // Column geometry — landscape A4 = 842pt wide, M=36 → 770pt usable.
      // We replace the per-week delta columns with 4 handwriting slots S1..S4
      // so the trainer reads and writes on the SAME row. Week-over-week
      // progressions are still visible in-app (Mesociclo view).
      // Re-balanced for honest hand-writing space (R47):
      // SETS/REPS/REST/RPE/TEMPO get just enough to render values without
      // truncation; the four S1..S4 handwriting slots widen to ~72pt each
      // (~2.5cm) so the trainer has room to write `80×6 @8`. Cue absorbs
      // remaining slack and wraps to up to 2 lines instead of ellipsis.
      const colNumW = 20;
      const colExW = 180;
      const statCols = ["SETS", "REPS", "REST", "RPE", "TEMPO"];
      const statColWs: number[] = [26, 38, 34, 28, 38]; // per-column widths
      const statTotal = statColWs.reduce((a, b) => a + b, 0);
      const slotsCount = 4;
      const slotColW = 72; // ~2.5cm — enough for `80×6 @8`
      const fixed = colNumW + colExW + statTotal + slotsCount * slotColW;
      const cueW = Math.max(100, (W - M * 2) - fixed);

      const xNum = M;
      const xEx = xNum + colNumW;
      const xCue = xEx + colExW;
      const xStat0 = xCue + cueW;
      const xSlot0 = xStat0 + statTotal;
      const statX = (i: number) => xStat0 + statColWs.slice(0, i).reduce((a, b) => a + b, 0);

      // Header — 2 lines so the S1 slot label can read "S1 / peso × reps @RPE"
      setText(doc, theme.inkMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text("#", xNum + 4, y);
      doc.text("EXERCISE", xEx, y);
      doc.text("CUE", xCue, y);
      for (let s = 0; s < statCols.length; s++) {
        doc.text(statCols[s], statX(s) + statColWs[s] / 2, y, { align: "center" });
      }
      for (let sI = 0; sI < slotsCount; sI++) {
        const sx = xSlot0 + sI * slotColW + 4;
        doc.text(`S${sI + 1}`, sx, y);
        doc.text("peso × reps @RPE", sx, y + 8);
      }
      y += 14;
      setDraw(doc, theme.rule);
      doc.setLineWidth(0.4);
      doc.line(M, y, W - M, y);
      y += 10;

      // Track superset groups for bracket post-pass
      type Bracket = { id: string; topY: number; botY: number };
      const brackets: Bracket[] = [];
      let openBracket: Bracket | null = null;

      for (let i = 0; i < baseEx.length; i++) {
        const ex = baseEx[i];

        // Pre-compute wrap so rowH is dynamic — avoids ellipsis on long cues
        // and 3-word exercise names. Cue is allowed up to 2 lines; name up to 2.
        let cueText = (ex.cue ?? "").trim();
        if (!cueText && ex.technique_cues) cueText = ex.technique_cues.trim();
        if (!cueText && ex.notes) cueText = ex.notes.trim();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const cueLines = cueText
          ? (doc.splitTextToSize(cueText, cueW - 6) as string[]).slice(0, 2)
          : [];
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        const nameLines = (doc.splitTextToSize(ex.name, colExW - 4) as string[]).slice(0, 2);
        const rowH = Math.max(18, nameLines.length * 11 + 6, cueLines.length * 11 + 6);

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

        // Name — already wrapped above
        setText(doc, theme.ink);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        for (let nli = 0; nli < nameLines.length; nli++) {
          doc.text(nameLines[nli], xEx, rowTop + 12 + nli * 11);
        }

        // Cue — wrap up to 2 lines, NEVER truncate with ellipsis
        if (cueLines.length > 0) {
          setText(doc, theme.inkMuted);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          for (let cli = 0; cli < cueLines.length; cli++) {
            doc.text(cueLines[cli], xCue, rowTop + 12 + cli * 11);
          }
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
          const cx = statX(s) + statColWs[s] / 2;
          setText(doc, hot ? theme.accent : theme.ink);
          doc.setFont("helvetica", "bold");
          // Use raw value (no fitText/ellipsis). If still too wide, shrink font.
          let fz = 9.5;
          doc.setFontSize(fz);
          while (doc.getTextWidth(val) > statColWs[s] - 4 && fz > 7) {
            fz -= 0.5;
            doc.setFontSize(fz);
          }
          doc.text(val, cx, rowTop + 12, { align: "center" });
        }

        // Handwriting slots S1..S4 — empty lines for the trainer to fill in the gym.
        setDraw(doc, theme.rule);
        doc.setLineWidth(0.4);
        for (let sI = 0; sI < slotsCount; sI++) {
          const sx = xSlot0 + sI * slotColW;
          doc.line(sx + 4, rowTop + 14, sx + slotColW - 6, rowTop + 14);
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

    // ---- SESSION META + OBSERVAÇÕES ----
    // Single compact strip for the trainer to scribble session-level info,
    // and 2 blank lines for free-form observations (joelho, sono, mudei ex.3, etc.)
    {
      const tableTopMin = y + 12;
      const remaining = H - 30 - tableTopMin;
      if (remaining > 50) {
        y += 8;
        setDraw(doc, theme.rule);
        doc.setLineWidth(0.3);
        doc.line(M, y, W - M, y);
        y += 10;

        const fields: Array<[string, number]> = [
          ["DATA", 90],
          ["INÍCIO", 60],
          ["FIM", 60],
          ["PESO (kg)", 70],
          ["SONO (h)", 60],
          ["RPE ACORDAR", 80],
        ];
        let fx = M;
        setText(doc, theme.inkMuted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        for (const [label, w] of fields) {
          doc.text(label, fx, y);
          setDraw(doc, theme.rule);
          doc.setLineWidth(0.5);
          doc.line(fx, y + 10, fx + w - 8, y + 10);
          fx += w;
        }
        y += 18;

        // OBSERVAÇÕES — 2 lines
        if (H - 30 - y > 32) {
          setText(doc, theme.inkMuted);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.text("OBSERVAÇÕES", M, y);
          y += 6;
          setDraw(doc, theme.rule);
          doc.setLineWidth(0.4);
          doc.line(M, y + 8, W - M, y + 8);
          doc.line(M, y + 22, W - M, y + 22);
          y += 28;
        }
      }
    }
  }

  // ---- Footers on every page ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  const weekSuffix = meta.week_number ? `_W${meta.week_number}` : "";
  doc.save(`${meta.client_name.replace(/\s+/g, "_")}_${meta.title.replace(/\s+/g, "_")}${weekSuffix}.pdf`);
}



// ===========================================================================
// Assessment report PDF — synthesis + programming impact, brand-aware,
// locale-aware. Replaces the old flat field dump.
// ===========================================================================

type RFAcc = { flag: string; strategy: string; detail?: string };
type ProgVars = {
  rpe_ceiling?: number;
  wave_model?: string;
  deload_frequency?: string;
  deload_style?: string;
  intensity_volume_tradeoff?: string;
  exercise_bias?: string;
  training_split?: string;
  cockpit_preset?: string;
  autoreg_strictness?: string;
};

type RenderAssessmentArgs = {
  assessment: any;
  client: { full_name?: string | null; email?: string | null } | null;
  plan?: {
    title?: string | null;
    programming_variables?: ProgVars | null;
    red_flag_accommodations?: RFAcc[] | null;
  } | null;
  sectionAnalyses?: Record<string, { summary?: string | null; red_flags?: string[] } | null>;
  t?: (key: string, opts?: any) => string;
};

function safe(v: unknown, fallback = "—"): string {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Sim" : "Não";
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

/** jsPDF helvetica core font is Latin-1 only; arrows/em-dashes/smart quotes
 *  render as garbled spaced characters (the "f r o m   c u r r e n t" bug).
 *  Strip non-Latin1 down to ASCII equivalents. */
function ascii(s: string): string {
  return String(s ?? "")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u2191/g, "up")
    .replace(/\u2193/g, "down")
    .replace(/\u2022/g, "*")
    .replace(/\u2026/g, "...")
    // keep accented Latin-1 (à, ã, é, ç, …) intact, drop everything else
    .replace(/[^\x00-\xFF]/g, "");
}

const ACSM_CAPTION: Record<string, string> = {
  low: "sem fatores de risco major — pode treinar com intensidade próxima do máximo",
  moderate: "1+ fator de risco — começar conservador, validar progresso bloco a bloco",
  high: "doença/sintoma cardiovascular — exigir clearance médico antes de carga elevada",
};

function recoveryProfile(a: any): { label: string; caption: string } | null {
  const sleep = a?.sleep_quality != null ? Number(a.sleep_quality) : null;
  const stress = a?.stress_level != null ? Number(a.stress_level) : null;
  if (sleep == null && stress == null) return null;
  let score = 0;
  let n = 0;
  if (sleep != null) { score += sleep; n++; }
  if (stress != null) { score += (10 - stress); n++; }
  const avg = n ? score / n : 0;
  const label = avg >= 7 ? "Alta" : avg >= 5 ? "Moderada" : "Baixa";
  const parts: string[] = [];
  if (sleep != null) parts.push(`sono ${sleep}/10`);
  if (stress != null) parts.push(`stress ${stress}/10`);
  return { label, caption: parts.join(" · ") };
}

function rpeReason(rpe: number, a: any): string {
  const sleep = a?.sleep_quality != null ? Number(a.sleep_quality) : null;
  const stress = a?.stress_level != null ? Number(a.stress_level) : null;
  if (rpe <= 7.5) {
    if (sleep != null && sleep <= 5) return "sono baixo limita intensidade segura";
    if (stress != null && stress >= 7) return "stress elevado limita intensidade segura";
    return "primeiro bloco — margem de segurança até validar adesão";
  }
  if (rpe >= 9) return "atleta tolera carga próxima do máximo";
  return "intensidade moderada-alta — equilíbrio típico de hipertrofia";
}

function waveReason(wave: string | undefined): string {
  switch (wave) {
    case "step": return "estabilizar antes de carga ondulada — ideal em remedial/iniciante";
    case "linear": return "progressão linear simples — ganho previsível em iniciantes";
    case "wave": return "onda clássica de Bompa — re-acumular após deload";
    case "undulating": return "intensidade varia entre sessões — manter frescura";
    case "block": return "blocos focados — máxima especificidade";
    default: return "modelo de progressão de carga semana a semana";
  }
}

function deloadReason(freq: string | undefined): string {
  if (!freq) return "—";
  if (freq.includes("3")) return "frequência alta — fadiga acumula rápido neste perfil";
  if (freq.includes("4")) return "cadência standard de re-acumulação para hipertrofia";
  if (freq.includes("5") || freq.includes("6")) return "atleta avançado tolera blocos longos";
  return "intervalo de re-acumulação programado";
}

function tradeoffReason(t: string | undefined): string {
  switch (t) {
    case "volume_leaning": return "prioriza volume — adequado a hipertrofia/recomp";
    case "intensity_leaning": return "prioriza carga — adequado a força máxima";
    case "balanced": return "equilíbrio entre volume e intensidade";
    default: return "—";
  }
}

const PATTERN_LABEL: Record<PatternId, string> = {
  squat: "Agachamento",
  hinge: "Hip hinge",
  push: "Empurrar",
  pull: "Puxar",
  lunge: "Avanço",
  rotation: "Rotação",
  carry: "Transporte",
};

const STRATEGY_COLOR: Record<string, [number, number, number]> = {
  AVOID: [220, 38, 38],       // red-600
  MODIFY: [217, 119, 6],      // amber-600
  MONITOR: [13, 148, 136],    // teal-600
  ACCOMMODATE: [113, 113, 122], // muted
};

export function renderAssessmentPdf({
  assessment,
  client,
  plan,
  sectionAnalyses,
  t,
}: RenderAssessmentArgs) {
  const tr = (k: string, fb: string) => (t ? t(k, { defaultValue: fb }) : fb);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  const INK: [number, number, number] = [24, 24, 27];
  const MUTED: [number, number, number] = [113, 113, 122];
  const RULE: [number, number, number] = [228, 228, 231];
  const ACCENT: [number, number, number] = [217, 119, 6];

  let y = M;
  const text = (s: string, x: number, yy: number, opts?: any) =>
    doc.text(ascii(s), x, yy, opts);

  const ensure = (need: number) => {
    if (y > H - need) { doc.addPage(); y = M; }
  };

  // ---------- Header ----------
  setText(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  text(tr("pdf.title", "Relatório de Avaliação"), M, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setText(doc, MUTED);
  text(`Realizada em: ${fmtDate(assessment?.performed_on ?? assessment?.created_at)}`, W - M, y, { align: "right" });

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(doc, INK);
  text(safe(client?.full_name, "Cliente"), M, y);

  if (client?.email) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(doc, MUTED);
    text(client.email, W - M, y, { align: "right" });
  }

  y += 8;
  setDraw(doc, ACCENT);
  doc.setLineWidth(1.2);
  doc.line(M, y, M + 36, y);
  y += 16;

  // ---------- Section title helper ----------
  const sectionTitle = (label: string) => {
    ensure(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(doc, MUTED);
    text(label.toUpperCase(), M, y);
    y += 4;
    setDraw(doc, RULE);
    doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 12;
  };

  // ---------- Tile (synthesis) ----------
  const tile = (
    x: number,
    width: number,
    label: string,
    value: string,
    caption: string,
    tone: [number, number, number] = INK,
  ) => {
    setFill(doc, [250, 250, 251]);
    doc.roundedRect(x, y, width, 56, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setText(doc, MUTED);
    text(label.toUpperCase(), x + 10, y + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    setText(doc, tone);
    text(value, x + 10, y + 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(doc, MUTED);
    const lines = doc.splitTextToSize(ascii(caption), width - 20).slice(0, 2);
    doc.text(lines, x + 10, y + 46);
  };

  // =========================================================================
  // PAGE 1 — SYNTHESIS
  // =========================================================================
  sectionTitle("Síntese");

  const acsm = String(assessment?.acsm_risk_category ?? assessment?.risk?.acsm_category ?? "").toLowerCase();
  const acsmLabel = acsm === "high" ? "Elevado" : acsm === "moderate" ? "Moderado" : acsm === "low" ? "Baixo" : "—";
  const acsmTone: [number, number, number] = acsm === "high" ? [220, 38, 38] : acsm === "moderate" ? [217, 119, 6] : acsm === "low" ? [16, 185, 129] : INK;
  const acsmCap = ACSM_CAPTION[acsm] ?? "classificação ACSM não disponível";

  const recovery = recoveryProfile(assessment);

  const bf = assessment?.body_fat_pct ? `${assessment.body_fat_pct}%` : "—";
  const whr = (() => {
    const w = Number(assessment?.waist_cm);
    const hp = Number(assessment?.hip_cm);
    if (!w || !hp) return null;
    return (w / hp).toFixed(2);
  })();
  const bodyVal = whr ? `${bf} · WHR ${whr}` : bf;
  const bodyCap = whr == null
    ? "circunferências não medidas"
    : Number(whr) >= 0.95 ? "WHR elevado — risco cardiometabólico"
    : Number(whr) >= 0.85 ? "WHR moderado — monitorizar"
    : "WHR saudável";

  const tileW = (W - M * 2 - 16) / 3;
  tile(M, tileW, "Risco ACSM", acsmLabel, acsmCap, acsmTone);
  tile(M + tileW + 8, tileW, "Recuperação", recovery?.label ?? "—", recovery?.caption ?? "sem dados de sono/stress");
  tile(M + (tileW + 8) * 2, tileW, "Composição", bodyVal, bodyCap);
  y += 56 + 14;

  // ---------- Movement screen readout ----------
  ensure(120);
  sectionTitle("Triagem de movimento");
  const colW = (W - M * 2) / 2;
  const rowH = 16;
  const visiblePatterns = PATTERN_IDS.filter((p) => {
    if (assessment?.screen_not_assessed?.[p]) return false;
    const fc = assessment?.[`${p}_form_criteria`];
    return !!fc;
  });
  if (visiblePatterns.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setText(doc, MUTED);
    text("Triagem de movimento ainda não realizada.", M, y);
    y += 16;
  } else {
    visiblePatterns.forEach((p, i) => {
      const fc = assessment[`${p}_form_criteria`];
      const score = formScore(fc);
      const cleared = score >= 3;
      const x = M + (i % 2) * colW;
      const ry = y + Math.floor(i / 2) * rowH;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setText(doc, INK);
      text(PATTERN_LABEL[p], x, ry);
      doc.setFont("helvetica", "bold");
      const tagX = x + colW - 90;
      setText(doc, MUTED);
      text(`${score}/5`, tagX, ry);
      setText(doc, cleared ? [16, 185, 129] : [217, 119, 6]);
      text(cleared ? "OK cleared" : "! rever", tagX + 30, ry);
    });
    y += Math.ceil(visiblePatterns.length / 2) * rowH + 8;
  }

  // ---------- Red flags ----------
  const accs: RFAcc[] = plan?.red_flag_accommodations ?? [];
  const flagsFromAnalyses = new Set<string>();
  for (const a of Object.values(sectionAnalyses ?? {})) {
    for (const f of a?.red_flags ?? []) flagsFromAnalyses.add(f);
  }
  const accMap = new Map(accs.map((a) => [a.flag, a]));
  const allFlags = Array.from(new Set([...accs.map((a) => a.flag), ...flagsFromAnalyses]));

  if (allFlags.length > 0) {
    ensure(60);
    sectionTitle("Sinais de alerta");
    const SEV: Record<string, number> = { AVOID: 0, MODIFY: 1, MONITOR: 2, ACCOMMODATE: 3 };
    allFlags.sort((a, b) => (SEV[accMap.get(a)?.strategy ?? ""] ?? 4) - (SEV[accMap.get(b)?.strategy ?? ""] ?? 4));
    for (const f of allFlags) {
      ensure(20);
      const acc = accMap.get(f);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setText(doc, INK);
      text(`• ${f}`, M, y);
      if (acc?.strategy) {
        const c = STRATEGY_COLOR[acc.strategy] ?? MUTED;
        const pillW = doc.getTextWidth(acc.strategy) + 14;
        setFill(doc, c);
        doc.roundedRect(W - M - pillW, y - 9, pillW, 13, 6, 6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        setText(doc, [255, 255, 255]);
        text(acc.strategy, W - M - pillW / 2, y, { align: "center" });
      }
      y += 14;
    }
    y += 6;
  }

  // =========================================================================
  // PAGE 2 — IMPACT ON PRESCRIPTION
  // =========================================================================
  doc.addPage();
  y = M;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setText(doc, INK);
  text("Impacto na prescrição", M, y);
  y += 6;
  setDraw(doc, ACCENT);
  doc.setLineWidth(1.2);
  doc.line(M, y, M + 36, y);
  y += 16;

  if (!plan?.programming_variables) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    setText(doc, MUTED);
    const lines = doc.splitTextToSize(
      "Plano ainda não gerado — assim que aprovar o briefing, esta secção mostra como cada decisão de programação se liga a esta avaliação.",
      W - M * 2,
    );
    doc.text(lines, M, y);
    y += lines.length * 13;
  } else {
    const pv = plan.programming_variables;
    sectionTitle("Variáveis programadas");
    const kvReason = (label: string, value: string, reason: string) => {
      ensure(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(doc, MUTED);
      text(label.toUpperCase(), M, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      setText(doc, INK);
      text(value, M + 160, y);
      y += 12;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      setText(doc, MUTED);
      const lines = doc.splitTextToSize(ascii(`porque ${reason}`), W - M * 2 - 160);
      doc.text(lines, M + 160, y);
      y += Math.max(12, lines.length * 11) + 4;
    };

    if (pv.rpe_ceiling != null) {
      kvReason("RPE máx", String(pv.rpe_ceiling), rpeReason(Number(pv.rpe_ceiling), assessment));
    }
    if (pv.wave_model) {
      kvReason("Modelo de onda", pv.wave_model, waveReason(pv.wave_model));
    }
    if (pv.deload_frequency) {
      kvReason("Deload", pv.deload_frequency, deloadReason(pv.deload_frequency));
    }
    if (pv.intensity_volume_tradeoff) {
      kvReason("Volume vs intensidade", pv.intensity_volume_tradeoff.replace(/_/g, " "), tradeoffReason(pv.intensity_volume_tradeoff));
    }
    if (pv.training_split) {
      kvReason("Divisão semanal", pv.training_split.replace(/_/g, " "), "estrutura semanal escolhida com base em dias/semana e local de treino");
    }

    // Per-flag accommodations
    if (accs.length > 0) {
      sectionTitle("Acomodações por sinal de alerta");
      for (const acc of accs) {
        ensure(36);
        const c = STRATEGY_COLOR[acc.strategy] ?? MUTED;
        // Pill on the left
        const pillW = doc.getTextWidth(acc.strategy) + 14;
        setFill(doc, c);
        doc.roundedRect(M, y - 9, pillW, 13, 6, 6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        setText(doc, [255, 255, 255]);
        text(acc.strategy, M + pillW / 2, y, { align: "center" });
        // Flag name to the right
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        setText(doc, INK);
        text(acc.flag, M + pillW + 8, y);
        y += 14;
        if (acc.detail) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          setText(doc, INK);
          const lines = doc.splitTextToSize(ascii(acc.detail), W - M * 2 - 12);
          for (const l of lines) {
            ensure(20);
            text(l, M + 12, y);
            y += 11;
          }
        }
        y += 6;
      }
    }
  }

  // ---------- SMART goal ----------
  if (assessment?.smart_specific || assessment?.smart_measurable || assessment?.smart_deadline) {
    ensure(60);
    sectionTitle("Objetivo SMART");
    const fields: Array<[string, string]> = [
      ["Específico", safe(assessment?.smart_specific)],
      ["Mensurável", safe(assessment?.smart_measurable)],
      ["Prazo", fmtDate(assessment?.smart_deadline)],
    ];
    for (const [label, value] of fields) {
      if (value === "—") continue;
      ensure(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(doc, MUTED);
      text(label.toUpperCase(), M, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setText(doc, INK);
      const lines = doc.splitTextToSize(ascii(value), W - M * 2 - 80);
      doc.text(lines, M + 80, y);
      y += Math.max(12, lines.length * 11) + 4;
    }
  }

  // =========================================================================
  // PAGE 3 — RAW DATA (only fields that have values)
  // =========================================================================
  const rawSections: Array<{ title: string; rows: Array<[string, string]> }> = [
    {
      title: "Visão geral",
      rows: [
        ["Objetivo", safe(assessment?.primary_goal)],
        ["Experiência", safe(assessment?.experience_level)],
        ["Dias/semana", safe(assessment?.training_days_per_week)],
        ["Sessão (min)", safe(assessment?.session_duration_minutes)],
        ["Local", safe(Array.isArray(assessment?.training_location) ? assessment.training_location.join(", ") : assessment?.training_location)],
        ["Anos a treinar", safe(assessment?.years_training)],
      ],
    },
    {
      title: "Prontidão e risco",
      rows: [
        ["PAR-Q+", assessment?.parq_passed === false ? "Sinalizado" : assessment?.parq_passed === true ? "Aprovado" : "—"],
        ["TA (mmHg)", assessment?.systolic_bp_mmhg && assessment?.diastolic_bp_mmhg ? `${assessment.systolic_bp_mmhg}/${assessment.diastolic_bp_mmhg}` : "—"],
        ["FC repouso", safe(assessment?.resting_heart_rate)],
      ],
    },
    {
      title: "Estilo de vida",
      rows: [
        ["Sono (1-10)", safe(assessment?.sleep_quality)],
        ["Stress (1-10)", safe(assessment?.stress_level)],
        ["Água (copos)", safe(assessment?.hydration_glasses_per_day)],
      ],
    },
  ];

  const filtered = rawSections
    .map((s) => ({ ...s, rows: s.rows.filter(([, v]) => v && v !== "—") }))
    .filter((s) => s.rows.length > 0);

  if (filtered.length > 0) {
    doc.addPage();
    y = M;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    setText(doc, INK);
    text("Dados brutos", M, y);
    y += 6;
    setDraw(doc, ACCENT);
    doc.setLineWidth(1.2);
    doc.line(M, y, M + 36, y);
    y += 16;

    for (const sec of filtered) {
      sectionTitle(sec.title);
      const cols = 3;
      const cw = (W - M * 2) / cols;
      const rh = 24;
      const perPage = Math.ceil(sec.rows.length / cols);
      for (let i = 0; i < sec.rows.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = M + col * cw;
        const ry = y + row * rh;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        setText(doc, MUTED);
        text(sec.rows[i][0].toUpperCase(), x, ry);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        setText(doc, INK);
        const valLines = doc.splitTextToSize(ascii(sec.rows[i][1]), cw - 8);
        doc.text(valLines.slice(0, 1), x, ry + 11);
      }
      y += perPage * rh + 6;
    }
  }

  // ---------- Footer ----------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(doc, MUTED);
    text("Confidencial — uso exclusivo do treinador e cliente", M, H - 22);
    text(`${i} / ${pageCount}`, W - M, H - 22, { align: "right" });
  }

  const datePart = (assessment?.performed_on ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const filename = `assessment-${slugify(client?.full_name ?? "client")}-${datePart}.pdf`;
  doc.save(filename);
}
