import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { summarizePriorBlock } from "@/lib/block-feedback";

/**
 * archivePlanAndStartManualNextBlock — caminho 100% manual.
 *
 * Arquiva o plano anterior, cria um workout_plans em branco com
 * block_number+1 + prior_plan_id + transition summary editado pelo
 * treinador, e devolve o id para a UI navegar para a edição manual.
 * Não chama IA. Pensado como espelho honesto de
 * archivePlanAndStartNextBlock — a IA é só atalho, isto é o caminho.
 */
export const archivePlanAndStartManualNextBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        priorPlanId: z.string().uuid(),
        summary: z.string().trim().max(2000).optional(),
        title: z.string().trim().min(1).max(120).optional(),
        durationWeeks: z.number().int().min(1).max(16).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: prior, error: priorErr } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id, client_id, block_number, duration_weeks, assessment_id")
      .eq("id", data.priorPlanId)
      .maybeSingle();
    if (priorErr || !prior) return { ok: false as const, error: priorErr?.message ?? "Plano não encontrado." };
    if ((prior as any).trainer_id !== userId) return { ok: false as const, error: "forbidden" };

    const summary = data.summary ?? "";
    const nextBlock = ((prior as any).block_number ?? 1) + 1;
    const durationWeeks = data.durationWeeks ?? (prior as any).duration_weeks ?? 4;

    // Arquiva o plano anterior, com a nota assinada pelo treinador.
    await supabaseAdmin
      .from("workout_plans")
      .update({ status: "archived", block_transition_summary: summary || null })
      .eq("id", data.priorPlanId);

    // Cria o Bloco N+1 em rascunho manual — sem brief/blueprint da IA.
    const { data: nextPlanRow, error: insErr } = await supabaseAdmin
      .from("workout_plans")
      .insert({
        trainer_id: userId,
        client_id: (prior as any).client_id,
        assessment_id: (prior as any).assessment_id ?? null,
        title: data.title?.trim() || `Bloco ${nextBlock}`,
        duration_weeks: durationWeeks,
        status: "draft",
        generation_status: "manual",
        block_number: nextBlock,
        prior_plan_id: data.priorPlanId,
        block_transition_summary: summary || null,
        plan_data: { weeks: [] },
      })
      .select("id")
      .single();
    if (insErr || !nextPlanRow) {
      return { ok: false as const, error: insErr?.message ?? "Falhou criar o próximo bloco." };
    }

    return { ok: true as const, planId: (nextPlanRow as any).id as string, blockNumber: nextBlock };
  });

/**
 * computeTransitionSummary — devolve a sugestão de resumo de transição
 * (adesão + RPE drift + recomendação) para um plano. Server fn read-only,
 * usada pelo diálogo manual para pré-preencher o textarea.
 */
export const computeTransitionSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ priorPlanId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: prior } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id, block_number")
      .eq("id", data.priorPlanId)
      .maybeSingle();
    if (!prior || (prior as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    const { data: sessions } = await supabaseAdmin
      .from("workout_sessions")
      .select("week_number, status, entries")
      .eq("plan_id", data.priorPlanId)
      .order("week_number", { ascending: true });

    const totalLogged = sessions?.length ?? 0;
    const completed = (sessions ?? []).filter((s: any) => s.status === "done").length;
    const adherencePct = totalLogged > 0 ? Math.round((completed / totalLogged) * 100) : 0;

    const rpePerWeek = new Map<number, number[]>();
    for (const s of sessions ?? []) {
      const wk = (s as any).week_number ?? 0;
      const entries = ((s as any).entries ?? []) as any[];
      const rpes = entries
        .flatMap((e) => (e?.sets ?? []).map((set: any) => Number(set?.rpe)))
        .filter((n) => Number.isFinite(n));
      if (!rpes.length) continue;
      const arr = rpePerWeek.get(wk) ?? [];
      arr.push(...rpes);
      rpePerWeek.set(wk, arr);
    }
    const weeks = [...rpePerWeek.keys()].sort((a, b) => a - b);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const firstRpe = weeks.length ? avg(rpePerWeek.get(weeks[0])!) : null;
    const lastRpe = weeks.length ? avg(rpePerWeek.get(weeks[weeks.length - 1])!) : null;
    const rpeDrift =
      firstRpe !== null && lastRpe !== null ? Number((lastRpe - firstRpe).toFixed(2)) : null;

    const lines = [
      `Bloco ${(prior as any).block_number ?? 1} concluído.`,
      totalLogged > 0
        ? `Adesão: ${adherencePct}% (${completed}/${totalLogged} sessões registadas).`
        : "Sem sessões registadas — pondere reduzir frequência ou rever obstáculos antes do próximo bloco.",
      rpeDrift !== null
        ? `RPE médio variou ${rpeDrift > 0 ? "+" : ""}${rpeDrift} entre semana ${weeks[0]} e ${weeks[weeks.length - 1]}.`
        : "RPE: sem dados suficientes.",
      adherencePct >= 80 && (rpeDrift ?? 0) < 1
        ? "Sugestão: progredir carga 5–7%, manter volume."
        : adherencePct < 60
        ? "Sugestão: deload (volume −20%), reforçar padrões base."
        : "Sugestão: manter carga, variar exercícios acessórios.",
    ];

    return {
      ok: true as const,
      summary: lines.join(" "),
      adherencePct,
      rpeDrift,
      sessionsLogged: totalLogged,
      blockFeedback: summarizePriorBlock((sessions ?? []) as any),
    };
  });

/**
 * markPlanFinished — closes a plan's lifecycle.
 * Sets completion_state="finished_logging" and (optionally) status="archived".
 * Use this when the trainer says "fechar plano" without yet creating Block N+1.
 */
export const markPlanFinished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid(), archive: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: prior } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id")
      .eq("id", data.planId)
      .maybeSingle();
    if (!prior || (prior as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }
    const update: { completion_state: string; status?: string } = {
      completion_state: "finished_logging",
    };
    if (data.archive) update.status = "archived";
    const { error } = await supabaseAdmin
      .from("workout_plans")
      .update(update)
      .eq("id", data.planId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });