import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSignedPhotoUrl } from "./intake-photos.server";

/**
 * Public-token photo upload for the intake flow.
 *
 * Why a server function (vs. direct supabase storage upload):
 * - The `client-photos` bucket is RLS-scoped to the trainer (auth.uid()),
 *   so the anon intake session can't write to it directly.
 * - We accept a base64 dataURL, validate the token + size, and write via
 *   the service-role admin client. The path is stable per slot so re-takes
 *   overwrite cleanly.
 *
 * Path: `{trainerId}/{clientId}/posture-{slot}.jpg`
 * Slots: front | side | back | face
 * The path is also recorded on `assessments.extended.photos[slot]` so the
 * coach UI can list + sign URLs later.
 */

const SLOTS = ["front", "side", "back", "face"] as const;

const schema = z.object({
  token: z.string().uuid(),
  slot: z.enum(SLOTS),
  // data:image/jpeg;base64,xxxxx — we only accept jpeg/png up to ~6MB.
  dataUrl: z.string().regex(/^data:image\/(jpeg|png);base64,/).max(8_500_000),
});

export const uploadIntakePhoto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id, intake_token_expires_at, intake_status")
      .eq("intake_token", data.token)
      .maybeSingle();
    if (!client) throw new Error("This link is no longer valid.");
    if (client.intake_status === "reviewed") {
      throw new Error("Already reviewed.");
    }
    const expired = !client.intake_token_expires_at || new Date(client.intake_token_expires_at) < new Date();
    if (expired) throw new Error("This link has expired.");

    const m = data.dataUrl.match(/^data:image\/(jpeg|png);base64,(.+)$/);
    if (!m) throw new Error("Invalid image.");
    const ext = m[1] === "png" ? "png" : "jpg";
    const contentType = m[1] === "png" ? "image/png" : "image/jpeg";
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.byteLength > 6_500_000) throw new Error("Image too large.");

    const path = `${client.trainer_id}/${client.id}/posture-${data.slot}.${ext}`;
    const { error: upErr } = await supabaseAdmin
      .storage.from("client-photos")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);

    // Merge into assessments.extended.photos
    const { data: existing } = await supabaseAdmin
      .from("assessments")
      .select("id, extended")
      .eq("client_id", client.id)
      .maybeSingle();
    const prevExtended = (existing?.extended as Record<string, any>) ?? {};
    const photos = { ...(prevExtended.photos ?? {}), [data.slot]: path, captured_at: new Date().toISOString() };
    const nextExtended = { ...prevExtended, photos };

    if (existing) {
      await supabaseAdmin.from("assessments").update({ extended: nextExtended } as any).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("assessments").insert({
        client_id: client.id,
        trainer_id: client.trainer_id,
        extended: nextExtended,
      } as any);
    }

    return { ok: true, path };
  });

/* ─────────────── Public: signed URLs for already-uploaded photos ─────────────── */

const urlSchema = z.object({
  token: z.string().uuid(),
  slot: z.enum(SLOTS),
});

export const getIntakePhotoUrls = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, intake_token_expires_at")
      .eq("intake_token", data.token)
      .maybeSingle();
    if (!client) return {} as Record<string, string>;
    const expired = !client.intake_token_expires_at || new Date(client.intake_token_expires_at) < new Date();
    if (expired) return {} as Record<string, string>;
    const { data: a } = await supabaseAdmin
      .from("assessments")
      .select("extended")
      .eq("client_id", client.id)
      .maybeSingle();
    const photos = ((a?.extended as any)?.photos ?? {}) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const slot of SLOTS) {
      const path = photos[slot];
      if (typeof path === "string" && path.length > 0) {
        const url = await getSignedPhotoUrl(path, 600);
        if (url) out[slot] = url;
      }
    }
    return out;
  });