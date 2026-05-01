// Capacity thresholds — calibrated for general adult fitness baselines.
// Each function returns 0..1 (or null if no measurement provided).
// Adjust factors here when tuning for athletic populations.

import type { PatternId } from "./movement-criteria";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function squatCapacityScore(c: any): number | null {
  const reps = num(c?.reps_to_failure);
  const oneRm = num(c?.one_rm_kg);
  if (reps != null) return clamp01(reps / 30); // 30 BW reps ≈ 1.0
  if (oneRm != null) return clamp01((oneRm / 100) * 0.6); // 100kg ≈ 0.6 (intermediate)
  return null;
}

export function hingeCapacityScore(c: any): number | null {
  const kb = num(c?.kb_swings_60s);
  const rdl = num(c?.rdl_one_rm_kg);
  if (kb != null) return clamp01(kb / 40);
  if (rdl != null) return clamp01((rdl / 120) * 0.6);
  return null;
}

export function pushCapacityScore(c: any): number | null {
  const pu = num(c?.strict_pushups);
  const press = num(c?.shoulder_press_one_rm_kg);
  if (pu != null) return clamp01(pu / 30);
  if (press != null) return clamp01((press / 60) * 0.6);
  return null;
}

export function pullCapacityScore(c: any): number | null {
  const pups = num(c?.pullups);
  const hang = num(c?.dead_hang_seconds);
  if (pups != null) return clamp01(pups / 15);
  if (hang != null) return clamp01(hang / 60);
  return null;
}

export function carryCapacityScore(c: any): number | null {
  const load = num(c?.load_kg);
  const dist = num(c?.distance_m);
  if (load != null && dist != null) {
    const work = load * dist;
    return clamp01(work / 2400); // 60kg × 40m ≈ 1.0
  }
  return null;
}

export function lungeCapacityScore(c: any): number | null {
  const reps = num(c?.walking_lunge_reps_per_side);
  const bg = num(c?.bulgarian_one_rm_kg);
  if (reps != null) return clamp01(reps / 20);
  if (bg != null) return clamp01((bg / 50) * 0.6);
  return null;
}

export function capacityScore(pattern: PatternId, c: any): number | null {
  switch (pattern) {
    case "squat":
      return squatCapacityScore(c);
    case "hinge":
      return hingeCapacityScore(c);
    case "push":
      return pushCapacityScore(c);
    case "pull":
      return pullCapacityScore(c);
    case "carry":
      return carryCapacityScore(c);
    case "lunge":
      return lungeCapacityScore(c);
  }
}