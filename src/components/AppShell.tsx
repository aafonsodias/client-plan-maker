import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Home, Users, Settings, LogOut, ArrowLeft, ExternalLink, CreditCard, AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children, back }: { children: ReactNode; back?: { to: string; label?: string } }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("common");
  const [access, setAccess] = useState<{
    hasAccess: boolean;
    trialActive: boolean;
    trialDaysLeft: number | null;
    subscribed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("subscribers")
        .select("subscribed, subscription_status, trial_end, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const now = Date.now();
      const trialActive = !!(row?.trial_end && new Date(row.trial_end).getTime() > now);
      const subActive =
        !!row?.subscribed &&
        (!row?.current_period_end || new Date(row.current_period_end).getTime() > now);
      const hasAccess = trialActive || subActive;
      const trialDaysLeft =
        trialActive && row?.trial_end
          ? Math.max(0, Math.ceil((new Date(row.trial_end).getTime() - now) / 86400000))
          : null;
      setAccess({ hasAccess, trialActive, trialDaysLeft, subscribed: !!row?.subscribed });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("actions.loading")}</div>;
  }

  const nav = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: Home },
    { to: "/clients", label: t("nav.clients"), icon: Users },
    { to: "/settings", label: t("nav.branding"), icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-light tracking-[0.2em] uppercase text-sm">
            <Logo className="h-8 w-8" />
            <span>{t("brand.name")}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = location.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Button asChild variant="ghost" size="sm" title={t("nav.billing")}>
              <Link to="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{t("nav.billing")}</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" title={t("nav.landing")}>
              <Link to="/">
                <ExternalLink className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{t("nav.landing")}</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { void signOut().then(() => navigate({ to: "/" })); }}>
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{t("actions.sign_out")}</span>
            </Button>
          </div>
        </div>
      </header>
      {access && !access.subscribed && (access.trialActive || !access.hasAccess) && (
        <div
          className={`border-b ${
            access.hasAccess
              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-2 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {access.hasAccess
                  ? t("shell.trial_days_left", { count: access.trialDaysLeft ?? 0 })
                  : t("shell.trial_ended")}
              </span>
            </div>
            <Button asChild size="sm" variant={access.hasAccess ? "outline" : "default"}>
              <Link to="/billing">{t("actions.upgrade")}</Link>
            </Button>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-6 py-6">
        {back && location.pathname !== "/dashboard" && (
          <button
            onClick={() => navigate({ to: back.to as any })}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {back.label ?? t("actions.back")}
          </button>
        )}
        {children}
      </main>
      <ScrollToTopButton />
    </div>
  );
}