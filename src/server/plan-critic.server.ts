// Server-only Critic module.
// Uses Claude (Haiku by default) to judge a generated training day against
// the SHARED_PROGRAM_RULES + clinical/safety context. Emits a structured
// verdict via tool_use so callers can decide whether to repair / escalate.

import {
  buildClientContextBlock,
  buildSafetyBlock,
  type PlanAssessment,
  type PlanClient,
} from "./plan.server";
import {
  type AnthropicModelId,
  type CallTelemetry,
  makeTelemetry,
} from "./plan-cost.server";
import { anthropicCompatFetch } from "./anthropic-compat.server";

export type CriticIssue = {
  severity: "blocker" | "major" | "minor";
  path: string; // e.g. "exercises[2].rationale" or "session"
  message: string;
  suggested_fix: string;
};

export type CriticVerdict = {
  verdict: "pass" | "needs_repair" | "fail";
  summary: string;
  issues: CriticIssue[];
};

export type CriticResult =
  | {
      ok: true;
      verdict: CriticVerdict;
      telemetry: CallTelemetry;
      programmatic_warnings: string[];
    }
  | { ok: false; error: string; telemetry: CallTelemetry };

const CriticInputSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass", "needs_repair", "fail"] },
    summary: { type: "string" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["blocker", "major", "minor"] },
          path: { type: "string" },
          message: { type: "string" },
          suggested_fix: { type: "string" },
        },
        required: ["severity", "path", "message", "suggested_fix"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdict", "summary", "issues"],
  additionalProperties: false,
} as const;

export async function criticDay(args: {
  /** Deprecated — kept for callsite compatibility. Provider auth is handled
   *  by the AI adapter. */
  apiKey?: string;
  model: AnthropicModelId;
  pass: "critic-1" | "critic-2" | "escalate-critic";
  client: PlanClient;
  assessment: PlanAssessment;
  duration_weeks: number;
  week_number: number;
  day_number: number;
  days_per_week: number;
  day: any;
  programmatic_warnings: string[];
}): Promise<CriticResult> {
  const safetyBlock = buildSafetyBlock(args.assessment);

  const sys = `You are a senior strength & conditioning reviewer auditing ONE training day a junior coach has produced for a real client. Your job is to FIND PROBLEMS — be precise, terse, and actionable. Do NOT rewrite the day. Only critique.${safetyBlock}

REVIEW DIMENSIONS (in priority order):
  1. CLINICAL SAFETY — does anything in this day violate the safety constraints above? (HIGHEST PRIORITY → blocker)
  2. EQUIPMENT — every exercise's equipment[] must be a subset of the client's available_equipment.
  3. CONTRAINDICATIONS — injuries, medical conditions, mobility limitations, movement screen items scoring 1–2.
  4. SESSION SHAPE — warmup / activation / dynamic_stretches / exercises / cardio / cooldown / finisher all present (cardio may be []).
  5. EXERCISE QUALITY — rationale phase-consistent, references concrete client data (number OR explicit constraint), no generic banned phrasing.
  6. SUPERSETS — each superset_id appears exactly twice and consecutively, max 3 groups, no superset on a strength-phase main lift.
  7. OPTIONAL — at most 2; only in last 2 slots; RPE ≤ 7; never main lift; never inside a superset.
  8. LOAD / DOSE — RPE within range for experience level; reasonable sets/reps/rest for the focus.

SEVERITY SCALE:
  - "blocker" → safety violation OR something that would harm/injure the client.
  - "major"   → breaks an explicit HARD RULE (equipment mismatch, banned phrasing, broken superset, excessive optionals).
  - "minor"   → quality nit (tempo could be better, rationale slightly thin, cue could be sharper). Bias to minor when in doubt.

VERDICT:
  - "pass"          → zero blockers, zero majors. Minors allowed.
  - "needs_repair"  → at least one blocker OR major. Day is fixable with surgical edits.
  - "fail"          → so many issues a clean rewrite is cheaper than repair (rare — only when >40% of exercises are broken or the structure is fundamentally wrong).

OUTPUT — call emit_critic_verdict with the structured result. Keep messages ≤120 chars. Each issue MUST be tied to a concrete path. Do NOT invent issues — if the day is good, emit "pass" with an empty issues array.

You will also receive a list of PROGRAMMATIC WARNINGS that a deterministic linter already flagged. Treat them as context. You may upgrade them in severity, downgrade them, or add new issues the linter missed. Do not blindly repeat them — only include issues you would flag yourself.`;

  const ctx =
    buildClientContextBlock(args.client, args.assessment, args.duration_weeks) +
    `\n\nDAY UNDER REVIEW: week ${args.week_number} of ${args.duration_weeks}, day ${args.day_number} of ${args.days_per_week}.\n\nDAY JSON (the coach's draft):\n${JSON.stringify(args.day, null, 2)}\n\nPROGRAMMATIC WARNINGS already detected (treat as hints, not gospel):\n${args.programmatic_warnings.length ? args.programmatic_warnings.map((w) => `- ${w}`).join("\n") : "(none)"}`;

  const t0 = Date.now();
  try {
    const res = await anthropicCompatFetch({
      model: args.model,
      max_tokens: 2000,
      system: sys,
      messages: [{ role: "user", content: ctx }],
      tools: [
        {
          name: "emit_critic_verdict",
          description: "Emit the structured critic verdict for this training day.",
          input_schema: CriticInputSchema as unknown as Record<string, unknown>,
        },
      ],
      tool_choice: { type: "tool", name: "emit_critic_verdict" },
    });

    const elapsed = Date.now() - t0;
    if (!res.ok) {
      const t = await res.text();
      console.error("[critic] anthropic error", res.status, t.slice(0, 400));
      return {
        ok: false,
        error: `Critic call failed (${res.status})`,
        telemetry: makeTelemetry(args.model, args.pass, null, elapsed, false, `${res.status}`),
      };
    }
    const json = await res.json();
    const usage = json?.usage;
    const toolUse = json?.content?.find((b: any) => b.type === "tool_use");
    const verdict = toolUse?.input as CriticVerdict | undefined;
    if (!verdict || !verdict.verdict) {
      return {
        ok: false,
        error: "Critic returned no verdict",
        telemetry: makeTelemetry(args.model, args.pass, usage, elapsed, false, "no-verdict"),
      };
    }
    // Defensive: ensure issues array exists.
    if (!Array.isArray(verdict.issues)) verdict.issues = [];
    return {
      ok: true,
      verdict,
      telemetry: makeTelemetry(args.model, args.pass, usage, elapsed, true),
      programmatic_warnings: args.programmatic_warnings,
    };
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error("[critic] threw", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      telemetry: makeTelemetry(args.model, args.pass, null, elapsed, false, "threw"),
    };
  }
}

// Helper used by the orchestrator to decide whether to invoke repair.
export function shouldRepair(verdict: CriticVerdict): boolean {
  return verdict.verdict !== "pass" && verdict.issues.some((i) => i.severity === "blocker" || i.severity === "major");
}
