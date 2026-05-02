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
import { Check, Loader2, Sparkles, Zap, Info, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
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
    tagline: "Para PTs com até 8 clientes activos",
    monthly: 19,
    yearly: 190,
    features: [
      "Até 8 clientes activos",
      "8 gerações de plano / mês",
      "1 escalação premium incluída",
      "Intake & PDFs com a tua marca",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Para PTs com 10–25 clientes activos",
    monthly: 45,
    yearly: 450,
    highlight: true,
    features: [
      "Até 25 clientes activos",
      "30 gerações de plano / mês",
      "4 escalações premium incluídas",
      "Partilha WhatsApp + check-ins",
      "Digest semanal de Segunda",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "Estúdios e equipas (até 5 PTs)",
    monthly: 119,
    yearly: 1190,
    features: [
      "Até 60 clientes activos no total",
      "80 gerações de plano / mês",
      "12 escalações premium incluídas",
      "5 lugares de PT",
      "Suporte prioritário",
    ],
  },
];

/** Honest FAQ items shown directly under the tier cards — surfaces the truth
 *  about quotas, retention, and overage so PTs don't feel ambushed. */
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "O que conta como uma “geração de plano”?",
    a: "Uma geração = um novo mesociclo de 4 semanas (Brief + Blueprint + Microciclo + Progressões) para um cliente. Editares manualmente, voltar a correr só as progressões, ou re-printar o PDF NÃO conta como nova geração.",
  },
  {
    q: "Como conta um “cliente activo”?",
    a: "Activo = qualquer cliente com pelo menos uma sessão registada nos últimos 60 dias OU um plano gerado nos últimos 60 dias. Clientes inactivos ficam guardados mas não contam para o limite — quando voltarem a treinar, voltam a contar.",
  },
  {
    q: "E se ultrapassar as gerações no mês?",
    a: "Avisamos-te ao chegares a 80%. Podes comprar packs avulso (10 gerações por €12) ou esperar pelo dia 1 do próximo ciclo. Nunca cobramos sem confirmação.",
  },
  {
    q: "Porque é que a “escalação premium” custa €1,50?",
    a: "Escalação premium = corremos o teu plano com o nosso modelo mais sofisticado (Claude Sonnet) para casos com red flags ou periodização complexa. €1,50 cobre o custo do modelo + ~30% de margem para infra e suporte.",
  },
  {
    q: "O que acontece aos dados dos meus clientes?",
    a: "Guardados na UE com encriptação. Podes exportar tudo em JSON ou apagar qualquer cliente a qualquer momento, em Definições. Se cancelares a subscrição, mantemos os dados 90 dias para te permitir reactivar; depois disso são apagados.",
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
      toast.success("Subscrição actualizada");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível verificar a subscrição");
    } finally {
      setBusy(null);
    }
  };

  const currentTier = access?.tier ?? null;
  const yearlySavings = useMemo(() => "17% off · 2 meses grátis", []);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <AppShell back={{ to: "/dashboard", label: "Voltar ao dashboard" }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Billing</p>
          <h1 className="mt-1 text-2xl font-semibold">A tua subscrição</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Preço por <span className="text-foreground">clientes activos + gerações de plano</span> — um cliente que treina sempre o mesmo mesociclo
            <span className="italic"> não </span>conta como geração nova. Sem letras pequenas.
          </p>
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
