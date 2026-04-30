import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import Stripe from "stripe";

const FORGE_PRO_PRICE = "price_1TRsCfAS79xThsnazEGqCjzf";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2025-08-27.basil" as any });
}

function getOrigin(): string {
  const origin = getRequestHeader("origin") ?? getRequestHeader("referer");
  if (origin) return origin.replace(/\/$/, "").split("/").slice(0, 3).join("/");
  return "https://forge.lovable.app";
}

/* ------------------------------------------------------------------ */
/*  createCheckout — kicks off Stripe Checkout for Forge Pro          */
/* ------------------------------------------------------------------ */
export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const stripe = getStripe();

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    if (!email) throw new Error("User email not found");

    // Reuse existing customer if any
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customerId = existing.data[0]?.id;

    const origin = getOrigin();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [{ price: FORGE_PRO_PRICE, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
    });

    return { url: session.url };
  });

/* ------------------------------------------------------------------ */
/*  checkSubscription — refreshes subscribers row from Stripe          */
/* ------------------------------------------------------------------ */
export const checkSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const stripe = getStripe();

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    if (!email) throw new Error("User email not found");

    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];

    let subscribed = false;
    let status: string | null = null;
    let periodEnd: string | null = null;
    let customerId: string | null = customer?.id ?? null;

    if (customer) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 1,
      });
      const s = subs.data[0];
      if (s) {
        status = s.status;
        subscribed = s.status === "active" || s.status === "trialing";
        periodEnd = new Date((s as any).current_period_end * 1000).toISOString();
      }
    }

    // Read existing trial_end so a Stripe re-sync doesn't wipe it
    const { data: existing } = await supabaseAdmin
      .from("subscribers")
      .select("trial_end")
      .eq("user_id", userId)
      .maybeSingle();

    await supabaseAdmin
      .from("subscribers")
      .upsert(
        {
          user_id: userId,
          email,
          subscribed,
          subscription_status: status,
          stripe_customer_id: customerId,
          current_period_end: periodEnd,
          trial_end: existing?.trial_end ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    return {
      subscribed,
      status,
      currentPeriodEnd: periodEnd,
      trialEnd: existing?.trial_end ?? null,
    };
  });

/* ------------------------------------------------------------------ */
/*  customerPortal — Stripe self-service portal                        */
/* ------------------------------------------------------------------ */
export const customerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const stripe = getStripe();

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    if (!email) throw new Error("User email not found");

    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) throw new Error("No Stripe customer yet — start a subscription first.");

    const origin = getOrigin();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin}/billing`,
    });
    return { url: portal.url };
  });

/* ------------------------------------------------------------------ */
/*  getAccessStatus — used by AppShell + plan generator                */
/* ------------------------------------------------------------------ */
export const getAccessStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: row } = await supabaseAdmin
      .from("subscribers")
      .select("subscribed, subscription_status, trial_end, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();

    const now = Date.now();
    const trialActive = !!(row?.trial_end && new Date(row.trial_end).getTime() > now);
    const subActive =
      !!row?.subscribed &&
      (!row?.current_period_end || new Date(row.current_period_end).getTime() > now);
    const hasAccess = trialActive || subActive;

    let trialDaysLeft: number | null = null;
    if (trialActive && row?.trial_end) {
      trialDaysLeft = Math.max(
        0,
        Math.ceil((new Date(row.trial_end).getTime() - now) / 86400000),
      );
    }

    return {
      hasAccess,
      trialActive,
      trialDaysLeft,
      subscribed: !!row?.subscribed,
      subscriptionStatus: row?.subscription_status ?? null,
      currentPeriodEnd: row?.current_period_end ?? null,
    };
  });