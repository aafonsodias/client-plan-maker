// Server-only Repair module.
// Given the original day, the critic verdict, and the client context, ask the
// model to PATCH the day so every blocker/major issue is resolved while
// preserving everything the critic did not flag. Returns the new day.

import {
  buildClientContextBlock,
  buildSafetyBlock,
  SHARED_PROGRAM_RULES,
  SingleDayPlanSchema,
  type PlanAssessment,
  type PlanClient,
} from "./plan.server";
import {
  type AnthropicModelId,
  type CallTelemetry,
  makeTelemetry,
} from "./plan-cost.server";
import { anthropicCompatFetch } from "./anthropic-compat.server";
import type { CriticVerdict } from "./plan-critic.server";

export type RepairResult =
  | {
      ok: true;
      day: any;
      telemetry: CallTelemetry;
    }
  | { ok: false; error: string; telemetry: CallTelemetry };

export async function repairDay(args: {
  apiKey: string;
  model: AnthropicModelId;
  client: PlanClient;
  assessment: PlanAssessment;
  duration_weeks: number;
  week_number: number;
  day_number: number;
  days_per_week: number;
  day: any;
  verdict: CriticVerdict;
}): Promise<RepairResult> {
  const safetyBlock = buildSafetyBlock(args.assessment);

  const sys = `You are an expert strength coach REPAIRING a single training day. A senior reviewer has flagged specific issues. Fix EVERY blocker and major issue precisely. Preserve everything else — do not gratuitously rewrite parts that were not flagged.${safetyBlock}

${SHARED_PROGRAM_RULES}

REPAIR DOCTRINE:
- Apply the SUGGESTED FIX from each issue when reasonable. If the suggested fix violates a higher rule (safety, equipment), pick a better fix and explain in the exercise rationale.
- Keep the day's overall focus, structure, and muscle distribution unless an issue explicitly requires changing them.
- Re-validate the whole day mentally before emitting: every HARD RULE in SHARED_PROGRAM_RULES must hold.

Return ONLY structured JSON via the emit_workout_day tool — emit exactly one 'day' object with the same shape as the input.`;

  const issuesBlock = args.verdict.issues.length
    ? args.verdict.issues
        .map((i, idx) => `${idx + 1}. [${i.severity}] ${i.path}\n   issue: ${i.message}\n   suggested_fix: ${i.suggested_fix}`)
        .join("\n")
    : "(no issues — pass-through)";

  const userMsg =
    buildClientContextBlock(args.client, args.assessment, args.duration_weeks) +
    `\n\nREPAIR TARGET: week ${args.week_number} of ${args.duration_weeks}, day ${args.day_number} of ${args.days_per_week}.\n\nORIGINAL DAY (the draft to repair):\n${JSON.stringify(args.day, null, 2)}\n\nREVIEWER SUMMARY: ${args.verdict.summary}\n\nISSUES TO FIX:\n${issuesBlock}\n\nEmit the FULL REPAIRED day via emit_workout_day. Do not omit any section.`;

  const t0 = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": args.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: 8000,
        system: sys,
        messages: [{ role: "user", content: userMsg }],
        tools: [
          {
            name: "emit_workout_day",
            description: "Emit one repaired training day.",
            input_schema: SingleDayPlanSchema,
          },
        ],
        tool_choice: { type: "tool", name: "emit_workout_day" },
      }),
    });

    const elapsed = Date.now() - t0;
    if (!res.ok) {
      const t = await res.text();
      console.error("[repair] anthropic error", res.status, t.slice(0, 400));
      return {
        ok: false,
        error: `Repair call failed (${res.status})`,
        telemetry: makeTelemetry(args.model, "repair", null, elapsed, false, `${res.status}`),
      };
    }
    const json = await res.json();
    const usage = json?.usage;
    const toolUse = json?.content?.find((b: any) => b.type === "tool_use");
    const day = toolUse?.input?.day;
    if (!day) {
      return {
        ok: false,
        error: "Repair returned no day",
        telemetry: makeTelemetry(args.model, "repair", usage, elapsed, false, "no-day"),
      };
    }
    return { ok: true, day, telemetry: makeTelemetry(args.model, "repair", usage, elapsed, true) };
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error("[repair] threw", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      telemetry: makeTelemetry(args.model, "repair", null, elapsed, false, "threw"),
    };
  }
}