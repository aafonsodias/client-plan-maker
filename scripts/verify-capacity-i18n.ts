#!/usr/bin/env -S bun
/**
 * Capacity i18n regression guard.
 * Verifies all `capacity.*` keys exist across en/pt/es/hi.
 * Run: `bun scripts/verify-capacity-i18n.ts`
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LOCALES = ["en", "pt", "es", "hi"] as const;
type Locale = (typeof LOCALES)[number];

const DOMAIN_SLUGS = [
  "cardiorespiratory", "muscular_strength", "muscular_endurance", "flexibility",
  "body_composition", "power", "balance", "coordination", "agility",
  "cognitive_motor", "movement_quality",
];
const DOMAIN_SUBKEYS = ["name", "short", "evidence"];

const MAP_KEYS = [
  "title", "subtitle", "completion", "empty_title", "empty_subtitle",
  "tier_health", "tier_skill", "tier_integrative",
  "tooltip_score", "tooltip_test", "tooltip_unmeasured", "measured_relative",
  "add_button", "sheet_title", "sheet_subtitle",
  "field_domain", "field_test", "field_test_other", "field_test_other_placeholder", "field_unit_placeholder",
  "entry_mode_raw", "entry_mode_normalized",
  "field_raw_value", "field_normalized_score", "field_normalized_help",
  "field_measured_at", "field_notes", "field_notes_help",
  "submit", "cancel", "toast_saved", "toast_error", "validation_value_required",
];

const TEST_SLUGS = [
  "cooper_12min", "rockport_walk", "step_test_3min", "vo2max_device",
  "1rm_squat", "1rm_bench", "1rm_deadlift", "5rm_estimated_squat", "5rm_estimated_bench", "handgrip",
  "pushups_max", "plank_hold", "wall_sit", "bodyweight_squats_60s",
  "sit_and_reach", "shoulder_flexion_rom", "hip_flexion_rom", "ankle_dorsiflexion_rom",
  "body_fat_percent", "waist_circumference", "waist_to_hip", "bmi",
  "vertical_jump", "broad_jump", "medicine_ball_throw", "5_bound",
  "single_leg_stance_eyes_open", "single_leg_stance_eyes_closed", "y_balance", "berg_balance_scale",
  "hand_eye_wall_toss", "agility_ladder_run", "single_leg_hop_test",
  "505_agility", "t_test", "pro_agility_5_10_5", "illinois_agility",
  "tug_dual_task", "walking_while_talking", "stroop_walk",
  "fms_total", "overhead_squat_assessment", "single_leg_squat_assessment", "sfma_total",
];

type AnyObj = Record<string, any>;

function load(locale: Locale): AnyObj {
  const path = resolve(process.cwd(), `src/i18n/locales/${locale}/common.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function get(obj: AnyObj, path: string[]): unknown {
  let cur: any = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== "object" || !(k in cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

function expectedKeys(): string[] {
  const keys: string[] = [];
  for (const slug of DOMAIN_SLUGS) for (const sub of DOMAIN_SUBKEYS) keys.push(`capacity.${slug}.${sub}`);
  for (const k of MAP_KEYS) keys.push(`capacity.map.${k}`);
  for (const slug of TEST_SLUGS) keys.push(`capacity.tests.${slug}`);
  return keys;
}

const PT_TU_PATTERNS = [/\btu\b/i, /\bteu\b/i, /\btua\b/i, /\bteus\b/i, /\btuas\b/i, /\bcontigo\b/i];

function main() {
  const data: Record<Locale, AnyObj> = {} as any;
  for (const l of LOCALES) data[l] = load(l);

  const expected = expectedKeys();
  const missing: Record<Locale, string[]> = { en: [], pt: [], es: [], hi: [] };
  const literalSlug: { locale: Locale; key: string; value: string }[] = [];
  const ptTu: { key: string; value: string; hit: string }[] = [];

  for (const key of expected) {
    const path = key.split(".");
    const slug = path[path.length - 1];
    for (const l of LOCALES) {
      const v = get(data[l], path);
      if (typeof v !== "string" || v.trim() === "") {
        missing[l].push(key);
      } else {
        if (v.trim() === slug) literalSlug.push({ locale: l, key, value: v });
        if (l === "pt") {
          for (const re of PT_TU_PATTERNS) {
            const m = v.match(re);
            if (m) { ptTu.push({ key, value: v, hit: m[0] }); break; }
          }
        }
      }
    }
  }

  // Drift: present in some locales, missing in others
  const drift: string[] = [];
  for (const key of expected) {
    const present = LOCALES.filter((l) => typeof get(data[l], key.split(".")) === "string");
    if (present.length > 0 && present.length < LOCALES.length) drift.push(key);
  }

  let ok = true;
  console.log("=== Capacity i18n verification ===");
  console.log(`Expected keys per locale: ${expected.length}`);
  for (const l of LOCALES) {
    if (missing[l].length) {
      ok = false;
      console.log(`\n[${l}] missing ${missing[l].length} keys:`);
      for (const k of missing[l]) console.log(`  - ${k}`);
    } else {
      console.log(`[${l}] ✓ complete`);
    }
  }
  if (drift.length) {
    ok = false;
    console.log(`\nDrift (present in some locales, missing in others): ${drift.length}`);
    for (const k of drift) console.log(`  - ${k}`);
  }
  if (literalSlug.length) {
    ok = false;
    console.log(`\nLiteral-slug values (translation === slug): ${literalSlug.length}`);
    for (const x of literalSlug) console.log(`  - [${x.locale}] ${x.key} = "${x.value}"`);
  }
  if (ptTu.length) {
    console.log(`\n[pt] WARNING — possible tu/você mix (${ptTu.length} hits, expected: você):`);
    for (const x of ptTu) console.log(`  - ${x.key} hit "${x.hit}" in: "${x.value}"`);
    // Warning only — don't fail the script on tone unless it's also missing.
  }

  if (ok) {
    console.log("\n✅ All keys present in all 4 locales");
    process.exit(0);
  } else {
    console.log("\n❌ Capacity i18n verification FAILED");
    process.exit(1);
  }
}

main();