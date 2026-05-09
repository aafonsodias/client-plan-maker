/**
 * Meds serialization helpers.
 *
 * The `medications` text column on the assessment is the canonical
 * human-readable representation. Chips toggle `med_flags` (canonical
 * strings like "Beta-blocker"); doses + free-form "Other" entries are
 * folded back into `medications` so PDFs / AI briefs / clinicians keep
 * a single readable string, no schema changes required.
 *
 * Format:
 *   "Beta-blocker (5 mg/dia); Statin; Outro: Vitamina D 2000UI"
 */

export interface OtherMed {
  name: string;
  dose: string;
}

export interface ParsedMeds {
  doses: Record<string, string>;
  others: OtherMed[];
}

const OTHER_PREFIX_RE = /^(?:Outro|Other)\s*:\s*/i;

export function parseMeds(medications: string | null | undefined): ParsedMeds {
  const doses: Record<string, string> = {};
  const others: OtherMed[] = [];
  const text = String(medications ?? "").trim();
  if (!text) return { doses, others };
  for (const raw of text.split(/;\s*/)) {
    const part = raw.trim();
    if (!part) continue;
    if (OTHER_PREFIX_RE.test(part)) {
      const body = part.replace(OTHER_PREFIX_RE, "").trim();
      // "Vitamina D 2000UI" → split last token as dose if it has digits
      const m = body.match(/^(.*?)(?:\s+([\d][^\s].*))?$/);
      if (m) {
        const name = (m[1] ?? body).trim();
        const dose = (m[2] ?? "").trim();
        if (name) others.push({ name, dose });
      }
      continue;
    }
    // "Beta-blocker (5 mg/dia)" or just "Statin"
    const m = part.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (m) {
      doses[m[1].trim()] = m[2].trim();
    } else {
      doses[part] = "";
    }
  }
  return { doses, others };
}

export function serializeMeds(
  flags: string[],
  doses: Record<string, string>,
  others: OtherMed[],
  otherLabel = "Outro",
): string {
  const parts: string[] = [];
  for (const flag of flags) {
    const dose = (doses[flag] ?? "").trim();
    parts.push(dose ? `${flag} (${dose})` : flag);
  }
  for (const o of others) {
    const name = o.name.trim();
    if (!name) continue;
    const dose = o.dose.trim();
    parts.push(`${otherLabel}: ${dose ? `${name} ${dose}` : name}`);
  }
  return parts.join("; ");
}