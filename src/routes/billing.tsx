import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  createCheckout,
  createTopupCheckout,
  customerPortal,
  checkSubscription,
} from "@/server/billing.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Check, Loader2, Sparkles, Zap, Info, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/billing")({
  component: BillingPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { checkout?: "success" | "cancelled"; topup?: "success" | "cancelled" } => {
    const out: { checkout?: "success" | "cancelled"; topup?: "success" | "cancelled" } = {};
    if (search.checkout === "success" || search.checkout === "cancelled")
      out.checkout = search.checkout;
    if (search.topup === "success" || search.topup === "cancelled")
      out.topup = search.topup;
    return out;
  },
});

type TierId = "starter" | "pro" | "studio";
type Interval = "month" | "year";

type Access = {
  hasAccess: boolean;
  trialActive: boolean;
  trialDaysLeft: number | null;
  subscribed: boolean;
  subscriptionStatus: string | null;
  tier: TierId | null;
  currentPeriodEnd: string | null;
};

type TierCard = {
  id: TierId;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  features: string[];
  highlight?: boolean;
};

function BillingPage() {
  const { checkout, topup } = Route.useSearch();
  const { t } = useTranslation("common");
  useNavigate();
  const { user } = useAuth();
  const checkoutFn = useServerFn(createCheckout);
  const topupFn = useServerFn(createTopupCheckout);
  const portalFn = useServerFn(customerPortal);
  const refreshFn = useServerFn(checkSubscription);
  const [access, setAccess] = useState<Access | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>("month");

  const TIERS: TierCard[] = useMemo(() => [
    {
      id: "starter", name: "Starter", tagline: t("billing.tier_starter_tagline"),
      monthly: 19, yearly: 190,
      features: [
        t("billing.feat_starter_clients"),
        t("billing.feat_starter_plans"),
        t("billing.feat_starter_premium"),
        t("billing.feat_brand"),
      ],
    },
    {
      id: "pro", name: "Pro", tagline: t("billing.tier_pro_tagline"),
      monthly: 45, yearly: 450, highlight: true,
      features: [
        t("billing.feat_pro_clients"),
        t("billing.feat_pro_plans"),
        t("billing.feat_pro_premium"),
        t("billing.feat_pro_share"),
        t("billing.feat_pro_digest"),
      ],
    },
    {
      id: "studio", name: "Studio", tagline: t("billing.tier_studio_tagline"),
      monthly: 119, yearly: 1190,
      features: [
        t("billing.feat_studio_clients"),
        t("billing.feat_studio_plans"),
        t("billing.feat_studio_premium"),
        t("billing.feat_studio_seats"),
        t("billing.feat_studio_support"),
      ],
    },
  ], [t]);

  const FAQ_ITEMS = useMemo(() => [
    { q: t("billing.faq_q1"), a: t("billing.faq_a1") },
    { q: t("billing.faq_q2"), a: t("billing.faq_a2") },
    { q: t("billing.faq_q3"), a: t("billing.faq_a3") },
    { q: t("billing.faq_q4"), a: t("billing.faq_a4") },
    { q: t("billing.faq_q5"), a: t("billing.faq_a5") },
  ], [t]);

  const loadAccess = async (): Promise<Access | null> => {
    if (!user) return null;
    const { data: row } = await supabase
      .from("subscribers")
      .select(
        "subscribed, subscription_status, subscription_tier, trial_end, current_period_end",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    const now = Date.now();
    const trialActive = !!(row?.trial_end && new Date(row.trial_end).getTime() > now);
    const subActive =
      !!row?.subscribed &&
      (!row?.current_period_end || new Date(row.current_period_end).getTime() > now);
    return {
      hasAccess: trialActive || subActive,
      trialActive,
      trialDaysLeft:
        trialActive && row?.trial_end
          ? Math.max(0, Math.ceil((new Date(row.trial_end).getTime() - now) / 86400000))
          : null,
      subscribed: !!row?.subscribed,
      subscriptionStatus: row?.subscription_status ?? null,
      tier: (row?.subscription_tier as TierId | null) ?? null,
      currentPeriodEnd: row?.current_period_end ?? null,
    };
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        if (checkout === "success") {
          await refreshFn();
          toast.success(t("billing.welcome_toast"));
        }
        if (topup === "success") {
          toast.success(t("billing.topup_added"));
        }
        const a = await loadAccess();
        if (!cancelled) setAccess(a);
      } catch (e: any) {
        toast.error(e?.message ?? t("billing.load_failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubscribe = async (tier: TierId) => {
    setBusy(`checkout-${tier}`);
    try {
      const { url } = await checkoutFn({ data: { tier, interval } });
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? t("billing.checkout_failed"));
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setBusy("portal");
    try {
      const { url } = await portalFn();
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? t("billing.portal_failed"));
      setBusy(null);
    }
  };

  const handleTopup = async () => {
    setBusy("topup");
    try {
      const { url } = await topupFn();
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? t("billing.topup_failed"));
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setBusy("refresh");
    try {
      await refreshFn();
      const a = await loadAccess();
      setAccess(a);
      toast.success(t("billing.refresh_ok"));
    } catch (e: any) {
      toast.error(e?.message ?? t("billing.refresh_failed"));
    } finally {
      setBusy(null);
    }
  };

  const currentTier = access?.tier ?? null;
  const yearlySavings = t("billing.yearly_savings");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <AppShell back={{ to: "/dashboard", label: t("billing.back_to_dashboard") }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Billing</p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">{t("billing.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("billing.subtitle_1")}<span className="text-foreground">{t("billing.subtitle_strong")}</span>{t("billing.subtitle_2")}
            <span className="italic"> {t("billing.subtitle_em")} </span>{t("billing.subtitle_3")}
          </p>
        </div>

        {/* Current status */}
        <div className="rounded-lg border border-border bg-card p-5">
          {access === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("billing.loading")}
            </div>
          ) : access.subscribed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Check className="h-4 w-4 text-emerald-500" />{" "}
                {currentTier
                  ? t("billing.active_tier", { tier: currentTier[0].toUpperCase() + currentTier.slice(1) })
                  : t("billing.active_generic")}
              </div>
              {access.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground">
                  {t("billing.renews_on", { date: new Date(access.currentPeriodEnd).toLocaleDateString() })}
                </p>
              )}
            </div>
          ) : access.trialActive ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {t("billing.trial_label")} — {access.trialDaysLeft === 1
                  ? t("billing.trial_days", { n: 1 })
                  : t("billing.trial_days_plural", { n: access.trialDaysLeft ?? 0 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("billing.trial_hint")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-destructive">
                {t("billing.trial_ended_title")}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("billing.trial_ended_hint")}
              </p>
            </div>
          )}
        </div>

        {/* Interval toggle */}
        <div className="flex items-center justify-center gap-3">
          <div className="inline-flex rounded-full border border-border bg-card p-1 text-sm">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={`rounded-full px-4 py-1.5 transition ${
                interval === "month"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("billing.monthly")}
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={`rounded-full px-4 py-1.5 transition ${
                interval === "year"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("billing.yearly")}
            </button>
          </div>
          {interval === "year" && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {yearlySavings}
            </span>
          )}
        </div>

        {/* Tier cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => {
            const isCurrent = currentTier === t.id;
            const price = interval === "year" ? t.yearly : t.monthly;
            const suffix = interval === "year" ? this_t("billing.per_year") : this_t("billing.per_month");
            const monthlyEquiv =
              interval === "year" ? Math.round((t.yearly / 12) * 10) / 10 : null;
            return (
              <div
                key={t.id}
                className={`relative rounded-lg border bg-card p-6 ${
                  t.highlight ? "border-accent/60 shadow-lg" : "border-border"
                }`}
              >
                {t.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-foreground">
                    Mais popular
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-accent">
                  <Sparkles className="h-3.5 w-3.5" /> Forge {t.name}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.tagline}</p>
                <div className="mt-4">
                  <span className="text-4xl font-semibold">€{price}</span>
                  <span className="text-sm text-muted-foreground">{suffix}</span>
                  {monthlyEquiv !== null && (
                    <p className="text-xs text-muted-foreground">
                      ≈ €{monthlyEquiv}/mês
                    </p>
                  )}
                </div>
                <ul className="mt-5 space-y-2 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <Button
                      onClick={handlePortal}
                      disabled={busy !== null}
                      className="w-full"
                      variant="outline"
                    >
                      {busy === "portal" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Plano actual — gerir
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(t.id)}
                      disabled={busy !== null}
                      className="w-full"
                      variant={t.highlight ? "default" : "outline"}
                    >
                      {busy === `checkout-${t.id}` ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {access?.subscribed ? "Mudar para este plano" : `Subscrever`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Top-up pack */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-accent">
                <Zap className="h-3.5 w-3.5" /> Pack Premium
              </div>
              <h3 className="mt-1 text-lg font-semibold">10 escalações premium — €12</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Top-up avulso. Usa quando precisares do nosso modelo mais sofisticado (Claude Sonnet)
                para casos com red flags ou periodização complexa. Custo cobre o modelo + ~30% de margem.
                Válido até ao fim do próximo ciclo.
              </p>
            </div>
            <Button onClick={handleTopup} disabled={busy !== null} variant="outline">
              {busy === "topup" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Comprar pack
            </Button>
          </div>
        </div>

        {/* Honest FAQ */}
        <div className="rounded-lg border border-border bg-card/60 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Info className="h-3.5 w-3.5" /> Perguntas honestas
          </div>
          <ul className="divide-y divide-border/60">
            {FAQ_ITEMS.map((item, i) => {
              const open = openFaq === i;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm text-foreground hover:text-accent"
                  >
                    <span className="font-medium">{item.q}</span>
                    {open ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {open && (
                    <p className="pb-3 pr-8 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={busy !== null}
            title="Sincroniza o estado da tua subscrição com o Stripe"
          >
            {busy === "refresh" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verificar subscrição
          </Button>
          {checkout === "cancelled" && (
            <p className="text-xs text-muted-foreground">
              Checkout cancelado — sem cobrança.
            </p>
          )}
          {topup === "cancelled" && (
            <p className="text-xs text-muted-foreground">
              Pack cancelado — sem cobrança.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Pagamentos seguros via Stripe. Cancela a qualquer momento no portal.
        </p>
      </div>
    </AppShell>
  );
}
