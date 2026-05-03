import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Joyride } from "react-joyride";
import { useTranslation } from "react-i18next";

/**
 * Multi-route product tour. Driven by react-joyride with a controlled
 * stepIndex so we can navigate between routes between steps. Each step
 * declares its target selector and (optionally) the route it must run on;
 * the provider auto-navigates and waits for the target before resuming.
 */

type DemoCtx = { clientId: string; planId: string | null } | null;

type TourStepDef = {
  key: string;
  /** Route the step must run on; if absent the current route is used. */
  route?: (ctx: NonNullable<DemoCtx>) => string;
  /** CSS selector or fallback to body. */
  target: string;
  i18nKey: string; // demo.tour.<key>
  placement?: "top" | "bottom" | "left" | "right" | "center" | "auto";
};

const TOUR_SEEN_KEY = "forge.demoTour.seen";

const TourCtx = createContext<{
  start: (ctx: NonNullable<DemoCtx>) => void;
  hasSeen: boolean;
}>({
  start: () => {},
  hasSeen: false,
});

export function useTour() {
  return useContext(TourCtx);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const [ctx, setCtx] = useState<DemoCtx>(null);
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasSeen, setHasSeen] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(TOUR_SEEN_KEY) === "1"; } catch { return false; }
  });

  const stepDefs = useMemo<TourStepDef[]>(() => [
    { key: "step_banner", target: "[data-tour='demo-banner']", i18nKey: "demo.tour.step_banner", placement: "bottom" },
    { key: "step_open_client", route: (c) => `/clients/${c.clientId}`, target: "[data-tour='client-overview']", i18nKey: "demo.tour.step_open_client", placement: "bottom" },
    { key: "step_plan", route: (c) => c.planId ? `/plans/${c.planId}` : `/clients/${c.clientId}`, target: "[data-tour='plan-block-chip'], [data-tour='plan-header']", i18nKey: "demo.tour.step_plan", placement: "bottom" },
    { key: "step_volume", route: (c) => c.planId ? `/plans/${c.planId}` : `/clients/${c.clientId}`, target: "[data-tour='volume-section']", i18nKey: "demo.tour.step_volume", placement: "top" },
    { key: "step_year", route: (c) => `/clients/${c.clientId}/year`, target: "[data-tour='year-view']", i18nKey: "demo.tour.step_year", placement: "top" },
    { key: "step_lab", route: () => `/clients`, target: "[data-tour='demo-lab']", i18nKey: "demo.tour.step_lab", placement: "top" },
  ], []);

  const steps = useMemo(() => stepDefs.map((s) => ({
    target: s.target,
    content: t(s.i18nKey),
    disableBeacon: true,
    placement: s.placement,
  })), [stepDefs, t]);

  const ensureRouteForStep = useCallback(async (i: number) => {
    if (!ctx) return;
    const def = stepDefs[i];
    if (!def?.route) return;
    const target = def.route(ctx);
    if (!target) return;
    if (location.pathname === target) return;
    await navigate({ to: target as any });
  }, [ctx, stepDefs, location.pathname, navigate]);

  // When stepIndex changes, ensure the right route is loaded.
  useEffect(() => {
    if (!run) return;
    void ensureRouteForStep(stepIndex);
  }, [stepIndex, run, ensureRouteForStep]);

  const start = useCallback((c: NonNullable<DemoCtx>) => {
    setCtx(c);
    setStepIndex(0);
    setRun(true);
    try { window.localStorage.setItem(TOUR_SEEN_KEY, "1"); } catch {}
    setHasSeen(true);
  }, []);

  const stop = useCallback(() => {
    setRun(false);
    setStepIndex(0);
  }, []);

  const handleCallback = useCallback((data: any) => {
    const { status, type, action, index } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
      stop();
      return;
    }
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const next = index + (action === ACTIONS.PREV ? -1 : 1);
      if (next < 0 || next >= stepDefs.length) {
        stop();
        return;
      }
      setStepIndex(next);
    }
  }, [stepDefs.length, stop]);

  return (
    <TourCtx.Provider value={{ start, hasSeen }}>
      {children}
      <Joyride
        run={run}
        steps={steps}
        stepIndex={stepIndex}
        continuous
        scrollToFirstStep
        onEvent={handleCallback}
        options={{ showProgress: true, primaryColor: "hsl(38 92% 50%)", overlayColor: "rgba(0,0,0,0.55)", zIndex: 10000 }}
        locale={{
          back: t("demo.tour.back"),
          close: t("demo.tour.skip"),
          last: t("demo.tour.finish"),
          next: t("demo.tour.next"),
          skip: t("demo.tour.skip"),
        }}
        styles={{
          tooltip: { backgroundColor: "hsl(220 13% 12%)", color: "hsl(0 0% 95%)", borderRadius: 12 },
          tooltipContent: { color: "hsl(0 0% 95%)" },
          overlay: { backgroundColor: "rgba(0,0,0,0.55)" },
        }}
      />
    </TourCtx.Provider>
  );
}