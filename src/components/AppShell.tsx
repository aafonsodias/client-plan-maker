import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Home, Users, Settings, LogOut, ArrowLeft, ExternalLink, CreditCard, AlertCircle, Menu, Globe, Check, Crown, BookOpen } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Logo } from "@/components/Logo";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LOCALES, LOCALE_STORAGE_KEY, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";

function useLocaleControls() {
  const { i18n } = useTranslation("common");
  const activeLanguage = (i18n.language ?? i18n.resolvedLanguage ?? "en").slice(0, 2);
  const current: Locale = SUPPORTED_LOCALES.includes(activeLanguage as Locale)
    ? (activeLanguage as Locale)
    : "en";
  const change = (next: Locale) => {
    if (next === current) return;
    void i18n.changeLanguage(next).then(() => {
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
        document.documentElement.lang = next;
      } catch {
        // ignore
      }
    });
  };
  return { current, change };
}

export function AppShell({ children, back }: { children: ReactNode; back?: { to: string; label?: string } }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("common");
  const { current: currentLocale, change: changeLocale } = useLocaleControls();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isFounder = (user?.email ?? "").toLowerCase() === "aafonsodias@gmail.com";
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

  const handleSignOut = () => {
    void signOut().then(() => navigate({ to: "/" }));
  };

  const primaryNav = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: Home },
    { to: "/clients", label: t("nav.clients"), icon: Users },
    { to: "/settings", label: t("nav.branding"), icon: Settings },
  ] as const;

  const secondaryNav = [
    { to: "/manual", label: t("nav.manual"), icon: BookOpen },
    { to: "/billing", label: t("nav.billing"), icon: CreditCard },
    { to: "/", label: t("nav.landing"), icon: ExternalLink },
  ] as const;

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-2.5 font-light tracking-[0.2em] uppercase text-sm"
            aria-label={t("brand.name")}
          >
            {/* Captain-seat brand mark: amber under-glow ring, unified across the app. */}
            <BrandMark size="md" />
            <span className="truncate">{t("brand.name")}</span>
            {isFounder && (
              <span
                title="Conta de fundador · acesso vitalício"
                className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-amber-400/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400"
              >
                <Crown className="h-2.5 w-2.5" />
                <span className="hidden sm:inline">Founder</span>
              </span>
            )}
          </Link>

          {/* Mobile-only locale chip — visible at-a-glance, taps the same items as desktop globe */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("language.switch_aria")}
                className="md:hidden inline-flex shrink-0 items-center rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {currentLocale}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {SUPPORTED_LOCALES.map((code) => (
                <DropdownMenuItem key={code} onSelect={() => changeLocale(code)}>
                  {currentLocale === code ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <span className="mr-2 inline-block h-4 w-4" />
                  )}
                  {code === "pt" ? t("language.portuguese") : t("language.english")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Desktop nav (≥ md) */}
          <nav className="hidden min-w-0 items-center gap-1 md:flex">
            {primaryNav.map((n) => {
              const active = isActive(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  )}
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{n.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Desktop right side (≥ md) */}
          <div className="hidden items-center gap-1 md:flex">
            {secondaryNav.map((n) => (
              <Button
                key={n.to}
                asChild
                variant="ghost"
                size="sm"
                title={n.label}
                className="min-w-0"
              >
                <Link to={n.to}>
                  <n.icon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="hidden truncate lg:inline">{n.label}</span>
                </Link>
              </Button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title={t("language.switch_aria")} aria-label={t("language.switch_aria")}>
                  <Globe className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SUPPORTED_LOCALES.map((code) => (
                  <DropdownMenuItem key={code} onSelect={() => changeLocale(code)}>
                    {currentLocale === code ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <span className="mr-2 inline-block h-4 w-4" />
                    )}
                    {code === "pt" ? t("language.portuguese") : t("language.english")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="min-w-0">
              <LogOut className="mr-2 h-4 w-4 shrink-0" />
              <span className="hidden truncate lg:inline">{t("actions.sign_out")}</span>
            </Button>
          </div>

          {/* Mobile hamburger (< md) */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[85vw] max-w-sm flex-col gap-1 p-4">
              <div className="mb-2 flex items-center gap-2 border-b border-border pb-3 font-light tracking-[0.2em] uppercase text-xs">
                <Logo className="h-7 w-7" />
                <span>{t("brand.name")}</span>
              </div>
              {[...primaryNav, ...secondaryNav].map((n) => {
                const active = isActive(n.to);
                return (
                  <SheetClose asChild key={n.to}>
                    <Link
                      to={n.to}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition",
                        active
                          ? "bg-secondary text-secondary-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                      )}
                    >
                      <n.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{n.label}</span>
                    </Link>
                  </SheetClose>
                );
              })}
              <div className="mt-2 border-t border-border pt-2">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("language.switch_aria")}
                </p>
                {SUPPORTED_LOCALES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      changeLocale(code);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                      currentLocale === code
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                    )}
                  >
                    <Globe className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {code === "pt" ? t("language.portuguese") : t("language.english")}
                    </span>
                    {currentLocale === code && <Check className="ml-auto h-4 w-4" />}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  handleSignOut();
                }}
                className="mt-2 flex items-center gap-3 rounded-md border-t border-border px-3 py-3 pt-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="truncate">{t("actions.sign_out")}</span>
              </button>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      {!isFounder && access && !access.subscribed && (access.trialActive || !access.hasAccess) && (
        <div
          className={`border-b ${
            access.hasAccess
              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6">
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
      <main className="mx-auto w-full max-w-screen-xl overflow-x-hidden px-4 py-6 sm:px-6">
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