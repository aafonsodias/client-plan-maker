/**
 * Route visibility map (R70 — Fatia 2 backbone).
 *
 * Empty for now. We populate it page-by-page as the trainer audits the app
 * in "ver como cliente" mode. Categories:
 *
 * - "trainer-only"     → in preview/client mode, redirect to /me.
 * - "client-visible"   → identical to trainer view; safe as-is.
 * - "shared-readonly"  → same route, but components read `useViewAs()` to
 *                        hide trainer chrome (costs, AI, edit, admin).
 */

export type RouteVisibility = "trainer-only" | "client-visible" | "shared-readonly";

export const ROUTE_VISIBILITY: Record<string, RouteVisibility> = {
  "/me": "client-visible",
  // Fill in as we audit each route.
};