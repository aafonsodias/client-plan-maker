import type { Exercise } from "@/lib/pdf";

export type ExerciseBlock = {
  group_id: string;
  kind: "single" | "superset" | "circuit" | "giant_set";
  rounds?: number;
  exercises: Array<Exercise & { group_order: number }>;
};

/**
 * Deterministic grouping inference.
 * Priority:
 *   1. Explicit `group_id` (R-mobile-logbook).
 *   2. Existing `superset_id` (legacy).
 *   3. Notes prefix "A1", "B2", "Circuit:", "Superset:".
 *   4. Fallback: each exercise = its own single-exercise block.
 */
export function groupExercises(exercises: Exercise[]): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = [];
  const indexById = new Map<string, number>();
  let autoCounter = 0;
  const nextAutoId = () => String.fromCharCode(65 + autoCounter++);

  const inferFromNotes = (
    ex: Exercise
  ): { id: string; kind: ExerciseBlock["kind"]; order: number } | null => {
    const haystack = `${ex.notes ?? ""} ${ex.cue ?? ""} ${ex.name ?? ""}`.trim();
    if (!haystack) return null;
    // "A1", "B2", "C3" prefix anywhere
    const m = haystack.match(/\b([A-H])\s?([1-6])\b/);
    if (m) {
      return { id: m[1], kind: "superset", order: Number(m[2]) };
    }
    if (/circuit/i.test(haystack)) {
      return { id: nextAutoId(), kind: "circuit", order: 1 };
    }
    if (/superset/i.test(haystack)) {
      return { id: nextAutoId(), kind: "superset", order: 1 };
    }
    return null;
  };

  for (const ex of exercises) {
    let id: string | null = ex.group_id ?? ex.superset_id ?? null;
    let kind: ExerciseBlock["kind"] = ex.group_kind ?? "superset";
    let order = ex.group_order ?? 0;

    if (!id) {
      const inferred = inferFromNotes(ex);
      if (inferred) {
        id = inferred.id;
        kind = inferred.kind;
        order = inferred.order;
      }
    }

    if (!id) {
      // Single-exercise block.
      const soloId = `__solo_${blocks.length}`;
      blocks.push({
        group_id: soloId,
        kind: "single",
        exercises: [{ ...ex, group_order: 1 }],
      });
      continue;
    }

    if (!indexById.has(id)) {
      indexById.set(id, blocks.length);
      blocks.push({
        group_id: id,
        kind,
        rounds: ex.group_rounds,
        exercises: [],
      });
    }
    const block = blocks[indexById.get(id)!];
    // Promote kind: explicit `circuit` wins over inferred `superset`.
    if (ex.group_kind && ex.group_kind !== "single") block.kind = ex.group_kind;
    if (ex.group_rounds && !block.rounds) block.rounds = ex.group_rounds;
    block.exercises.push({
      ...ex,
      group_order: order || block.exercises.length + 1,
    });
  }

  // Stabilise order inside each block.
  for (const b of blocks) {
    b.exercises.sort((a, c) => a.group_order - c.group_order);
    // A "superset" block with only one exercise collapses to "single".
    if (b.exercises.length === 1 && b.kind !== "circuit") b.kind = "single";
  }
  return blocks;
}

/** Human label for a block: "A", "B1+B2", "Circuit". */
export function blockLabel(block: ExerciseBlock, index: number): string {
  if (block.kind === "circuit" || block.kind === "giant_set") {
    return `${String.fromCharCode(65 + index)} · ${block.kind === "circuit" ? "Circuito" : "Giant set"}`;
  }
  if (block.kind === "single") {
    return String.fromCharCode(65 + index);
  }
  // superset
  const letter = String.fromCharCode(65 + index);
  return block.exercises.map((_, i) => `${letter}${i + 1}`).join("+");
}