/**
 * R2 — Cross-component contract: any other surface (e.g. BriefEditor's
 * Capacity Profile card) can request opening the AddSnapshotSheet pre-filled
 * to a specific domain by dispatching a window event:
 *
 *   window.dispatchEvent(new CustomEvent("open-add-snapshot", { detail: { slug } }))
 *
 * CapacityMap is the single owner of the sheet on the client detail route
 * and listens for this event below.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR, es, hi } from "date-fns/locale";
import { useServerFn } from "@tanstack/react-start";
import { getClientCapacityMap } from "@/server/capacity.functions";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { AddSnapshotSheet } from "@/components/AddSnapshotSheet";

type Snapshot = {
  domain_slug: string;
  measured_at: string;
  raw_value: number | null;
  raw_unit: string | null;
  normalized_score: number | null;
  test_used: string | null;
  provenance: string;
  notes: string | null;
  evidence_url: string | null;
};

type Domain = {
  slug: string;
  name_key: string;
  tier: "health_related" | "skill_related" | "integrative";
  display_order: number;
  evidence_summary_key: string;
  norm_reference_source: string | null;
  reference_assessments: unknown;
  currentSnapshot: Snapshot | null;
};

type MapData = {
  domains: Domain[];
  normBands: { p25: number; p50: number; p75: number };
};

const DATE_LOCALES: Record<string, Locale> = {
  en: enUS,
  pt: ptBR,
  es,
  hi,
};
type Locale = typeof enUS;

const TIER_TONE: Record<Domain["tier"], string> = {
  // Sage = success-ish, teal = info/neutral, copper = accent (amber-ish).
  health_related: "bg-[var(--success-bg)] text-[var(--success)] border-[color-mix(in_oklab,var(--success)_30%,transparent)]",
  skill_related: "bg-[color-mix(in_oklab,var(--text-3)_15%,transparent)] text-[var(--text-2)] border-[color-mix(in_oklab,var(--text-3)_30%,transparent)]",
  integrative: "bg-[var(--warn-bg)] text-[var(--warn)] border-[color-mix(in_oklab,var(--warn)_30%,transparent)]",
};

const TIER_LABEL_FILL: Record<Domain["tier"], string> = {
  health_related: "var(--success)",
  skill_related: "var(--text-2)",
  integrative: "var(--warn)",
};

/* ------------------------------------------------------------------ */
/*  Geometry helpers — radar centred at (CX, CY) with max radius MAX. */
/* ------------------------------------------------------------------ */
const SIZE = 360;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_R = 130;

