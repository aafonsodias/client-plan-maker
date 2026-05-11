import jsPDF from "jspdf";
import {
  FORM_CRITERIA,
  CAPACITY_FIELDS,
  PATTERN_IDS,
  PATTERN_LABELS_PT,
  type PatternId,
} from "@/lib/movement-criteria";

/**
 * Round 4 — Assessment Session Helper PDF.
 *
 * Deterministic, offline guide for completing the practical Assessment
 * Session (anthro, mobility, posture, screen, performance). Mirrors the
 * jsPDF style of `pdf-assessment-summary.ts` but does NOT share helpers
 * to keep Round 3 untouched. No AI, no server, no network.
 *
 * Hard cap: 4 pages. Text-only (no images, no SVGs).
 */

type Tt = (k: string, opts?: any) => string;

type Args = {
  assessment?: any;
  client?: any;
  trainer?: { full_name?: string | null; business_name?: string | null } | null;
  locale?: string;
  t: Tt;
};

const INK: [number, number, number] = [14, 17, 22];
const MUTED: [number, number, number] = [91, 100, 112];
const RULE: [number, number, number] = [229, 225, 216];
const SOFT_BG: [number, number, number] = [250, 247, 241];
const GOLD: [number, number, number] = [184, 134, 47];
const DANGER: [number, number, number] = [239, 68, 68];

function hex(c: [number, number, number]): string {
  return "#" + c.map((n) => n.toString(16).padStart(2, "0")).join("");
}

