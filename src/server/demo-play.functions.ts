import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  startPhasedPlanDraft,
  approveBrief,
} from "@/server/phased/stage1-brief.functions";
import {
  generateBlueprint,
  approveBlueprint,
} from "@/server/phased/stage2-blueprint.functions";
import {
  generateMicrocycleDays,
  approveMicrocycle,
} from "@/server/phased/stage3-microcycle.functions";
import {
  proposeProgressions,
  approveProgressions,
} from "@/server/phased/stage4-progressions.functions";
import { bulkFillRemainingWeeks } from "@/server/phased/stage5-bulkfill.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * runDemoPlay — drives the entire 5-stage phased pipeline server-side for a
 * demo client so the UI can show theatrical "auto-advance" progress without
 * the trainer clicking anything. Each stage's natural approval is replayed
 * by calling the server fn directly.
 *
 * Returns step-by-step status so the HUD can mirror progress. Failures stop
 * the chain and surface the failing stage (we *want* to learn where the flow
 * breaks per persona).
 */

type StepKey =
  | "brief_generate"
  | "brief_approve"
  | "blueprint_generate"
  | "blueprint_approve"
  | "microcycle_generate"
  | "microcycle_approve"
  | "progressions_generate"
  | "progressions_approve"
  | "finalize";

const ALL_STEPS: StepKey[] = [
  "brief_generate",
  "brief_approve",
  "blueprint_generate",
  "blueprint_approve",
  "microcycle_generate",
  "microcycle_approve",
  "progressions_generate",
  "progressions_approve",
  "finalize",
];

export const runDemoPlay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const completed: StepKey[] = [];

    const fail = (step: StepKey, error: string) => ({
      ok: false as const,
      failedStep: step,
      completed,
      error,
      planId: null as string | null,
      steps: ALL_STEPS,
    });

    // 1. Brief — start phased draft, get planId
    const startRes: any = await startPhasedPlanDraft({
      data: { clientId: data.clientId },
    });
    if (!startRes?.ok || !startRes.planId) {
      return fail("brief_generate", startRes?.error || "Brief synthesis failed");
    }
    const planId = startRes.planId as string;
    completed.push("brief_generate");

    // Pull stored brief + programming variables to feed approveBrief.
    const { data: planRow } = await supabaseAdmin
      .from("workout_plans")
      .select("brief, programming_variables, red_flag_accommodations")
      .eq("id", planId)
      .maybeSingle();
    const brief = (planRow as any)?.brief;
    if (!brief) return fail("brief_approve", "Brief missing on plan row");
    const programmingVariables = (planRow as any)?.programming_variables ?? undefined;
    const redFlagAccommodations = (planRow as any)?.red_flag_accommodations ?? undefined;

    // 2. Approve brief
    const approveBriefRes: any = await approveBrief({
      data: { planId, brief, programmingVariables, redFlagAccommodations },
    });
    if (!approveBriefRes?.ok) {
      return fail("brief_approve", approveBriefRes?.error || "Brief approval failed");
    }
    completed.push("brief_approve");

    // 3. Blueprint
    const bpGen: any = await generateBlueprint({ data: { planId } });
    if (!bpGen?.ok) {
      return fail("blueprint_generate", bpGen?.error || "Blueprint generation failed");
    }
    completed.push("blueprint_generate");

    const { data: bpRow } = await supabaseAdmin
      .from("workout_plans")
      .select("blueprint")
      .eq("id", planId)
      .maybeSingle();
    const blueprint = (bpRow as any)?.blueprint;
    if (!blueprint) return fail("blueprint_approve", "Blueprint missing on plan row");

    const bpApprove: any = await approveBlueprint({
      data: { planId, blueprint },
    });
    if (!bpApprove?.ok) {
      return fail("blueprint_approve", bpApprove?.error || "Blueprint approval failed");
    }
    completed.push("blueprint_approve");

    // 4. Microcycle (Week 1 day-by-day generation)
    // Derive day count from the approved blueprint so we ask Stage 3 for the
    // exact number of sessions the persona was scoped for (was crashing with
    // "dayIndices Required" when the input was omitted).
    const { data: bpRow2 } = await supabaseAdmin
      .from("workout_plans")
      .select("blueprint, brief")
      .eq("id", planId)
      .maybeSingle();
    const bpForDays: any = (bpRow2 as any)?.blueprint ?? {};
    const briefForDays: any = (bpRow2 as any)?.brief ?? {};
    const week1Map = bpForDays?.week_to_session_map?.["1"]
      ?? Object.values(bpForDays?.week_to_session_map ?? {})[0]
      ?? [];
    const dayCount = Math.max(
      1,
      Math.min(
        7,
        Array.isArray(week1Map) && week1Map.length > 0
          ? week1Map.length
          : Number(briefForDays?.sessions_per_week?.recommended ?? bpForDays?.sessions_per_week ?? 3),
      ),
    );
    const dayIndices = Array.from({ length: dayCount }, (_, i) => i + 1);
    const mcGen: any = await generateMicrocycleDays({ data: { planId, dayIndices } });
    if (!mcGen?.ok) {
      return fail("microcycle_generate", mcGen?.error || "Microcycle generation failed");
    }
    completed.push("microcycle_generate");

    const mcApprove: any = await approveMicrocycle({ data: { planId } });
    if (!mcApprove?.ok) {
      return fail("microcycle_approve", mcApprove?.error || "Microcycle approval failed");
    }
    completed.push("microcycle_approve");

    // 5. Progressions
    const prGen: any = await proposeProgressions({ data: { planId } });
    if (!prGen?.ok) {
      return fail("progressions_generate", prGen?.error || "Progressions generation failed");
    }
    completed.push("progressions_generate");

    const progressionPlan = prGen.progressionPlan;
    if (!progressionPlan) {
      return fail("progressions_approve", "Progression plan missing from response");
    }
    const prApprove: any = await approveProgressions({
      data: { planId, progressionPlan },
    });
    if (!prApprove?.ok) {
      return fail("progressions_approve", prApprove?.error || "Progressions approval failed");
    }
    completed.push("progressions_approve");

    // 6. Finalize — bulk-fill weeks 2..N and mark plan ready.
    const fin: any = await bulkFillRemainingWeeks({ data: { planId } });
    if (!fin?.ok) {
      return fail("finalize", fin?.error || "Finalize failed");
    }
    completed.push("finalize");

    return {
      ok: true as const,
      planId,
      completed,
      steps: ALL_STEPS,
      failedStep: null,
      error: null,
    };
  });

export type RunDemoPlayResult = Awaited<ReturnType<typeof runDemoPlay>>;
export type DemoPlayStep = StepKey;
export const DEMO_PLAY_STEPS = ALL_STEPS;