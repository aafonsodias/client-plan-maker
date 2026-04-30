import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import Stripe from "stripe";

/* ------------------------------------------------------------------ */
/*  Tier catalog — kept in sync with Stripe products                   */
/* ------------------------------------------------------------------ */
export const TIERS = {
  starter: {
    id: "starter" as const,
    name: "Forge Starter",
    monthlyPrice: "price_1TS4OHAS79xThsnaDQ4x8n8B",
    yearlyPrice: "price_1TS4OgAS79xThsnaWDJR5pKJ",
    monthlyAmount: 19,
    yearlyAmount: 190,
    clientsCap: 10,
    plansCap: 5,
    premiumIncluded: 0,
    premiumOveragePrice: 1.5,
    seats: 1,
  },
  pro: {
    id: "pro" as const,
    name: "Forge Pro",
    monthlyPrice: "price_1TS4OyAS79xThsnaGZf6ca2o",
    yearlyPrice: "price_1TS4PNAS79xThsnaI5O4LieY",
    monthlyAmount: 49,
    yearlyAmount: 490,
    clientsCap: 40,
    plansCap: 20,
    premiumIncluded: 3,
    premiumOveragePrice: 1.2,
    seats: 1,
  },
  studio: {
    id: "studio" as const,
    name: "Forge Studio",
    monthlyPrice: "price_1TS4PmAS79xThsnaNQaPnpvj",
    yearlyPrice: "price_1TS4Q6AS79xThsnalHmNlG2p",
    monthlyAmount: 129,
    yearlyAmount: 1290,
    clientsCap: null, // unlimited
    plansCap: 80,
    premiumIncluded: 10,
    premiumOveragePrice: 1.0,
    seats: 5,
  },
} as const;

export const TOPUP_PREMIUM_PACK = {
  priceId: "price_1TS4QQAS79xThsnaxBf8YWur",
  amount: 15,
  escalations: 10,
};

// Legacy price (Forge Pro v1 €29) — still honored as "pro"
const LEGACY_PRO_PRICE = "price_1TRsCfAS79xThsnazEGqCjzf";

type TierId = keyof typeof TIERS;
type Interval = "month" | "year";

function priceToTier(priceId: string | null | undefined): TierId | null {
  if (!priceId) return null;
  if (priceId === LEGACY_PRO_PRICE) return "pro";
  for (const t of Object.values(TIERS)) {
    if (t.monthlyPrice === priceId || t.yearlyPrice === priceId) return t.id;
  }
  return null;
}

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
  .inputValidator(
    (input: { tier?: TierId; interval?: Interval } | undefined) => ({
      tier: (input?.tier ?? "pro") as TierId,
      interval: (input?.interval ?? "month") as Interval,
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const stripe = getStripe();

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    if (!email) throw new Error("User email not found");

    const tierConfig = TIERS[data.tier];
    if (!tierConfig) throw new Error(`Unknown tier: ${data.tier}`);
    const priceId =
      data.interval === "year" ? tierConfig.yearlyPrice : tierConfig.monthlyPrice;

    // Reuse existing customer if any
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customerId = existing.data[0]?.id;

    const origin = getOrigin();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { tier: data.tier, interval: data.interval, user_id: userId },
      },
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
    });

    return { url: session.url };
  });

/* ------------------------------------------------------------------ */
/*  createTopupCheckout — one-time premium pack                        */
/* ------------------------------------------------------------------ */
export const createTopupCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const stripe = getStripe();

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    if (!email) throw new Error("User email not found");

    const existing = await stripe.customers.list({ email, limit: 1 });
    const customerId = existing.data[0]?.id;

    const origin = getOrigin();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [{ price: TOPUP_PREMIUM_PACK.priceId, quantity: 1 }],
      mode: "payment",
      payment_intent_data: {
        metadata: {
          kind: "premium_topup",
          escalations: String(TOPUP_PREMIUM_PACK.escalations),
          user_id: userId,
        },
      },
      success_url: `${origin}/billing?topup=success`,
      cancel_url: `${origin}/billing?topup=cancelled`,
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
    let tier: TierId | null = null;
    let interval: Interval | null = null;

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
        const item = s.items.data[0];
        const priceId = item?.price?.id ?? null;
        tier = priceToTier(priceId);
        interval =
          (item?.price?.recurring?.interval as Interval | undefined) ?? null;
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
          subscription_tier: tier,
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
      tier,
      interval,
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
      .select("subscribed, subscription_status, subscription_tier, trial_end, current_period_end")
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
      tier: (row?.subscription_tier as TierId | null) ?? null,
      currentPeriodEnd: row?.current_period_end ?? null,
    };
  });