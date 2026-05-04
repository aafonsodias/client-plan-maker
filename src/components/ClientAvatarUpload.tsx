import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientAvatar } from "@/components/ClientAvatar";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * Shows the current client photo with a hover-to-upload affordance.
 *
 * Files are stored in the private `client-photos` bucket under
 * `{trainerId}/{clientId}.{ext}` so RLS scopes them to their owner.
 * Because the bucket is private we read the photo via a signed URL and
 * persist it on `clients.photo_url` so list views can render it without
 * extra round-trips.
 */
export function ClientAvatarUpload({
  clientId,
  trainerId,
  name,
  photoUrl,
  onChange,
  size = 56,
  showFounderDot = false,
}: {
  clientId: string;
  trainerId: string;
  name: string;
  photoUrl: string | null;
  onChange: (url: string | null) => void;
  size?: number;
  showFounderDot?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem demasiado grande (máx 5 MB)");
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${trainerId}/${clientId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("client-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // Sign a long-lived URL (1 year) — bucket is private.
      const { data: signed, error: signErr } = await supabase.storage
        .from("client-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Sign failed");

      const { error: updErr } = await supabase
        .from("clients")
        .update({ photo_url: signed.signedUrl })
        .eq("id", clientId);
      if (updErr) throw updErr;

      onChange(signed.signedUrl);
      toast.success("Foto atualizada");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Não foi possível guardar a foto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-block">
      <ClientAvatar name={name} photoUrl={photoUrl} size={size} />
      {showFounderDot && (
        <span
          aria-label="Founder"
          title="Founder"
          className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/20 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.45)]"
        >
          <Sparkles className="h-3 w-3" />
        </span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground disabled:opacity-60"
        aria-label="Mudar foto"
        title="Mudar foto"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Camera className="h-3 w-3" />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}