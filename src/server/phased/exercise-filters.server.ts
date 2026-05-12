/**
 * exercise-filters.server — assessment-driven exercise denylists.
 *
 * Why this exists: Stage 3 used to receive `assessment_injuries` only as a
 * flat string in `red_flags`. The model would sometimes still pick a
 * conventional deadlift for a low-back-pain client because the prompt was
 * "advisory" rather than structured. This module turns each injury row into
 * an explicit InjuryBan with a citation, separated from the tier bans so we
 * can audit (in `generation_log.injury_filters_applied`) exactly which rule
 * fired for which mesocycle.
 *
 * Scope (v1, intentional): 6 zones + 3 medical flags. New zones are added
 * iteratively as they appear in real plans. Each entry carries a citation
 * tag (ACSM 12e / NASM Essentials / Bompa 6e chapter) so we can defend the
 * decision later.
 */

export interface InjuryRow {
  body_zone: string | null;
  severity: number | null;
  injury_label?: string | null;
  /** Free-text note written by client/trainer in InjuryEditor — propagated to the prompt as context. */
  note?: string | null;
}

export interface InjuryBan {
  /** Lowercase exercise name fragment — matched by the validator and shown to the AI. */
  exercise: string;
  /** Why this is forbidden, in plain language (PT/EN agnostic). */
  reason: string;
  /** Citation tag for audit trail. */
  citation: string;
  /** Pattern alternative the AI should pick instead. */
  alternative?: string;
}

/**
 * Normalise the body_zone string. The picker emits e.g. `lumbar`,
 * `shoulder_left`, `knee_right`; we collapse left/right and group families.
 */
function zoneFamily(raw: string | null | undefined): string {
  const z = String(raw ?? "").toLowerCase();
  if (!z) return "";
  if (/lumbar|low_?back|lower_?back|sacrum/.test(z)) return "low_back";
  if (/cervical|neck/.test(z)) return "neck";
  if (/thoracic|upper_?back|scapula/.test(z)) return "upper_back";
  if (/shoulder|clavicle|ac_joint/.test(z)) return "shoulder";
  if (/knee/.test(z)) return "knee";
  if (/sternum|costo|^chest$|^pec/.test(z)) return "chest_wall";
  if (/hip|glute/.test(z)) return "hip";
  if (/wrist|hand/.test(z)) return "wrist";
  if (/elbow|forearm/.test(z)) return "elbow";
  if (/ankle|foot|achilles/.test(z)) return "ankle";
  return z;
}

/**
 * Per-zone bans. Severity is a 1–5 self-report scale; we trigger the heavier
 * bans only at ≥3 (moderate or worse) so a "1/5 niggle" doesn't strip the
 * trainer's options. ≥4 = "severe" → adds extra restrictions.
 */
