import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  createCheckout,
  customerPortal,
  checkSubscription,
} from "@/server/billing.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing")({
  component: BillingPage,
  validateSearch: (search: Record<string, unknown>): { checkout?: "success" | "cancelled" } => {
    const c = search.checkout;
    if (c === "success" || c === "cancelled") return { checkout: c };
    return {};
  },
});

type Access = {
  hasAccess: boolean;
  trialActive: boolean;
  trialDaysLeft: number | null;
  subscribed: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
};

function BillingPage() {
  const { checkout } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const checkoutFn = useServerFn(createCheckout);
  const portalFn = useServerFn(customerPortal);
  const refreshFn = useServerFn(checkSubscription);
  const [access, setAccess] = useState<Access | null>(null);
  const [busy, setBusy] = useState<"checkout" | "portal" | "refresh" | null>(null);

  const loadAccess = async (): Promise<Access | null> => {
    if (!user) return null;
    const { data: row } = await supabase
      .from("subscribers")
      .select("subscribed, subscription_status, trial_end, current_period_end")
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
      currentPeriodEnd: row?.current_period_end ?? null,
    };
  };

  // On mount: if returning from Stripe, force a re-sync. Otherwise just read.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        if (checkout === "success") {
          await refreshFn();
          toast.success("Welcome to Forge Pro!");
        }
        const a = await loadAccess();
        if (!cancelled) setAccess(a);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load billing");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubscribe = async () => {
    setBusy("checkout");
    try {
      const { url } = await checkoutFn();
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed");
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setBusy("portal");
    try {
      const { url } = await portalFn();
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Portal failed");
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setBusy("refresh");
    try {
      await refreshFn();
      const a = await loadAccess();
      setAccess(a);
      toast.success("Subscription refreshed");
    } catch (e: any) {
      toast.error(e?.message ?? "Refresh failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell back={{ to: "/dashboard", label: "Back to dashboard" }}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Billing</p>
          <h1 className="mt-1 text-2xl font-semibold">Your subscription</h1>
        </div>

        {/* Current status */}
        <div className="rounded-lg border border-border bg-card p-5">
          {access === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : access.subscribed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Check className="h-4 w-4 text-emerald-500" /> Forge Pro — active
              </div>
              {access.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground">
                  Renews on {new Date(access.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : access.trialActive ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Free trial — {access.trialDaysLeft} day{access.trialDaysLeft === 1 ? "" : "s"} left
              </div>
              <p className="text-xs text-muted-foreground">
                Upgrade now to keep generating plans without interruption.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-destructive">
                Trial ended — plan generation is paused
              </div>
              <p className="text-xs text-muted-foreground">
                Subscribe to Forge Pro to resume building plans for your clients.
              </p>
            </div>
          )}
        </div>

        {/* Plan card */}
        <div className="rounded-lg border-2 border-accent/40 bg-card p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-accent">
                <Sparkles className="h-3.5 w-3.5" /> Forge Pro
              </div>
              <div className="mt-2">
                <span className="text-4xl font-semibold">€29</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
            </div>
          </div>
          <ul className="mt-5 space-y-2 text-sm">
            {[
              "Unlimited AI-generated plans",
              "Unlimited clients & sessions",
              "Branded intake forms & PDFs",
              "WhatsApp share + check-in",
              "Weekly Monday digest",
              "Cancel anytime",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-2">
            {access?.subscribed ? (
              <Button onClick={handlePortal} disabled={busy !== null}>
                {busy === "portal" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Manage subscription
              </Button>
            ) : (
              <Button onClick={handleSubscribe} disabled={busy !== null}>
                {busy === "checkout" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Subscribe — €29/mo
              </Button>
            )}
            <Button variant="outline" onClick={handleRefresh} disabled={busy !== null}>
              {busy === "refresh" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh status
            </Button>
            {checkout === "cancelled" && (
              <p className="w-full text-xs text-muted-foreground">
                Checkout was cancelled — no charge made.
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Secure payments by Stripe. Cancel anytime from the billing portal.
        </p>
      </div>
    </AppShell>
  );
}