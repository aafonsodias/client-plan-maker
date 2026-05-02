import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createCheckout } from "@/server/billing.functions";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type TierId = "starter" | "pro" | "studio";
type Interval = "month" | "year";

type Tier = {
  id: TierId;
  name: string;
  monthly: number;
  yearly: number;
  highlight?: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 19,
    yearly: 190,
    features: ["8 clientes activos", "8 planos/mês", "1 escalação premium"],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 45,
    yearly: 450,
    highlight: true,
    features: ["25 clientes activos", "30 planos/mês", "4 escalações premium", "Digest semanal"],
  },
  {
    id: "studio",
    name: "Studio",
    monthly: 119,
    yearly: 1190,
    features: ["60 clientes activos", "80 planos/mês", "5 lugares de PT"],
  },
];

export function PaywallDialog({
  open,
  onOpenChange,
  reason = "quota",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: "quota" | "trial_ended";
}) {
  const checkoutFn = useServerFn(createCheckout);
  const [interval, setInterval] = useState<Interval>("month");
  const [busy, setBusy] = useState<TierId | null>(null);

  const subscribe = async (tier: TierId) => {
    setBusy(tier);
    try {
      const { url } = await checkoutFn({ data: { tier, interval } });
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout falhou");
      setBusy(null);
    }
  };

  const title =
    reason === "trial_ended"
      ? "O teu trial terminou"
      : "Atingiste o limite do plano gratuito";
  const subtitle =
    reason === "trial_ended"
      ? "Subscreve para continuar a gerar planos sem interrupções."
      : "Contas gratuitas geram 1 plano. Subscreve para continuar.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-2">
          <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={`rounded-full px-3 py-1 transition ${
                interval === "month"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={`rounded-full px-3 py-1 transition ${
                interval === "year"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
            >
              Anual
            </button>
          </div>
          {interval === "year" && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              -2 meses
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {TIERS.map((t) => {
            const price = interval === "year" ? t.yearly : t.monthly;
            const suffix = interval === "year" ? "/ano" : "/mês";
            return (
              <div
                key={t.id}
                className={`relative rounded-lg border bg-card p-4 ${
                  t.highlight ? "border-accent/60 shadow" : "border-border"
                }`}
              >
                {t.highlight && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-accent-foreground">
                    Popular
                  </div>
                )}
                <div className="text-xs font-bold uppercase tracking-widest text-accent">
                  {t.name}
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-semibold">€{price}</span>
                  <span className="text-xs text-muted-foreground">{suffix}</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant={t.highlight ? "default" : "outline"}
                  className="mt-4 w-full"
                  disabled={busy !== null}
                  onClick={() => subscribe(t.id)}
                >
                  {busy === t.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Subscrever
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between pt-2 text-xs text-muted-foreground">
          <Link to="/billing" className="hover:text-foreground underline-offset-2 hover:underline">
            Ver detalhes completos
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="hover:text-foreground"
          >
            Agora não
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}