function safe(s: any, fb = "—"): string {
  if (s == null) return fb;
  const v = String(s).trim();
  return v === "" ? fb : v;
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

export async function generateAssessmentSessionHelperPDF(args: Args): Promise<void> {
  const { client, trainer, t } = args;
  const locale = args.locale ?? "pt-PT";
  const isPt = locale.toLowerCase().startsWith("pt");

  const tr = (k: string, fallback: string, opts?: any): string => {
    const out = t ? t(`assessment:${k}`, { defaultValue: fallback, ...(opts ?? {}) }) : fallback;
    return typeof out === "string" ? out : fallback;
  };

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;
  const contentW = pageW - M * 2;
  let y = M;

  function setFont(weight: "normal" | "bold", size: number, color: [number, number, number] = INK) {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
    doc.setTextColor(hex(color));
  }

  function ensureSpace(needed: number) {
    if (y + needed > pageH - 50) {
      doc.addPage();
      y = M;
    }
  }

  function sectionTitle(text: string) {
    ensureSpace(36);
    setFont("bold", 13, INK);
    doc.text(text, M, y);
    y += 5;
    doc.setDrawColor(hex(GOLD));
    doc.setLineWidth(1);
    doc.line(M, y, M + 28, y);
    y += 14;
  }

  function paragraph(text: string, size = 10, color: [number, number, number] = INK) {
    setFont("normal", size, color);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    ensureSpace(lines.length * (size + 2));
    doc.text(lines, M, y);
    y += lines.length * (size + 2);
  }

  function bulletLine(text: string, size = 9.5) {
    const lines = doc.splitTextToSize(text, contentW - 14) as string[];
    ensureSpace(lines.length * (size + 2) + 2);
    setFont("normal", size, INK);
    doc.text("•", M, y);
    doc.text(lines, M + 10, y);
    y += lines.length * (size + 2);
  }

  function checkboxLine(text: string, size = 10) {
    const lines = doc.splitTextToSize(text, contentW - 18) as string[];
    ensureSpace(lines.length * (size + 2) + 2);
    doc.setDrawColor(hex(MUTED));
    doc.setLineWidth(0.6);
    doc.rect(M, y - 8, 9, 9);
    setFont("normal", size, INK);
    doc.text(lines, M + 16, y);
    y += lines.length * (size + 2);
  }

  function writeInLine(label: string, lineWidth = contentW - 100) {
    ensureSpace(18);
    setFont("bold", 9, MUTED);
    doc.text(label.toUpperCase(), M, y);
    doc.setDrawColor(hex(RULE));
    doc.setLineWidth(0.6);
    doc.line(M + 96, y, M + 96 + lineWidth, y);
    y += 16;
  }

  // ───────── PAGE 1 — Session overview ─────────
  doc.setFillColor(hex(SOFT_BG));
  doc.rect(0, 0, pageW, 4, "F");

  setFont("bold", 9, GOLD);
  doc.text(tr("session_helper.brand", "PROTOCOL"), M, y);
  setFont("normal", 8.5, MUTED);
  doc.text(
    tr("session_helper.eyebrow", "Guia da sessão de avaliação · apoio à observação").toUpperCase(),
    M,
    y + 12,
  );
  setFont("normal", 9, MUTED);
  doc.text(fmtDate(new Date(), locale), pageW - M, y, { align: "right" });
  if (trainer?.business_name || trainer?.full_name) {
    doc.text(safe(trainer.business_name ?? trainer.full_name, ""), pageW - M, y + 12, { align: "right" });
  }
  y += 36;

  setFont("bold", 22, INK);
  doc.text(tr("session_helper.title", "Guia da Sessão de Avaliação"), M, y);
  y += 22;
  setFont("normal", 12, MUTED);
  doc.text(safe(client?.full_name, tr("session_helper.no_name", "Cliente")), M, y);
  y += 22;

  // Purpose
  paragraph(
    tr(
      "session_helper.purpose",
      "Apoia a observação prática durante a sessão presencial. Use como guia rápido offline; introduza os valores na app a seguir.",
    ),
    10,
    MUTED,
  );
  y += 6;

  // App-primary box
  const appBoxY = y;
  const appBoxText = tr(
    "session_helper.app_primary",
    "Use a aplicação como fonte principal. Use este PDF apenas como apoio e introduza os resultados na app depois.",
  );
  setFont("bold", 9.5, INK);
  const appLines = doc.splitTextToSize(appBoxText, contentW - 24) as string[];
  const appBoxH = 12 + appLines.length * 12 + 10;
  doc.setFillColor(255, 251, 240);
  doc.setDrawColor(hex(GOLD));
  doc.setLineWidth(0.8);
  doc.roundedRect(M, appBoxY - 4, contentW, appBoxH, 4, 4, "FD");
  doc.text(appLines, M + 12, appBoxY + 10);
  y = appBoxY + appBoxH + 12;

  // Equipment
  sectionTitle(tr("session_helper.equipment_title", "Material necessário"));
  const equipKeys = ["mirror", "tape", "space", "timer", "camera"];
  const equipFb: Record<string, string> = isPt
    ? {
        mirror: "Espelho",
        tape: "Fita métrica (se incluir antropometria)",
        space: "Cadeira / parede / ~2 m de chão livre",
        timer: "Cronómetro ou telemóvel",
        camera: "Câmara (opcional, para rever vídeo)",
      }
    : {
        mirror: "Mirror",
        tape: "Tape measure (if anthropometry is included)",
        space: "Chair / wall / ~2 m of free floor",
        timer: "Stopwatch or phone",
        camera: "Camera (optional, for video review)",
      };
  for (const k of equipKeys) {
    checkboxLine(tr(`session_helper.equipment.${k}`, equipFb[k]), 10);
  }
  y += 6;

  // Safety box (full)
  sectionTitle(tr("session_helper.safety_title", "Segurança — pare imediatamente se:"));
  const safetyItems = isPt
    ? [
        "Dor aguda ou a piorar (especialmente articular).",
        "Tonturas ou pré-síncope.",
        "Dor no peito ou pressão torácica.",
        "Falta de ar desproporcional ao esforço.",
        "Sintomas neurológicos (dormência, fraqueza, alterações de visão).",
        "Inchaço súbito ou agudo.",
        "Sintomas após trauma recente.",
      ]
    : [
        "Sharp or worsening pain (especially in joints).",
        "Dizziness or near-syncope.",
        "Chest pain or chest pressure.",
        "Shortness of breath disproportionate to the effort.",
        "Neurological symptoms (numbness, weakness, vision changes).",
        "Sudden or acute swelling.",
        "Symptoms following recent trauma.",
      ];
  const safetyKeys = ["pain", "dizzy", "chest", "breath", "neuro", "swelling", "trauma"];
  for (let i = 0; i < safetyKeys.length; i++) {
    bulletLine(tr(`session_helper.safety.${safetyKeys[i]}`, safetyItems[i]), 9.5);
  }
  y += 4;
  setFont("bold", 9.5, DANGER);
  const referLines = doc.splitTextToSize(
    tr(
      "session_helper.safety.refer",
      isPt
        ? "Procure avaliação clínica qualificada se os sintomas persistirem ou forem invulgares."
        : "Seek qualified clinical assessment if symptoms persist or are unfamiliar.",
    ),
    contentW,
  ) as string[];
  ensureSpace(referLines.length * 12 + 4);
  doc.text(referLines, M, y);
  y += referLines.length * 12 + 2;
  setFont("normal", 9, MUTED);
  const notDxLines = doc.splitTextToSize(
    tr(
      "session_helper.safety.not_diagnosis",
      isPt
        ? "Não constitui diagnóstico nem aptidão médica."
        : "Not a diagnosis or medical clearance.",
    ),
    contentW,
  ) as string[];
  doc.text(notDxLines, M, y);

  // ───────── PAGE 2 — Practical checklist ─────────
  doc.addPage();
  y = M;
  sectionTitle(tr("session_helper.checklist_title", "Checklist prático por secção"));

  const colX = [M, M + 110, M + 240, M + 360, M + 460];
  const colW = [108, 128, 118, 96, contentW - (M + 460 - M)];
  // header
  setFont("bold", 8.5, MUTED);
  const hdr = isPt
    ? ["Secção", "Observar", "Registar", "Pare / modifique se", "Campo na app"]
    : ["Section", "Observe", "Record", "Stop / modify if", "App field"];
  for (let i = 0; i < hdr.length; i++) doc.text(hdr[i].toUpperCase(), colX[i], y);
  y += 6;
  doc.setDrawColor(hex(RULE));
  doc.line(M, y, pageW - M, y);
  y += 12;

  type Row = { sec: string; obs: string; rec: string; stop: string; field: string };
  const rowsPt: Row[] = [
    {
      sec: "Antropometria",
      obs: "Cintura, anca, % gordura (se tiver método).",
      rec: "cm e % com 1 casa decimal.",
      stop: "Dor à palpação ou desconforto invulgar.",
      field: "anthro_block.*",
    },
    {
      sec: "Mobilidade",
      obs: "6 regiões: ombro, anca, tornozelo, torácica, punho, joelho.",
      rec: "Score 1–5 por região (ver cartões).",
      stop: "Dor aguda em qualquer amplitude.",
      field: "ext_mob_*",
    },
    {
      sec: "Postura",
      obs: "Postura em pé, assimetrias visíveis, lado dominante.",
      rec: "Notas curtas em texto.",
      stop: "Dor na posição neutra de pé.",
      field: "standing_posture_notes / known_imbalances / dominant_side",
    },
    {
      sec: "Avaliação de movimento",
      obs: "6 padrões: agachamento, hinge, push, pull, carry, lunge.",
      rec: "Critérios cumpridos (✓) + capacidade.",
      stop: "Compensação dolorosa ou perda de controlo.",
      field: "{padrão}_form_criteria / _capacity",
    },
    {
      sec: "Performance / cardio",
      obs: "FC repouso, Cooper ou Rockport (se aplicável).",
      rec: "bpm, distância (m) ou tempo (min:seg).",
      stop: "Sintomas cardiovasculares — ver pág. 1.",
      field: "resting_heart_rate / ext_cardio_test",
    },
  ];
  const rowsEn: Row[] = [
    {
      sec: "Anthropometry",
      obs: "Waist, hip, %BF (if a method is available).",
      rec: "cm and % with 1 decimal.",
      stop: "Tenderness on palpation or unusual discomfort.",
      field: "anthro_block.*",
    },
    {
      sec: "Mobility",
      obs: "6 regions: shoulder, hip, ankle, thoracic, wrist, knee.",
      rec: "Score 1–5 per region (see cards).",
      stop: "Sharp pain at any range.",
      field: "ext_mob_*",
    },
    {
      sec: "Posture",
      obs: "Standing posture, visible asymmetries, dominant side.",
      rec: "Short text notes.",
      stop: "Pain in a neutral standing position.",
      field: "standing_posture_notes / known_imbalances / dominant_side",
    },
    {
      sec: "Movement screen",
      obs: "6 patterns: squat, hinge, push, pull, carry, lunge.",
      rec: "Criteria met (✓) + capacity values.",
      stop: "Painful compensation or loss of control.",
      field: "{pattern}_form_criteria / _capacity",
    },
    {
      sec: "Performance / cardio",
      obs: "Resting HR, Cooper or Rockport (if applicable).",
      rec: "bpm, distance (m) or time (min:sec).",
      stop: "Cardiovascular symptoms — see page 1.",
      field: "resting_heart_rate / ext_cardio_test",
    },
  ];
  const rows = isPt ? rowsPt : rowsEn;

  for (const r of rows) {
    const cells = [r.sec, r.obs, r.rec, r.stop, r.field];
    setFont("normal", 8.5, INK);
    const wrapped = cells.map((txt, i) => doc.splitTextToSize(txt, colW[i] - 6) as string[]);
    const rowH = Math.max(...wrapped.map((w) => w.length)) * 11 + 6;
    ensureSpace(rowH + 4);
    setFont("bold", 9, INK);
    doc.text(wrapped[0], colX[0], y);
    setFont("normal", 8.5, INK);
    for (let i = 1; i < cells.length; i++) doc.text(wrapped[i], colX[i], y);
    y += rowH;
    doc.setDrawColor(hex(RULE));
    doc.line(M, y - 4, pageW - M, y - 4);
  }
  y += 6;
  paragraph(
    tr(
      "session_helper.checklist_note",
      isPt
        ? "Os cartões nas páginas seguintes detalham cada teste suportado pela aplicação."
        : "The cards on the next pages detail each test supported by the app.",
    ),
    9,
    MUTED,
  );

  // ───────── PAGE 3 — Anthro + Mobility + Posture cards ─────────
  doc.addPage();
  y = M;

  // Anthro
  sectionTitle(tr("anthro_block.title", isPt ? "Antropometria" : "Anthropometry"));
  writeInLine(tr("anthro_block.waist", isPt ? "Cintura (cm)" : "Waist (cm)"));
  setFont("normal", 8.5, MUTED);
  paragraph(
    tr(
      "anthro_block.measure_waist_instructions",
      "Mede no ponto mais estreito acima da anca, expira.",
    ),
    8.5,
    MUTED,
  );
  writeInLine(tr("anthro_block.hip", isPt ? "Anca (cm)" : "Hip (cm)"));
  paragraph(
    tr(
      "anthro_block.measure_hip_instructions",
      "Mede na parte mais larga das nádegas.",
    ),
    8.5,
    MUTED,
  );
  writeInLine(tr("anthro_block.bf_method", isPt ? "Método de % gordura" : "%BF method"));
  paragraph(
    tr(
      "anthro_block.bf_method_hint",
      isPt
        ? "Lipocalibrador, bioimpedância, DEXA, etc."
        : "Calipers, bioimpedance, DEXA, etc.",
    ),
    8.5,
    MUTED,
  );
  y += 6;

  // Mobility — 6 regions
  sectionTitle(tr("mobility_block.title", isPt ? "Mobilidade (1–5)" : "Mobility (1–5)"));
  const mobRegions: Array<{ key: string; labelKey: string; hintKey: string }> = [
    { key: "shoulder", labelKey: "mobility_block.shoulder", hintKey: "mobility_block.shoulder_hint" },
    { key: "hip", labelKey: "mobility_block.hip", hintKey: "mobility_block.hip_hint" },
    { key: "ankle", labelKey: "mobility_block.ankle", hintKey: "mobility_block.ankle_hint" },
    { key: "thoracic", labelKey: "mobility_block.thoracic", hintKey: "mobility_block.thoracic_hint" },
    { key: "wrist", labelKey: "mobility_block.wrist", hintKey: "mobility_block.wrist_hint" },
    { key: "knee", labelKey: "mobility_block.knee", hintKey: "mobility_block.knee_hint" },
  ];
  for (const r of mobRegions) {
    ensureSpace(40);
    setFont("bold", 10, INK);
    doc.text(tr(r.labelKey, r.key), M, y);
    // score boxes on the right
    const boxY = y - 8;
    const startX = pageW - M - 5 * 18;
    setFont("normal", 8, MUTED);
    for (let n = 1; n <= 5; n++) {
      doc.setDrawColor(hex(MUTED));
      doc.setLineWidth(0.5);
      doc.rect(startX + (n - 1) * 18, boxY, 14, 12);
      doc.text(String(n), startX + (n - 1) * 18 + 5, boxY + 9);
    }
    y += 8;
    setFont("normal", 8.5, MUTED);
    const hintLines = doc.splitTextToSize(tr(r.hintKey, ""), contentW - 5 * 18 - 18) as string[];
    if (hintLines.length && hintLines[0]) {
      doc.text(hintLines, M, y);
      y += hintLines.length * 10;
    } else {
      y += 4;
    }
    y += 4;
  }

  // Posture
  sectionTitle(tr("posture_block.title", isPt ? "Postura & alinhamento" : "Posture & alignment"));
  writeInLine(tr("posture_block.standing", isPt ? "Notas de postura em pé" : "Standing posture notes"));
  doc.setDrawColor(hex(RULE));
  doc.line(M, y, pageW - M, y);
  y += 16;
  writeInLine(tr("posture_block.imbalances", isPt ? "Desequilíbrios conhecidos" : "Known imbalances"));
  writeInLine(tr("posture_block.dominant", isPt ? "Lado dominante" : "Dominant side"));

  // ───────── PAGE 4 — Movement screen + Performance ─────────
  doc.addPage();
  y = M;
  sectionTitle(tr("screen_block.title", isPt ? "Avaliação de movimento" : "Movement screen"));
  setFont("normal", 8.5, MUTED);
  paragraph(
    tr(
      "session_helper.screen_intro",
      isPt
        ? "Marque os critérios cumpridos. Anote a capacidade observada nos espaços. Pare se houver dor."
        : "Tick the criteria met. Note the observed capacity in the spaces. Stop if there is pain.",
    ),
    8.5,
    MUTED,
  );
  y += 4;

  // 2-column grid for 6 patterns
  const colGap = 14;
  const cardW = (contentW - colGap) / 2;
  for (let pi = 0; pi < PATTERN_IDS.length; pi += 2) {
    const left = PATTERN_IDS[pi] as PatternId;
    const right = (PATTERN_IDS[pi + 1] as PatternId | undefined) ?? null;
    const startY = y;
    const renderCard = (pat: PatternId, x: number): number => {
      let cy = startY;
      setFont("bold", 10.5, INK);
      doc.text(PATTERN_LABELS_PT[pat], x + 8, cy + 4);
      cy += 14;
      setFont("normal", 8, INK);
      for (const c of FORM_CRITERIA[pat]) {
        const lines = doc.splitTextToSize(c.label_pt, cardW - 22) as string[];
        doc.setDrawColor(hex(MUTED));
        doc.setLineWidth(0.5);
        doc.rect(x + 8, cy - 6, 7, 7);
        doc.text(lines, x + 20, cy);
        cy += lines.length * 9 + 1;
      }
      cy += 2;
      setFont("bold", 7.5, MUTED);
      doc.text(isPt ? "CAPACIDADE" : "CAPACITY", x + 8, cy);
      cy += 8;
      setFont("normal", 8, INK);
      for (const cap of CAPACITY_FIELDS[pat]) {
        const labelLines = doc.splitTextToSize(cap.label_pt, cardW - 80) as string[];
        doc.text(labelLines, x + 8, cy);
        doc.setDrawColor(hex(RULE));
        doc.line(x + cardW - 70, cy, x + cardW - 8, cy);
        cy += Math.max(10, labelLines.length * 9);
      }
      cy += 4;
      return cy;
    };
    const lh = renderCard(left, M);
    const rh = right ? renderCard(right, M + cardW + colGap) : startY;
    const cardH = Math.max(lh, rh) - startY + 6;
    // border
    doc.setDrawColor(hex(RULE));
    doc.setLineWidth(0.5);
    doc.roundedRect(M, startY - 4, cardW, cardH, 3, 3, "S");
    if (right) doc.roundedRect(M + cardW + colGap, startY - 4, cardW, cardH, 3, 3, "S");
    y = startY + cardH + 8;
    ensureSpace(60);
  }

  // Performance card
  sectionTitle(tr("performance_block.title", isPt ? "Cardio & performance" : "Cardiovascular health"));
  setFont("bold", 10, INK);
  doc.text(tr("performance_block.rhr", isPt ? "FC repouso (bpm)" : "Resting HR (bpm)"), M, y);
  y += 12;
  paragraph(
    tr(
      "performance_block.rhr_help",
      isPt
        ? "Ao acordar, ainda na cama. Conte 60s no pulso ou pescoço. Idealmente média de 3 manhãs."
        : "First thing AM, still in bed. Count 60s at wrist or neck. Ideally average 3 mornings.",
    ),
    8.5,
    MUTED,
  );
  writeInLine(isPt ? "RHR (bpm)" : "RHR (bpm)");

  setFont("bold", 10, INK);
  doc.text(tr("performance_block.cooper", isPt ? "Cooper 12 min (m)" : "Cooper 12-min (m)"), M, y);
  y += 12;
  writeInLine(isPt ? "Distância (m)" : "Distance (m)");

  setFont("bold", 10, INK);
  doc.text(
    tr("performance_block.rockport", isPt ? "Rockport 1 milha (min:seg)" : "Rockport 1-mile (min:sec)"),
    M,
    y,
  );
  y += 12;
  paragraph(
    tr(
      "performance_block.rockport_protocol",
      isPt
        ? "Caminhe 1 milha (1.6 km) o mais rápido possível, sem correr. Meça pulso 15s × 4 imediatamente após."
        : "Walk 1 mile (1.6 km) as fast as possible without running. Measure pulse 15s × 4 immediately after.",
    ),
    8.5,
    MUTED,
  );
  writeInLine(isPt ? "Tempo (min:seg)" : "Time (min:sec)");
  writeInLine(tr("performance_block.rockport_hr", isPt ? "FC pós-caminhada (bpm)" : "Post-walk HR (bpm)"));

  setFont("normal", 8.5, MUTED);
  paragraph(
    tr(
      "session_helper.no_vo2",
      isPt
        ? "O cálculo de VO₂máx é feito automaticamente pela app — basta introduzir os valores."
        : "VO₂max is computed automatically by the app — just enter the raw values.",
    ),
    8.5,
    MUTED,
  );

  // ───────── Footer on every page ─────────
  const footerText = tr(
    "session_helper.footer",
    isPt
      ? "Apoio à observação de exercício — não é diagnóstico nem aptidão médica."
      : "Exercise observation support — not a diagnosis or medical clearance.",
  );
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(hex(RULE));
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 36, pageW - M, pageH - 36);
    setFont("normal", 7.5, MUTED);
    doc.text(footerText, M, pageH - 22);
    doc.text(
      tr("session_helper.footer_page", isPt ? "Pág. {{page}}/{{total}}" : "p. {{page}}/{{total}}", {
        page: i,
        total,
      }),
      pageW - M,
      pageH - 22,
      { align: "right" },
    );
  }

  const namePart = sanitiseFilenamePart(
    pickClientLabel(client, isPt ? "Cliente" : "Client"),
  );
  const datePart = new Date().toISOString().slice(0, 10);
  const fileBase = isPt ? "Guia_Sessao_Avaliacao" : "Assessment_Session_Helper";
  doc.save(`${fileBase}_${namePart}_${datePart}.pdf`);
}