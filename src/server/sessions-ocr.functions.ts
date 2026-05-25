import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getDefaultAiProvider } from "@/server/ai/provider-adapter.server";

/**
 * Extract a session log from a photo of a printed plan sheet.
 *
 * Flow:
 *   1. Validate the share token + plan/week/day exist.
 *   2. Send the image + the *expected* exercise list to Gemini 2.5 Pro
 *      via the configured AI provider with a strict tool-call schema.
 *   3. Return a list of extracted entries the client can review and
 *      either merge or discard. We DO NOT auto-write to the DB — OCR
 *      is fallible and the trainer/client must confirm.
 *
 * Input:
 *   - token (uuid string), plan_id (uuid)
 *   - week_number, day_label
 *   - image_data_url: a data URL ("data:image/...;base64,...") under ~6MB
 */

type GatewayMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    overall_confidence: {
      type: "number",
      description: "0..1 — how confidently the page matches the expected workout.",
    },
    notes_excerpt: {
      type: "string",
      description: "Any handwritten free-text notes you see at the bottom of the sheet.",
    },
    entries: {
      type: "array",
      description: "One item per exercise as listed on the printed sheet, in order.",
      items: {
        type: "object",
        properties: {
          exercise_name: { type: "string" },
          matched: {
            type: "boolean",
            description: "True if you matched this row to one of the expected exercises.",
          },
          sets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                reps: { type: "string", description: "Reps written (e.g. \"8\"). Empty if blank." },
                weight: { type: "string", description: "Load written (e.g. \"60\", \"60kg\"). Empty if blank." },
                rpe: { type: "string", description: "RPE written (e.g. \"7\"). Empty if blank." },
              },
              required: ["reps", "weight", "rpe"],
              additionalProperties: false,
            },
          },
        },
        required: ["exercise_name", "matched", "sets"],
        additionalProperties: false,
      },
    },
  },
  required: ["overall_confidence", "entries"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a precise OCR assistant for handwritten gym log sheets in Portuguese / English. The user will give you:
(a) the EXPECTED exercise list (printed on the sheet, in order, with set count)
(b) a photo of that printed sheet, with handwritten values in each "S1: __×__ @__" slot

Your job: read the handwriting and return one entry per expected exercise, in the same order.
- For each set slot, return reps, weight (load), and rpe as strings (just the number, no units).
- If a slot is blank, return empty strings — never invent a value.
- "×" separates reps × weight. "@" prefixes RPE.
- If the photo is blurry or rotated, do your best; lower overall_confidence accordingly.
- Match handwriting to the expected exercise name — set matched=true. If you genuinely cannot match, return matched=false and skip set extraction.
- Keep going through ALL expected exercises even if some rows are blank.
- Do NOT translate exercise names. Echo them as printed.
`;

export const extractSessionFromImage = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().uuid(),
        plan_id: z.string().uuid(),
        week_number: z.number().int().min(1).max(52),
        day_label: z.string().min(1).max(120),
        image_data_url: z
          .string()
          .startsWith("data:image/")
          .max(8_500_000, "Imagem demasiado grande (máx ~6MB)."),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const aiProvider = getDefaultAiProvider();
    if (!aiProvider.isConfigured()) {
      throw new Error("OCR indisponível: AI gateway não configurado.");
    }

    // Verify the token grants access to this plan, mirroring share semantics.
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("workout_plans")
      .select("id, share_token, share_token_expires_at")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (planErr || !plan) throw new Error("Plano não encontrado.");
    if (!plan.share_token || plan.share_token !== data.token) {
      throw new Error("Link inválido.");
    }
    if (plan.share_token_expires_at && new Date(plan.share_token_expires_at) < new Date()) {
      throw new Error("Link expirado.");
    }

    // Pull the planned exercise list for this week/day so the model has context.
    const { data: dayRow } = await supabaseAdmin
      .from("workout_plan_days")
      .select("content")
      .eq("plan_id", data.plan_id)
      .eq("week_number", data.week_number)
      .eq("day_label", data.day_label)
      .maybeSingle();

    const expected: Array<{ name: string; sets: string }> =
      ((dayRow?.content as any)?.exercises ?? []).map((ex: any) => ({
        name: String(ex.name ?? ""),
        sets: String(ex.sets ?? ""),
      }));

    if (expected.length === 0) {
      throw new Error("Não há exercícios planeados para esta sessão.");
    }

    const userText = `Expected exercise list (printed on the sheet, ordered top to bottom):\n${expected
      .map((e, i) => `${i + 1}. ${e.name} — ${e.sets} sets`)
      .join("\n")}\n\nReturn one entry per expected row, in the same order. Use the submit_log tool.`;

    const messages: GatewayMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: data.image_data_url } },
        ],
      },
    ];

    const aiResult = await aiProvider.createChatCompletion({
      model: "google/gemini-2.5-pro",
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "submit_log",
            description: "Return the extracted handwritten log values.",
            parameters: TOOL_SCHEMA,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "submit_log" } },
    });
    if (!aiResult.ok) {
      throw new Error("OCR indisponível: AI gateway não configurado.");
    }
    const aiRes = aiResult.response;

    if (!aiRes.ok) {
      const text = await aiRes.text().catch(() => "");
      console.error("[sessions-ocr] gateway error", aiRes.status, text.slice(0, 400));
      if (aiRes.status === 429) throw new Error("AI ocupada. Tenta daqui a um minuto.");
      if (aiRes.status === 402) throw new Error("Créditos AI esgotados.");
      throw new Error(`Erro AI ${aiRes.status}.`);
    }

    const json: any = await aiRes.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) throw new Error("AI não devolveu resultado estruturado.");

    let parsed: any;
    try {
      parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    } catch {
      throw new Error("Resposta AI mal-formada.");
    }

    const entries: Array<{
      exercise_name: string;
      matched: boolean;
      sets: Array<{ reps: string; weight: string; rpe: string }>;
    }> = Array.isArray(parsed?.entries) ? parsed.entries : [];

    return {
      ok: true as const,
      overall_confidence: typeof parsed?.overall_confidence === "number" ? parsed.overall_confidence : 0,
      notes_excerpt: typeof parsed?.notes_excerpt === "string" ? parsed.notes_excerpt : "",
      entries: entries.map((e) => ({
        exercise_name: String(e.exercise_name ?? ""),
        matched: !!e.matched,
        sets: Array.isArray(e.sets)
          ? e.sets.map((s) => ({
              reps: String(s?.reps ?? ""),
              weight: String(s?.weight ?? ""),
              rpe: String(s?.rpe ?? ""),
            }))
          : [],
      })),
    };
  });
