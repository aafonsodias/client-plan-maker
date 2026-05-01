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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-10 flex flex-col items-center justify-center gap-3"
          aria-label={t("brand.name")}
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full blur-2xl opacity-60"
              style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
            />
            <Logo className="h-16 w-16 drop-shadow-[0_0_18px_color-mix(in_oklab,var(--accent)_45%,transparent)]" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="h-px w-10 bg-accent/70" />
            <span className="text-sm font-light uppercase tracking-[0.45em] text-foreground/90">
              {t("brand.name")}
            </span>
          </div>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-elegant)]">
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