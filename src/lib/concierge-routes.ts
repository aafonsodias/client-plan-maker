/**
 * Compact map of app routes for the in-app Concierge AI.
 * Hand-curated so the model gets a clean menu rather than a noisy auto-scan.
 */

export type RouteHint = {
  path: string;
  label: string;
  what: string;
};

export const CONCIERGE_ROUTES: RouteHint[] = [
  { path: "/dashboard", label: "Dashboard", what: "Overview of your clients, recent plans, and onboarding checklist." },
  { path: "/clients", label: "Clients", what: "List of all clients. Add a new one, or click to open their assessment." },
  { path: "/plans", label: "Plans", what: "Library of every plan you've generated. Open one to view, edit, log, or share." },
  { path: "/plans/new", label: "New plan", what: "Manual plan builder for trainers who want to skip the AI flow." },
  { path: "/billing", label: "Billing", what: "Manage your subscription, view trial status, upgrade tier." },
  { path: "/settings", label: "Settings", what: "Profile, branding (logo, colour, business name), and language." },
  { path: "/manual", label: "Manual", what: "Trainer manual: how the 5-stage AI pipeline works (Brief, Blueprint, Microcycle, Progressions, Bulk-fill)." },
];

export function buildRouteContext(): string {
  return CONCIERGE_ROUTES
    .map((r) => `- ${r.path} — ${r.label}: ${r.what}`)
    .join("\n");
}