function bansForZone(zone: string, severity: number): InjuryBan[] {
  if (severity < 2) return []; // 1 = trace pain, no programming change
  switch (zone) {
    case "low_back":
      return [
        ...(severity >= 3
          ? [
              { exercise: "conventional deadlift", alternative: "trap-bar deadlift or cable pull-through", reason: "Lumbar shear under sagittal axial load aggravates flexion-intolerant low-back pain.", citation: "ACSM 12e Ch.7" },
              { exercise: "good morning", alternative: "cable pull-through, supported hip thrust", reason: "Heavy spinal flexion under load.", citation: "NASM Essentials Ch.13" },
              { exercise: "jefferson curl", alternative: "supported hip hinge, RDL with neutral spine", reason: "Loaded spinal flexion contraindicated for symptomatic low-back.", citation: "ACSM 12e Ch.7" },
              { exercise: "behind-neck press", alternative: "neutral-grip overhead, landmine press", reason: "Excessive lumbar extension to clear the bar.", citation: "NASM Essentials Ch.13" },
            ]
          : []),
        ...(severity >= 4
          ? [
              { exercise: "barbell back squat", alternative: "goblet squat, leg press, belt squat", reason: "Severe low-back pain — remove axial spinal loading entirely.", citation: "ACSM 12e Ch.7" },
              { exercise: "barbell row", alternative: "chest-supported row, seated cable row", reason: "Bent-over loaded spine in pain client.", citation: "NASM Essentials Ch.13" },
            ]
          : []),
      ];
    case "knee":
      return [
        ...(severity >= 3
          ? [
              { exercise: "deep box jump", alternative: "low step-up, sled push", reason: "Eccentric impact loads patellofemoral joint beyond pain-free ROM.", citation: "ACSM 12e Ch.7" },
              { exercise: "depth jump", alternative: "tempo squat, sled drag", reason: "Plyometric impact contraindicated until pain ≤2/10.", citation: "Bompa 6e Ch.10" },
              { exercise: "pistol squat", alternative: "split squat, supported single-leg squat to box", reason: "Closed-chain extreme knee flexion under bodyweight.", citation: "NASM Essentials Ch.13" },
              { exercise: "jump lunge", alternative: "reverse lunge, walking lunge", reason: "Plyometric step-down on symptomatic knee.", citation: "Bompa 6e Ch.10" },
              { exercise: "sissy squat", alternative: "leg extension (light), Spanish squat (band)", reason: "Extreme patellofemoral compression.", citation: "NASM Essentials Ch.13" },
            ]
          : []),
        ...(severity >= 4
          ? [
              { exercise: "barbell back squat", alternative: "leg press, hack squat with limited ROM", reason: "Severe knee pain — limit ROM and offload axial.", citation: "ACSM 12e Ch.7" },
            ]
          : []),
      ];
    case "shoulder":
      return [
        ...(severity >= 2
          ? [
              { exercise: "upright row", alternative: "DB lateral raise (thumb-up), face pull", reason: "Internally-rotated abduction provokes subacromial impingement.", citation: "NASM Essentials Ch.13" },
              { exercise: "behind-neck press", alternative: "neutral-grip DB press, landmine press", reason: "Forced external rotation at end-range overhead irritates rotator cuff.", citation: "ACSM 12e Ch.7" },
              { exercise: "kipping pull-up", alternative: "scap pull-up, ring row, lat pulldown", reason: "Ballistic shoulder distraction in symptomatic glenohumeral joint.", citation: "NASM Essentials Ch.13" },
            ]
          : []),
        ...(severity >= 3
          ? [
              { exercise: "barbell overhead press", alternative: "landmine press, neutral-grip DB press", reason: "Forced bar path in flexion+IR aggravates impingement.", citation: "NASM Essentials Ch.13" },
              { exercise: "bench press wide grip", alternative: "neutral-grip DB press, push-up", reason: "Wide grip extends humerus past plane of scapula in compromised cuff.", citation: "ACSM 12e Ch.7" },
            ]
          : []),
      ];
    case "neck":
      return [
        ...(severity >= 2
          ? [
              { exercise: "behind-neck press", alternative: "neutral-grip overhead, landmine press", reason: "Cervical extension to clear the bar.", citation: "NASM Essentials Ch.13" },
              { exercise: "weighted sit-up", alternative: "dead-bug, hollow hold", reason: "Cervical flexion under load.", citation: "NASM Essentials Ch.13" },
              { exercise: "barbell shrug heavy", alternative: "DB shrug light, scapular wall slide", reason: "Heavy upper-trap loading provokes cervical referred pain.", citation: "NASM Essentials Ch.13" },
            ]
          : []),
      ];
    case "hip":
      return [
        ...(severity >= 3
          ? [
              { exercise: "deep ATG squat", alternative: "box squat to parallel, goblet squat", reason: "End-range hip flexion provokes anterior impingement.", citation: "NASM Essentials Ch.13" },
              { exercise: "jefferson curl", alternative: "RDL neutral spine", reason: "Combined hip flexion + spinal flexion.", citation: "ACSM 12e Ch.7" },
              { exercise: "sumo deadlift", alternative: "trap-bar or conventional with neutral stance", reason: "Wide stance forces hip external rotation at end range.", citation: "Bompa 6e Ch.7" },
            ]
          : []),
      ];
    case "wrist":
      return [
        ...(severity >= 2
          ? [
              { exercise: "front rack", alternative: "cross-arm rack, straps, safety-bar squat", reason: "Front-rack hyperextension irritates symptomatic wrist.", citation: "NASM Essentials Ch.13" },
              { exercise: "handstand push-up", alternative: "pike push-up on box, machine overhead", reason: "Full bodyweight wrist extension under load.", citation: "NASM Essentials Ch.13" },
              { exercise: "barbell clean", alternative: "DB clean, kettlebell clean to rack", reason: "Catch position forces wrist hyperextension.", citation: "Bompa 6e Ch.7" },
            ]
          : []),
      ];
    case "elbow":
      return [
        ...(severity >= 2
          ? [
              { exercise: "barbell curl heavy", alternative: "neutral-grip DB hammer curl, cable rope curl", reason: "Supinated grip under load aggravates lateral/medial epicondylitis.", citation: "NASM Essentials Ch.13" },
              { exercise: "skullcrusher", alternative: "rope tricep pushdown, cable kickback", reason: "EZ-bar elbow flexion under load irritates inflamed tendons.", citation: "NASM Essentials Ch.13" },
              { exercise: "chin-up", alternative: "lat pulldown neutral grip, ring row", reason: "Bodyweight on supinated grip loads medial epicondyle.", citation: "ACSM 12e Ch.7" },
            ]
          : []),
      ];
    case "chest_wall":
      return [
        ...(severity >= 2
          ? [
              { exercise: "pec deck", alternative: "DB chest press neutral, cable press at chest height", reason: "End-range horizontal abduction stresses costo-chondral junctions.", citation: "NASM Essentials Ch.13" },
              { exercise: "wide-grip bench press", alternative: "neutral-grip DB press, push-up", reason: "Wide grip extends humerus past plane of scapula and loads sternum.", citation: "ACSM 12e Ch.7" },
              { exercise: "deep dip", alternative: "bench dip with feet on floor, machine dip with limited ROM", reason: "End-range shoulder extension provokes anterior chest-wall pain.", citation: "NASM Essentials Ch.13" },
            ]
          : []),
      ];
    default:
      return [];
  }
}

