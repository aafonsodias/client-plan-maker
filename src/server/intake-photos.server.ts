import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getSignedPhotoUrl(path: string, expiresInSec = 300) {
  const { data, error } = await supabaseAdmin.storage
    .from("client-photos")
    .createSignedUrl(path, expiresInSec);
  if (error || !data) return null;
  return data.signedUrl;
}