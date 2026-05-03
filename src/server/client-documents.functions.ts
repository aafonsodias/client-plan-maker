import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Trainer-scoped documents (medical exams, prescriptions, etc) per client.
 * Stored in private bucket `client-documents` at `{trainerId}/{clientId}/<uuid>-<filename>`.
 * RLS keeps trainers in their own folder.
 */

export const listClientDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: items, error } = await supabase.storage
      .from("client-documents")
      .list(`${userId}/${data.clientId}`, { sortBy: { column: "created_at", order: "desc" }, limit: 100 });
    if (error) throw new Error(error.message);
    return { items: items ?? [] };
  });

export const uploadClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        filename: z.string().min(1).max(200),
        // data:<mime>;base64,xxxx — accept any common file type up to ~15MB.
        dataUrl: z.string().regex(/^data:[^;]+;base64,/).max(20_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const m = data.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error("Invalid file.");
    const contentType = m[1];
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.byteLength > 15_000_000) throw new Error("File too large (15MB max).");
    const safeName = data.filename.replace(/[^\w.\- ]+/g, "_");
    const path = `${userId}/${data.clientId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from("client-documents")
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(error.message);
    return { ok: true, path };
  });

export const getDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid(), name: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const path = `${userId}/${data.clientId}/${data.name}`;
    const { data: signed, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(path, 60 * 10);
    if (error || !signed) throw new Error(error?.message ?? "Sign failed");
    return { url: signed.signedUrl };
  });

export const deleteClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid(), name: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const path = `${userId}/${data.clientId}/${data.name}`;
    const { error } = await supabase.storage.from("client-documents").remove([path]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });