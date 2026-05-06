/**
 * R71 — Pricing source-of-truth shared by landing + billing.
 *
 * EUR-only (Core memory). USD/BTC are display-only via PriceTag.
 * Annual = monthly × 10 → ~16.6% discount (we round to "−17%" / "2 meses
 * grátis" for the UI chip, which is the real number).
 *
 * Quotas mirror Core memory: clients cap == plan-generations cap.
 */
export type Billing = "monthly" | "annual";
export type TierId = "starter" | "pro" | "studio";

export interface PricingTier {
  id: TierId;
  name: string;
  monthly: number;
  annual: number;
  clients: number;
  plansPerMonth: number;
  popular?: boolean;
}

export const ANNUAL_DISCOUNT_PCT = 17;

export const PRICING_TIERS: PricingTier[] = [
  { id: "starter", name: "Starter", monthly: 19, annual: 190, clients: 8, plansPerMonth: 8 },
  { id: "pro", name: "Pro", monthly: 45, annual: 450, clients: 25, plansPerMonth: 30, popular: true },
  { id: "studio", name: "Oficina", monthly: 119, annual: 1190, clients: 60, plansPerMonth: 80 },
];

export function priceFor(tier: PricingTier, billing: Billing): number {
  return billing === "annual" ? tier.annual : tier.monthly;
}

export function monthlyEquivalent(tier: PricingTier, billing: Billing): number {
  if (billing === "monthly") return tier.monthly;
  return Math.round((tier.annual / 12) * 10) / 10;
}