import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useTranslation("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const redirectTo = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo, data: { full_name: fullName } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth.confirm_email_toast"));
  };

  const google = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Back to home — top-left */}
      <Link
        to="/"
        className="group absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-accent/40 hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
        {t("actions.back_to_home")}
      </Link>
      {/* Ambient platinum/fiery backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 18%, color-mix(in oklab, var(--accent) 18%, transparent) 0%, transparent 70%), radial-gradient(ellipse 80% 50% at 50% 100%, color-mix(in oklab, var(--accent) 8%, transparent) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--foreground) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="group mb-10 flex flex-col items-center justify-center gap-3"
          aria-label={t("brand.name")}
        >
          {/* Square platinum/fiery plate behind the logo. Effects live on the
              plate, not on the symbol — keeps the logo crisp. */}
          <div className="relative flex h-32 w-32 items-center justify-center">
            {/* Soft fiery glow behind the plate */}
            <div
              aria-hidden
              className="absolute inset-[-20%] -z-20 rounded-3xl blur-2xl opacity-60 animate-pulse"
              style={{
                background:
                  "radial-gradient(ellipse at center, color-mix(in oklab, var(--accent) 55%, transparent) 0%, color-mix(in oklab, var(--accent) 18%, transparent) 50%, transparent 80%)",
                animationDuration: "4.5s",
              }}
            />
            {/* Translucent platinum plate */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-2xl border border-border/40 backdrop-blur-sm"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--accent) 14%, transparent) 0%, color-mix(in oklab, var(--card) 70%, transparent) 45%, color-mix(in oklab, var(--accent) 8%, transparent) 100%)",
                boxShadow:
                  "inset 0 1px 0 0 color-mix(in oklab, white 18%, transparent), inset 0 -1px 0 0 color-mix(in oklab, var(--accent) 25%, transparent), 0 8px 32px -8px color-mix(in oklab, var(--accent) 35%, transparent)",
              }}
            />
            {/* Conic platinum sheen sweeping across the plate */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-2xl opacity-40 mix-blend-screen"
              style={{
                background:
                  "conic-gradient(from 140deg at 50% 50%, transparent 0deg, color-mix(in oklab, var(--accent) 50%, white) 80deg, transparent 160deg, color-mix(in oklab, var(--accent) 40%, white) 280deg, transparent 360deg)",
                filter: "blur(6px)",
              }}
            />
            <Logo className="relative h-16 w-16 drop-shadow-[0_0_18px_color-mix(in_oklab,var(--accent)_50%,transparent)] transition-transform duration-500 group-hover:scale-105" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="h-px w-10 bg-accent/70" />
            <span className="text-sm font-light uppercase tracking-[0.45em] text-foreground/90" style={{ paddingLeft: "0.45em" }}>
              {t("brand.name")}
            </span>
          </div>
        </Link>
        <div
          className="rounded-2xl border border-border/60 bg-card/70 p-8 shadow-[var(--shadow-elegant)] backdrop-blur-xl"
          style={{
            backgroundImage:
              "linear-gradient(180deg, color-mix(in oklab, var(--card) 80%, transparent) 0%, color-mix(in oklab, var(--card) 95%, transparent) 100%)",
          }}
        >
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t("auth.tab_signin")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.tab_signup")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="si-email">{t("auth.field_email")}</Label>
                  <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-pw">{t("auth.field_password")}</Label>
                  <Input id="si-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>{t("actions.sign_in")}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">{t("auth.field_full_name")}</Label>
                  <Input id="su-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">{t("auth.field_email")}</Label>
                  <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-pw">{t("auth.field_password")}</Label>
                  <Input id="su-pw" type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{t("auth.password_hint")}</p>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>{t("actions.sign_up")}</Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{t("actions.or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button onClick={google} variant="outline" className="w-full">
            {t("actions.continue_with_google")}
          </Button>
        </div>
        <div className="mt-8 flex justify-center opacity-60 hover:opacity-100 transition-opacity">
          <div className="scale-90">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
}