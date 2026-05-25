import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CONCIERGE_ROUTES, buildRouteContext } from "@/lib/concierge-routes";
import { getDefaultAiProvider } from "@/server/ai/provider-adapter.server";

/**
 * Concierge AI — answers user questions about how the app works and points
 * to concrete routes. Returns markdown text + an array of suggested links the
 * UI renders as clickable chips. Founder-only at first.
 */

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const askConcierge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        messages: z.array(MessageSchema).max(20),
        currentPath: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    void context.userId; // founder gating happens client-side; this is best-effort

    const validPaths = CONCIERGE_ROUTES.map((r) => r.path).join(", ");
    const systemPrompt = `You are the in-app Guide for "Atlhan Plan", a fitness coaching tool for personal trainers.

Your job:
- Answer "where is X?" and "how do I do Y?" questions about this app.
- Point users to the right place using one of these exact routes (no others):

${buildRouteContext()}

Style:
- Reply in the same language the user wrote (PT or EN).
- Be brief and direct. 1–3 short sentences. No marketing-speak, no cerimony.
- Use markdown lightly (bullets, bold). No headings. No emojis.
- When you reference a place in the app, ALWAYS call submit_answer with the path in suggestions[].
- Valid paths only: ${validPaths}
- The user is currently on: ${data.currentPath ?? "/"}

If the question isn't about this app, say so in one line.`;

    const aiProvider = getDefaultAiProvider();
    const aiResult = await aiProvider.createChatCompletion({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_answer",
              description: "Return the assistant's reply with optional navigation suggestions.",
              parameters: {
                type: "object",
                properties: {
                  reply: { type: "string", description: "The markdown answer to display to the user." },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        path: { type: "string", description: "Route path from the allowed list." },
                        label: { type: "string", description: "Short clickable label (1–4 words)." },
                      },
                      required: ["path", "label"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["reply", "suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_answer" } },
    });
    if (!aiResult.ok) return { ok: false as const, error: "AI not configured." };
    const aiRes = aiResult.response;

    if (!aiRes.ok) {
      if (aiRes.status === 429) return { ok: false as const, error: "AI rate-limited; try again in a minute." };
      if (aiRes.status === 402) return { ok: false as const, error: "AI credits exhausted." };
      const text = await aiRes.text().catch(() => "");
      console.error("[concierge] gateway", aiRes.status, text.slice(0, 300));
      return { ok: false as const, error: `AI gateway error ${aiRes.status}` };
    }

    const json: any = await aiRes.json();
    const argsRaw = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsRaw) return { ok: false as const, error: "AI did not return a structured answer." };

    let parsed: { reply: string; suggestions: Array<{ path: string; label: string }> };
    try {
      parsed = JSON.parse(argsRaw);
    } catch {
      return { ok: false as const, error: "AI reply was not valid JSON." };
    }

    // Filter suggestions to allow-list only.
    const allow = new Set(CONCIERGE_ROUTES.map((r) => r.path));
    const suggestions = (parsed.suggestions ?? []).filter((s) => allow.has(s.path));

    return { ok: true as const, reply: parsed.reply, suggestions };
  });
