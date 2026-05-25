import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getDefaultAiProvider } from "@/server/ai/provider-adapter.server";

/**
 * Public (token-gated) goal interpretation.
 * Takes free-text from the client (e.g. "tone", "ficar mais forte"),
 * returns a structured intent. Result is stored in
 * assessments.extended.ai_goal_interpretation. Never shown raw to the
 * client — the coach sees + edits it on the dashboard.
 */

const INTENTS = ["fat_loss", "hypertrophy", "strength", "endurance", "general_health", "mobility"] as const;

const inputSchema = z.object({
  token: z.string().uuid(),
  text: z.string().trim().min(1).max(1000),
  locale: z.enum(["pt", "en"]).default("pt"),
});

export const interpretGoal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    // Validate token
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, intake_token_expires_at, intake_status")
      .eq("intake_token", data.token)
      .maybeSingle();
    if (!client) throw new Error("Invalid token.");
    const expired = !client.intake_token_expires_at || new Date(client.intake_token_expires_at) < new Date();
    if (expired) throw new Error("Expired.");

    const aiProvider = getDefaultAiProvider();
    if (!aiProvider.isConfigured()) throw new Error("AI not configured.");

    const sys = data.locale === "pt"
      ? "És um treinador. Recebes objetivos vagos de clientes e devolves uma interpretação estruturada e curta. Nunca julgues o cliente. Usa português europeu."
      : "You are a coach. You receive vague client goals and return a short, structured interpretation. Never judge. Plain English.";

    const tools = [{
      type: "function",
      function: {
        name: "interpret",
        description: "Return a structured interpretation of the client's training goal.",
        parameters: {
          type: "object",
          properties: {
            intent: { type: "string", enum: [...INTENTS] },
            human_label: { type: "string", description: "1-line plain-language label of the intent in the client's language (e.g. 'ganho de força geral')." },
            measurable_suggestion: { type: "string", description: "A measurable outcome the client can aim for (e.g. 'agachar 1.5x peso corporal')." },
            timeline_weeks: { type: "number" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            notes: { type: "string", description: "Short note for the coach. Max 200 chars." },
          },
          required: ["intent", "human_label", "confidence"],
          additionalProperties: false,
        },
      },
    }];

    const aiResult = await aiProvider.createChatCompletion({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: data.text },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "interpret" } },
    });
    if (!aiResult.ok) throw new Error("AI not configured.");
    const resp = aiResult.response;

    if (!resp.ok) {
      if (resp.status === 429) throw new Error("AI rate-limited. Try again in a minute.");
      if (resp.status === 402) throw new Error("AI credits exhausted.");
      const t = await resp.text();
      console.error("[interpretGoal] gateway error", resp.status, t);
      throw new Error("AI interpretation failed.");
    }

    const json = await resp.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("No interpretation returned.");
    let parsed: any = {};
    try { parsed = JSON.parse(call.function.arguments); } catch { throw new Error("Bad AI payload."); }

    // Persist into assessment.extended.ai_goal_interpretation
    const { data: existing } = await supabaseAdmin
      .from("assessments")
      .select("id, extended, trainer_id")
      .eq("client_id", client.id)
      .maybeSingle();
    const prev = (existing?.extended as Record<string, any>) ?? {};
    const merged = { ...prev, ai_goal_interpretation: { ...parsed, source_text: data.text, at: new Date().toISOString() } };
    if (existing) {
      await supabaseAdmin.from("assessments").update({ extended: merged } as any).eq("id", existing.id);
    }
    return parsed as {
      intent: typeof INTENTS[number];
      human_label: string;
      measurable_suggestion?: string;
      timeline_weeks?: number;
      confidence: number;
      notes?: string;
    };
  });