/**
 * Medical flags piggy-back on `red_flags` (free-text) so we substring-match.
 * Only the most-cited contraindications go in v1.
 */
function bansForMedicalFlags(redFlags: string[]): InjuryBan[] {
  const joined = redFlags.join(" | ").toLowerCase();
  const out: InjuryBan[] = [];
  if (/hypertens|hipertens|high\s*bp|press[aã]o\s+alta/.test(joined)) {
    out.push(
      { exercise: "1RM test", alternative: "AMRAP at RPE 8 with 3RM cap", reason: "Maximal Valsalva spikes systolic BP — contraindicated in hypertensive client.", citation: "ACSM 12e Ch.5" },
      { exercise: "inverted row heavy", alternative: "chest-supported row upright", reason: "Inverted positions raise intrathoracic pressure.", citation: "ACSM 12e Ch.5" },
      { exercise: "handstand push-up", alternative: "pike push-up on box", reason: "Inverted loading raises BP acutely.", citation: "ACSM 12e Ch.5" },
    );
  }
  if (/pregnan|grav[ií]da|gestaç[aã]o|gestac/.test(joined)) {
    out.push(
      { exercise: "supine bench press", alternative: "incline DB press 30°+", reason: "Supine after T2 reduces venous return (vena cava compression).", citation: "ACSM 12e Ch.7" },
      { exercise: "prone press", alternative: "side-lying or quadruped variant", reason: "Prone position uncomfortable / unsafe with growing abdomen.", citation: "ACSM 12e Ch.7" },
      { exercise: "valsalva", alternative: "exhale on exertion, RPE 7 cap", reason: "Breath-holding raises intra-abdominal pressure.", citation: "ACSM 12e Ch.7" },
    );
  }
  if (/recent\s*surger|p[oó]s[\s-]*operat|surgery|cirurgi/.test(joined)) {
    out.push(
      { exercise: "barbell back squat", alternative: "leg press, goblet squat", reason: "Avoid maximal compound load < 12 weeks post-surgery (assumed lower-body unless noted).", citation: "NASM Essentials Ch.13" },
      { exercise: "conventional deadlift", alternative: "trap-bar deadlift to blocks", reason: "Avoid maximal axial load in early post-surgical reconditioning.", citation: "ACSM 12e Ch.7" },
    );
  }
  return out;
}

/**
 * Build the full injury-driven ban list from raw rows + brief red_flags.
 * Deduped by `exercise`. The first reason wins.
 */
export function deriveInjuryBans(
  injuries: InjuryRow[] | null | undefined,
  redFlags: string[] | null | undefined,
): InjuryBan[] {
  const all: InjuryBan[] = [];
  for (const row of injuries ?? []) {
    const family = zoneFamily(row?.body_zone);
    const sev = typeof row?.severity === "number" ? row.severity : 0;
    if (!family) continue;
    all.push(...bansForZone(family, sev));
  }
  all.push(...bansForMedicalFlags(redFlags ?? []));
  // Dedup by exercise key.
  const seen = new Set<string>();
  const out: InjuryBan[] = [];
  for (const b of all) {
    const key = b.exercise.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

/**
 * Render the bans as a self-contained prompt block. Kept separate from the
 * tier bans so the AI sees two distinct sources of truth and we can audit
 * which one fired in `generation_log.injury_filters_applied`.
 */
export function injuryBansPromptBlock(bans: InjuryBan[]): string {
  if (!bans.length) return "";
  const lines = bans
    .map((b) => `- DO NOT program "${b.exercise}" — ${b.reason} Use instead: ${b.alternative ?? "an equivalent same-pattern variant"}. [${b.citation}]`)
    .join("\n");
  return `\n\nINJURY-DRIVEN EXERCISE BANS (HARD — derived from this client's assessment):\n${lines}\n\nIf you are tempted to pick a banned exercise because it best fits the archetype, ALWAYS substitute with the alternative shown. The ban is non-negotiable.`;
}

/**
 * Render free-text injury notes (the "other injuries" field that the client
 * wrote in InjuryEditor) as a soft-context block. Unlike `injuryBansPromptBlock`,
 * notes do NOT trigger automatic substitutions — they are extra context for the
 * AI to read literally and adapt around when planning.
 */
export function injuryNotesPromptBlock(rows: InjuryRow[] | null | undefined): string {
  const items: string[] = [];
  for (const r of rows ?? []) {
    const note = (r?.note ?? "").trim();
    if (!note) continue;
    const zone = (r?.body_zone ?? "unknown").trim();
    const sev = typeof r?.severity === "number" ? r.severity : "?";
    const label = r?.injury_label ? ` (${r.injury_label})` : "";
    items.push(`- ${zone}${label} severity ${sev}/5: "${note.replace(/"/g, "'")}"`);
  }
  if (!items.length) return "";
  return `\n\nCLIENT-REPORTED INJURY CONTEXT (free-text — read literally, adapt programming to avoid aggravating these specific complaints):\n${items.join("\n")}`;
}

/**
 * Substring-match validator — used by Stage 3 retry loop. Returns the names of
 * exercises in the generated day that violate any ban.
 */
export function findBannedExercisesInDay(
  day: { exercises?: Array<{ name?: string }> } | null | undefined,
  bans: InjuryBan[],
): Array<{ name: string; ban: InjuryBan }> {
  if (!day || !Array.isArray(day.exercises)) return [];
  const out: Array<{ name: string; ban: InjuryBan }> = [];
  for (const ex of day.exercises) {
    const name = String(ex?.name ?? "").toLowerCase();
    if (!name) continue;
    for (const ban of bans) {
      if (name.includes(ban.exercise.toLowerCase())) {
        out.push({ name: ex.name ?? "", ban });
        break;
      }
    }
  }
  return out;
}
