import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAllowedModel, DEFAULT_MODEL_ID } from "@/lib/ai-models";
import { getDefaultAiProvider } from "@/server/ai/provider-adapter.server";

/**
 * askAtlas — open-ended coaching/programming Q&A used by the in-app
 * Atlas dock. Atlas is the named copilot for Protocol. Unlike askConcierge
 * (which only navigates the app), this is a free-form chat with the
 * user-chosen model and optional client context.
 */
const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(8000),
});

export const askAtlas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        messages: z.array(MessageSchema).min(1).max(30),
        model: z.string().optional(),
        currentPath: z.string().optional(),
        clientContext: z
          .object({
            name: z.string().optional(),
            primaryGoal: z.string().optional(),
            experience: z.string().optional(),
            equipment: z.array(z.string()).optional(),
            restrictions: z.string().optional(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const model = isAllowedModel(data.model) ? data.model : DEFAULT_MODEL_ID;
    const ctxLines: string[] = [];
    if (data.currentPath) ctxLines.push(`Current route: ${data.currentPath}`);
    if (data.clientContext) {
      const c = data.clientContext;
      if (c.name) ctxLines.push(`Client: ${c.name}`);
      if (c.primaryGoal) ctxLines.push(`Goal: ${c.primaryGoal}`);
      if (c.experience) ctxLines.push(`Experience: ${c.experience}`);
      if (c.equipment?.length) ctxLines.push(`Equipment: ${c.equipment.join(", ")}`);
      if (c.restrictions) ctxLines.push(`Restrictions: ${c.restrictions}`);
    }

    const systemPrompt = `You are Atlas — the copilot inside Protocol, an honest strength & conditioning workbench for personal trainers. You carry the map: when the trainer seems lost, suggest the next concrete step.

Reply in the same language the user wrote. PT voice = "você" (formal/neutral). EN = neutral 2nd person. Be direct, brief, and grounded in evidence.
Format with light markdown: short paragraphs, bullets when listing exercises, **bold** for key cues. No emojis. No marketing tone.

If the user asks for programming, default to: sets × reps @ RPE notation, mention progression, call out risks/red-flags honestly.
If the question is outside coaching/training, say so in one sentence.

${ctxLines.length ? `Context the trainer has open right now:\n${ctxLines.join("\n")}` : ""}`.trim();

    const aiProvider = getDefaultAiProvider();
    const aiResult = await aiProvider.createChatCompletion({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
    });
    if (!aiResult.ok) return { ok: false as const, error: "AI not configured." };
    const aiRes = aiResult.response;

    if (!aiRes.ok) {
      if (aiRes.status === 429) return { ok: false as const, error: "Limite de pedidos atingido. Tenta de novo em ~1 minuto." };
      if (aiRes.status === 402) return { ok: false as const, error: "Créditos de IA esgotados. Adiciona crédito no fornecedor de IA configurado." };
      const text = await aiRes.text().catch(() => "");
      console.error("[atlas] gateway", aiRes.status, text.slice(0, 300));
      return { ok: false as const, error: `AI gateway error ${aiRes.status}` };
    }

    const json: any = await aiRes.json();
    const reply: string = json?.choices?.[0]?.message?.content ?? "";
    if (!reply) return { ok: false as const, error: "AI devolveu resposta vazia." };
    return { ok: true as const, reply, model };
  });
