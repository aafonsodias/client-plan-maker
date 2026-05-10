#!/usr/bin/env -S bun
/**
 * Round F1 — i18n regression guard for `injuries.*` keys.
 * Run: `bun scripts/verify-injuries-i18n.ts`
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { INJURY_LABELS } from "../src/lib/injury-labels";
import { BODY_ZONES } from "../src/components/BodyMap";

const LOCALES = ["en", "pt", "es", "hi"] as const;
type Locale = (typeof LOCALES)[number];

const TOP_KEYS = [
  "page_title", "page_subtitle", "view_front", "view_back",
  "registered_title", "empty_state",
  "medical_doc_question", "medical_doc_cta", "medical_doc_disabled_tooltip",
  "severity_label", "severity_hint",
  "label_label", "label_unknown", "notes_label", "notes_placeholder",
  "save_cta", "cancel_cta", "remove_cta", "edit_cta",
  "remove_confirm_title", "remove_confirm_body", "remove_confirm_yes",
  "no_label",
];

function get(obj: any, path: string[]): unknown {
  let cur: any = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== "object" || !(k in cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

function load(loc: Locale): any {
  return JSON.parse(readFileSync(resolve(process.cwd(), `src/i18n/locales/${loc}/common.json`), "utf8"));
}

function expectedKeys(): string[] {
  const k: string[] = [];
  for (const t of TOP_KEYS) k.push(`injuries.${t}`);
  for (const z of new Set(BODY_ZONES.map((b) => b.id))) k.push(`injuries.zone.${z}`);
  for (const l of INJURY_LABELS) {
    k.push(`injuries.lbl.${l.id}`);
    k.push(`injuries.note.${l.id}`);
  }
  return k;
}

function main() {
  const data: Record<Locale, any> = {} as any;
  for (const l of LOCALES) data[l] = load(l);

  const keys = expectedKeys();
  const missing: Record<Locale, string[]> = { en: [], pt: [], es: [], hi: [] };

  for (const key of keys) {
    const path = key.split(".");
    for (const l of LOCALES) {
      const v = get(data[l], path);
      if (typeof v !== "string" || v.trim() === "") missing[l].push(key);
    }
  }

  console.log(`=== Injuries i18n verification (${keys.length} keys × ${LOCALES.length} locales) ===`);
  let ok = true;
  for (const l of LOCALES) {
    if (missing[l].length) {
      ok = false;
      console.log(`\n[${l}] missing ${missing[l].length} keys:`);
      for (const k of missing[l]) console.log(`  - ${k}`);
    } else {
      console.log(`[${l}] ✓ complete`);
    }
  }
  process.exit(ok ? 0 : 1);
}

main();