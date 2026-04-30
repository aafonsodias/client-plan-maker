import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Save, ArrowLeft, LayoutDashboard, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: () => (
    <AppShell back={{ to: "/dashboard", label: "Dashboard" }}>
      <Settings />
    </AppShell>
  ),
});

function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setProfile(data ?? { user_id: user.id });
      if (data?.logo_url) {
        const { data: signed } = await supabase.storage.from("logos").createSignedUrl(data.logo_url, 3600);
        setLogoUrl(signed?.signedUrl ?? null);
      }
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const payload = {
      user_id: user.id,
      business_name: profile.business_name || null,
      full_name: profile.full_name || null,
      tagline: profile.tagline || null,
      contact_email: profile.contact_email || null,
      contact_phone: profile.contact_phone || null,
      logo_url: profile.logo_url || null,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const upload = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/logo.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) return toast.error(error.message);
    const { data: signed } = await supabase.storage.from("logos").createSignedUrl(path, 3600);
    setLogoUrl(signed?.signedUrl ?? null);
    setProfile({ ...profile, logo_url: path });
    toast.success("Logo uploaded — don't forget to save");
  };

  if (!profile) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <div className="flex items-center gap-1 text-sm">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <Link
            to="/clients"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Users className="h-3.5 w-3.5" /> Clients
          </Link>
        </div>
      </div>

      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Settings</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight">PDF branding</h1>
        <p className="mt-2 text-muted-foreground">Appears on every workout plan PDF you export.</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <Label className="mb-3 block">Logo</Label>
        <div className="flex items-center gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-border bg-background">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No logo</span>}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Upload logo
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">PNG or JPG, square works best.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
        <Field label="Business name" value={profile.business_name ?? ""} onChange={(v) => setProfile({ ...profile, business_name: v })} />
        <Field label="Your name" value={profile.full_name ?? ""} onChange={(v) => setProfile({ ...profile, full_name: v })} />
        <Field label="Tagline" value={profile.tagline ?? ""} onChange={(v) => setProfile({ ...profile, tagline: v })} />
        <Field label="Contact email" type="email" value={profile.contact_email ?? ""} onChange={(v) => setProfile({ ...profile, contact_email: v })} />
        <Field label="Contact phone" value={profile.contact_phone ?? ""} onChange={(v) => setProfile({ ...profile, contact_phone: v })} />
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>
          <Save className="mr-2 h-4 w-4" /> Save changes
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}