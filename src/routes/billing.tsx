import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { Check, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

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

const TIERS: TierCard[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Para PTs a validar o Forge",
    monthly: 19,
    yearly: 190,
    features: [
      "Até 10 clientes",
      "5 planos AI / mês",
      "Intake & PDFs com a tua marca",
      "Sem escalações premium incluídas (€1,50 cada)",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Para PTs com 20–40 clientes activos",
    monthly: 49,
    yearly: 490,
    highlight: true,
    features: [
      "Até 40 clientes",
      "20 planos AI / mês",
      "3 escalações premium incluídas",
      "Partilha WhatsApp + check-ins",
      "Digest semanal de Segunda",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "Estúdios e equipas até 5 PTs",
    monthly: 129,
    yearly: 1290,
    features: [
      "Clientes ilimitados",
      "80 planos AI / mês",
      "10 escalações premium incluídas",
      "5 lugares de PT",
      "Suporte prioritário",
    ],
  },
];

function BillingPage() {
  const { checkout, topup } = Route.useSearch();
  useNavigate();
  const { user } = useAuth();
  const checkoutFn = useServerFn(createCheckout);
  const topupFn = useServerFn(createTopupCheckout);
  const portalFn = useServerFn(customerPortal);
  const refreshFn = useServerFn(checkSubscription);
  const [access, setAccess] = useState<Access | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>("month");

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
          toast.success("Bem-vindo ao Forge!");
        }
        if (topup === "success") {
          toast.success("Pack premium adicionado.");
        }
        const a = await loadAccess();
        if (!cancelled) setAccess(a);
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao carregar billing");
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
      toast.error(e?.message ?? "Checkout falhou");
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setBusy("portal");
    try {
      const { url } = await portalFn();
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Portal falhou");
      setBusy(null);
    }
  };

  const handleTopup = async () => {
    setBusy("topup");
    try {
      const { url } = await topupFn();
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Top-up falhou");
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setBusy("refresh");
    try {
      await refreshFn();
      const a = await loadAccess();
      setAccess(a);
      toast.success("Estado actualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "Refresh falhou");
    } finally {
      setBusy(null);
    }
  };

  const currentTier = access?.tier ?? null;
  const yearlySavings = useMemo(() => "17% off · 2 meses grátis", []);

  return (
    <AppShell back={{ to: "/dashboard", label: "Voltar ao dashboard" }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Billing</p>
          <h1 className="mt-1 text-2xl font-semibold">A tua subscrição</h1>
        </div>

        {/* Current status */}
        <div className="rounded-lg border border-border bg-card p-5">
          {access === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
            </div>
          ) : access.subscribed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Check className="h-4 w-4 text-emerald-500" />{" "}
                {currentTier
                  ? `Forge ${currentTier[0].toUpperCase() + currentTier.slice(1)} — activo`
                  : "Forge — activo"}
              </div>
              {access.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground">
                  Renova a {new Date(access.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : access.trialActive ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Trial — {access.trialDaysLeft} dia{access.trialDaysLeft === 1 ? "" : "s"} restante
                {access.trialDaysLeft === 1 ? "" : "s"}
              </div>
              <p className="text-xs text-muted-foreground">
                Subscreve para continuar a gerar planos sem interrupções.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-destructive">
                Trial terminada — geração de planos pausada
              </div>
              <p className="text-xs text-muted-foreground">
                Escolhe um plano abaixo para retomar.
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
              Mensal
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
              Anual
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
            const suffix = interval === "year" ? "/ano" : "/mês";
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
              <h3 className="mt-1 text-lg font-semibold">10 escalações premium — €15</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Top-up one-time. Usa quando precisares do nosso modelo mais inteligente
                (Claude Sonnet) para casos complexos. Válido até ao fim do próximo ciclo.
              </p>
            </div>
            <Button onClick={handleTopup} disabled={busy !== null} variant="outline">
              {busy === "topup" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Comprar pack
            </Button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={busy !== null}>
            {busy === "refresh" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Actualizar estado
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
