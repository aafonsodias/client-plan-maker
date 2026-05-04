import { supabase } from "@/integrations/supabase/client";
import type { PlanData, Day, Week } from "@/lib/pdf";

/**
 * Fire-and-forget PDF download for a finalized plan, callable from anywhere
 * (e.g. the client page's "Plano final" row) without navigating to
 * /plans/$planId first. Mirrors the loader logic in plans.$planId.tsx but
 * stripped of UI state.
 */
export async function downloadPlanById(planId: string): Promise<void> {
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) throw new Error("Plano não encontrado.");

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", (plan as any).client_id)
    .maybeSingle();
  if (!client) throw new Error("Cliente não encontrado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", (plan as any).trainer_id)
    .maybeSingle();

  // Phased plans store weeks in workout_plan_days; legacy in plan_data.
  const stage: string | undefined = (plan as any)?.generation_state?.stage;
  const phasedComplete =
    stage === "complete" || (plan as any)?.generation_status === "complete";

  let data: PlanData = { weeks: [] };
  if (phasedComplete) {
    const { data: dayRows } = await supabase
      .from("workout_plan_days")
      .select("week_number, day_number, day_label, focus, rationale, content")
      .eq("plan_id", planId)
      .order("week_number", { ascending: true })
      .order("day_number", { ascending: true });
    const weeksMap = new Map<number, Week>();
    for (const row of (dayRows ?? []) as any[]) {
      const wn = row.week_number as number;
      if (!weeksMap.has(wn)) {
        weeksMap.set(wn, { week_number: wn, focus: "", days: [] } as Week);
      }
      const wk = weeksMap.get(wn)!;
      const content = row.content ?? {};
      const exercises = Array.isArray(content.exercises) ? content.exercises : [];
      wk.days.push({
        day_label: row.day_label ?? `Day ${row.day_number}`,
        focus: row.focus ?? "",
        rationale: row.rationale ?? undefined,
        exercises,
        warmup: Array.isArray(content.warmup) ? content.warmup : undefined,
        activation: Array.isArray(content.activation) ? content.activation : undefined,
        dynamic_stretches: Array.isArray(content.dynamic_stretches) ? content.dynamic_stretches : undefined,
        cooldown: Array.isArray(content.cooldown) ? content.cooldown : undefined,
        finisher: Array.isArray(content.finisher) ? content.finisher : undefined,
        finisher_enabled: typeof content.finisher_enabled === "boolean" ? content.finisher_enabled : undefined,
        cardio: Array.isArray(content.cardio) ? content.cardio : undefined,
      } as Day);
    }
    data = { weeks: Array.from(weeksMap.values()).sort((a, b) => a.week_number - b.week_number) };
  } else {
    data = ((plan as any).plan_data as PlanData) ?? { weeks: [] };
  }

  // Resolve a logo data URL (private bucket → signed URL → blob → dataURL).
  let logoDataUrl: string | null = null;
  if ((profile as any)?.logo_url) {
    try {
      const { data: signed } = await supabase.storage
        .from("logos")
        .createSignedUrl((profile as any).logo_url, 600);
      if (signed?.signedUrl) {
        const res = await fetch(signed.signedUrl);
        const blob = await res.blob();
        logoDataUrl = await new Promise<string | null>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => resolve(null);
          r.readAsDataURL(blob);
        });
      }
    } catch {
      /* ignore */
    }
  }

  const { generatePlanPdf } = await import("@/lib/pdf");
  await generatePlanPdf(
    {
      title: (plan as any).title,
      summary: (plan as any).summary,
      client_name: (client as any).full_name,
      duration_weeks: (plan as any).duration_weeks,
      block_number: (plan as any).block_number ?? 1,
      block_transition_summary: (plan as any).block_transition_summary ?? null,
      block_evolution: null,
    },
    data,
    {
      business_name: (profile as any)?.business_name,
      full_name: (profile as any)?.full_name,
      tagline: (profile as any)?.tagline,
      contact_email: (profile as any)?.contact_email,
      contact_phone: (profile as any)?.contact_phone,
      logo_data_url: logoDataUrl,
    }
  );
}