function angleFor(i: number, total: number) {
  // Spoke 0 at the top, then clockwise.
  return -Math.PI / 2 + (2 * Math.PI * i) / total;
}
function pointOn(i: number, total: number, r: number) {
  const a = angleFor(i, total);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
}
function polygonPoints(total: number, ratio: number) {
  return Array.from({ length: total }, (_, i) => {
    const [x, y] = pointOn(i, total, MAX_R * ratio);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

/* ------------------------------------------------------------------ */

export function CapacityMap({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName?: string;
}) {
  const { t, i18n } = useTranslation("common");
  const fetchMap = useServerFn(getClientCapacityMap);
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<{ domain: Domain; x: number; y: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDomain, setSheetDomain] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await fetchMap({ data: { clientId } });
      setData(res as MapData);
    } catch (e) {
      console.error("CapacityMap load failed", e);
    } finally {
      setLoading(false);
    }
  }, [clientId, fetchMap]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: any insert/update/delete on this client's snapshots → reload.
  useEffect(() => {
    const ch = supabase
      .channel(`capacity-snapshots-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_capacity_snapshots",
          filter: `client_id=eq.${clientId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [clientId, load]);

  // R2 — listen for cross-component "open this domain in the sheet" requests.
  useEffect(() => {
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ slug?: string }>).detail;
      setSheetDomain(detail?.slug);
      setSheetOpen(true);
    };
    window.addEventListener("open-add-snapshot", onOpen as EventListener);
    return () => window.removeEventListener("open-add-snapshot", onOpen as EventListener);
  }, []);

  const dateLocale = DATE_LOCALES[i18n.language?.slice(0, 2) ?? "en"] ?? enUS;

  const measuredCount = useMemo(
    () => (data?.domains ?? []).filter((d) => d.currentSnapshot?.normalized_score != null).length,
    [data],
  );

  if (loading) {
    return (
      <section className="mb-3 rounded-2xl bg-[var(--surface)] p-4 sm:p-5">
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-3 w-64 mb-4" />
        <Skeleton className="aspect-square w-full max-w-[360px] mx-auto" />
      </section>
    );
  }
  if (!data) return null;

  const total = data.domains.length;
  const handleSpokeClick = (slug: string) => {
    setSheetDomain(slug);
    setSheetOpen(true);
  };
  const openAdd = () => {
    setSheetDomain(undefined);
    setSheetOpen(true);
  };

  return (
    <section
      aria-label={t("capacity.map.title")}
      className="mb-3 rounded-2xl bg-[var(--surface)] p-4 sm:p-5"
    >
      {/*
        Layout:
        - <lg: stacked (header → legend → radar) — the original mobile flow.
        - ≥lg: two columns — radar left (fixed 360), header/legend/completion
          right. Kills the huge empty gutters on desktop.
      */}
      {/* Asymmetric on desktop: radar 38%, side panel 62% (golden ratio inverted —
          radar is fixed-width, side panel takes the breathing room). */}
      <div className="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* Header (mobile position; on lg moves to the right column via order) */}
        <div className="mb-3 flex items-start justify-between gap-2 lg:hidden">
          <div className="min-w-0">
            <h3 className="h-3 text-foreground">{t("capacity.map.title")}</h3>
            <p className="body-prose mt-0.5 text-[var(--text-2)] text-sm">{t("capacity.map.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="label-caps inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-foreground hover:bg-[var(--surface-3)]"
          >
            {t("capacity.map.add_button")}
          </button>
        </div>

        {/* Tier legend + completion (mobile position) */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 lg:hidden">
          <div className="flex flex-wrap gap-1.5">
            <TierPill tier="health_related" label={t("capacity.map.tier_health")} />
            <TierPill tier="skill_related" label={t("capacity.map.tier_skill")} />
            <TierPill tier="integrative" label={t("capacity.map.tier_integrative")} />
          </div>
          <div className="min-w-[140px] flex-1 sm:flex-none">
            <p className="body-data mb-1 text-[11px] text-[var(--text-2)]">
              {t("capacity.map.completion", { done: measuredCount, total })}
            </p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(measuredCount / total) * 100}%`,
                  background: "var(--text-2)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Radar */}
        <div className="relative mx-auto w-full max-w-[360px] lg:mx-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={t("capacity.map.title")}
        >
          {/* Norm bands — outer first so inner overlays */}
          <polygon
            points={polygonPoints(total, data.normBands.p75 / 100)}
            fill="var(--success)"
            fillOpacity="0.08"
            stroke="none"
          />
          <polygon
            points={polygonPoints(total, data.normBands.p50 / 100)}
            fill="var(--text-3)"
            fillOpacity="0.06"
            stroke="none"
          />
          <polygon
            points={polygonPoints(total, data.normBands.p25 / 100)}
            fill="var(--warn)"
            fillOpacity="0.08"
            stroke="none"
          />

          {/* Spokes */}
          {data.domains.map((d, i) => {
            const [x, y] = pointOn(i, total, MAX_R);
            const measured = d.currentSnapshot?.normalized_score != null;
            return (
              <line
                key={`spoke-${d.slug}`}
                x1={CX}
                y1={CY}
                x2={x}
                y2={y}
                stroke="var(--text-3)"
                strokeOpacity={measured ? 0.45 : 0.35}
                strokeWidth={1}
                strokeDasharray={measured ? undefined : "2 4"}
              />
            );
          })}

          {/* Data polygon — only measured points; skip otherwise */}
          {(() => {
            const measuredPts = data.domains
              .map((d, i) => ({ d, i }))
              .filter(({ d }) => d.currentSnapshot?.normalized_score != null);
            if (measuredPts.length < 2) return null;
            const pts = measuredPts
              .map(({ d, i }) => {
                const r = (MAX_R * (d.currentSnapshot!.normalized_score ?? 0)) / 100;
                const [x, y] = pointOn(i, total, r);
                return `${x.toFixed(2)},${y.toFixed(2)}`;
              })
              .join(" ");
            return (
              <polygon
                points={pts}
                fill="var(--accent)"
                fillOpacity={0.18}
                stroke="var(--accent)"
                strokeWidth={2}
                strokeLinejoin="round"
              />
            );
          })()}

          {/* Per-spoke marker (point or "+") + label */}
          {data.domains.map((d, i) => {
            const score = d.currentSnapshot?.normalized_score ?? null;
            const measured = score != null;
            const r = measured ? (MAX_R * (score as number)) / 100 : MAX_R;
            const [px, py] = pointOn(i, total, r);
            const [lx, ly] = pointOn(i, total, MAX_R + 18);
            const a = angleFor(i, total);
            const anchor =
              Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
            const dy = Math.sin(a) > 0.5 ? "0.9em" : Math.sin(a) < -0.5 ? "-0.2em" : "0.32em";
            const shortLabel = t(`capacity.${d.slug}.short` as const, { defaultValue: d.slug });
            return (
              <g
                key={`pt-${d.slug}`}
                onMouseEnter={() => setHover({ domain: d, x: px, y: py })}
                onMouseLeave={() => setHover((h) => (h?.domain.slug === d.slug ? null : h))}
                onClick={() => handleSpokeClick(d.slug)}
                style={{ cursor: "pointer" }}
              >
                {/* Invisible hit target along the spoke */}
                <line
                  x1={CX}
                  y1={CY}
                  x2={pointOn(i, total, MAX_R + 8)[0]}
                  y2={pointOn(i, total, MAX_R + 8)[1]}
                  stroke="transparent"
                  strokeWidth={14}
                />
                {measured ? (
                  <circle cx={px} cy={py} r={4} fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5} />
                ) : (
                  <text
                    x={px}
                    y={py}
                    textAnchor="middle"
                    dy="0.32em"
                    fontSize={12}
                    fill="var(--text-3)"
                  >
                    +
                  </text>
                )}
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  dy={dy}
                  fontSize={10}
                  fontWeight={500}
                  fill={TIER_LABEL_FILL[d.tier]}
                  opacity={0.85}
                >
                  {shortLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Empty-state center text */}
        {measuredCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <p className="text-sm font-semibold text-foreground">{t("capacity.map.empty_title")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("capacity.map.empty_subtitle")}</p>
          </div>
        )}

        {/* Hover tooltip */}
        {hover && (
          <div
            className={cn(
              "pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-border bg-popover px-2.5 py-2 text-[11px] shadow-md",
            )}
            style={{
              left: `${(hover.x / SIZE) * 100}%`,
              top: `${(hover.y / SIZE) * 100}%`,
              transform: "translate(-50%, calc(-100% - 10px))",
            }}
          >
            <p className="font-semibold text-foreground">
              {t(hover.domain.name_key, { defaultValue: hover.domain.slug })}
            </p>
            {hover.domain.currentSnapshot?.normalized_score != null ? (
              <>
                <p className="text-foreground/90">
                  {t("capacity.map.tooltip_score", {
                    score: Math.round(hover.domain.currentSnapshot.normalized_score),
                  })}
                </p>
                {hover.domain.currentSnapshot.test_used && (
                  <p className="text-muted-foreground">
                    {t("capacity.map.tooltip_test", { test: hover.domain.currentSnapshot.test_used })}
                  </p>
                )}
                <p className="text-muted-foreground">
                  {t("capacity.map.measured_relative", {
                    when: formatDistanceToNow(new Date(hover.domain.currentSnapshot.measured_at), {
                      addSuffix: true,
                      locale: dateLocale,
                    }),
                  })}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">{t("capacity.map.tooltip_unmeasured")}</p>
            )}
            <p className="mt-1 text-muted-foreground italic">
              {t(hover.domain.evidence_summary_key, { defaultValue: "" })}
            </p>
          </div>
        )}
        </div>

        {/* Desktop side panel — header, add button, legend, completion */}
        <div className="hidden lg:flex lg:flex-col lg:gap-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="h-2 text-foreground">{t("capacity.map.title")}</h2>
              <p className="body-prose mt-2 text-[var(--text-2)]">{t("capacity.map.subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="label-caps inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-foreground hover:bg-[var(--surface-3)]"
            >
              {t("capacity.map.add_button")}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TierPill tier="health_related" label={t("capacity.map.tier_health")} />
            <TierPill tier="skill_related" label={t("capacity.map.tier_skill")} />
            <TierPill tier="integrative" label={t("capacity.map.tier_integrative")} />
          </div>
          <div>
            <p className="body-data mb-1.5 text-xs text-[var(--text-2)]">
              {t("capacity.map.completion", { done: measuredCount, total })}
            </p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(measuredCount / total) * 100}%`,
                  background: "var(--text-2)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <AddSnapshotSheet
        clientId={clientId}
        clientName={clientName}
        domains={data.domains}
        initialDomainSlug={sheetDomain}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </section>
  );
}

function TierPill({ tier, label }: { tier: Domain["tier"]; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        TIER_TONE[tier],
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: TIER_LABEL_FILL[tier] }}
        aria-hidden
      />
      {label}
    </span>
  );
}