import { useId } from "react";
import { useTranslation } from "react-i18next";

/**
 * Round F1 + R75 — reusable, theme-adaptive body map.
 * Symbolic anatomical figure. No sex characteristics. Tappable zones use
 * `currentColor`, so colour follows the surrounding text colour and works
 * across light / medium / dark themes without per-theme overrides.
 *
 * R75 — finer anatomy: clavicle / sternum / pec split, shoulder anterior vs
 * lateral, elbow as its own zone (epicondylitis), knee subdivided medial /
 * anterior / lateral, scapula and sacrum on the back. Legacy ids
 * (`chest`, `knee_left`, `shoulder_left`, etc.) are kept so previously
 * persisted `assessment_injuries.body_zone` values still render.
 */

export interface BodyZone {
  id: string;
  view: "front" | "back";
  /** SVG path d-attribute or inline shape rendered as <path d={shape} />. */
  shape: string;
  label_key: string;
  /**
   * Legacy zones are kept so old data renders, but they are not directly
   * tappable (the new finer zones overlay on top). Hidden from the tap layer.
   */
  legacy?: boolean;
}

const FRONT_ZONES: BodyZone[] = [
  { id: "head",              view: "front", label_key: "injuries.zone.head",              shape: "M100 12 a22 28 0 1 0 0.01 0 z" },
  { id: "neck",              view: "front", label_key: "injuries.zone.neck",              shape: "M88 70 h24 v16 h-24 z" },

  // Clavicle / AC joint — thin band above the pecs
  { id: "clavicle_left",     view: "front", label_key: "injuries.zone.clavicle_left",     shape: "M100 90 h28 v12 h-28 z" },
  { id: "clavicle_right",    view: "front", label_key: "injuries.zone.clavicle_right",    shape: "M72 90 h28 v12 h-28 z" },

  // Shoulder split into anterior (front delt / biceps long head) and lateral (subacromial)
  { id: "shoulder_anterior_left",  view: "front", label_key: "injuries.zone.shoulder_anterior_left",  shape: "M128 96 h14 v20 h-14 z" },
  { id: "shoulder_anterior_right", view: "front", label_key: "injuries.zone.shoulder_anterior_right", shape: "M58 96 h14 v20 h-14 z" },
  { id: "shoulder_lateral_left",   view: "front", label_key: "injuries.zone.shoulder_lateral_left",   shape: "M142 92 h22 v22 h-22 z" },
  { id: "shoulder_lateral_right",  view: "front", label_key: "injuries.zone.shoulder_lateral_right",  shape: "M36 92 h22 v22 h-22 z" },

  // Sternum (central, costo-chondral) and pectorals split
  { id: "sternum",           view: "front", label_key: "injuries.zone.sternum",           shape: "M94 104 h12 v44 h-12 z" },
  { id: "pec_left",          view: "front", label_key: "injuries.zone.pec_left",          shape: "M106 104 h32 v46 h-32 z" },
  { id: "pec_right",         view: "front", label_key: "injuries.zone.pec_right",         shape: "M62 104 h32 v46 h-32 z" },

  { id: "abdomen",           view: "front", label_key: "injuries.zone.abdomen",           shape: "M68 150 h64 v60 h-64 z" },

  { id: "bicep_left",        view: "front", label_key: "injuries.zone.bicep_left",        shape: "M142 116 h22 v44 h-22 z" },
  { id: "bicep_right",       view: "front", label_key: "injuries.zone.bicep_right",       shape: "M36 116 h22 v44 h-22 z" },

  // Elbow — distinct from forearm (epicondylitis lives here)
  { id: "elbow_left",        view: "front", label_key: "injuries.zone.elbow_left",        shape: "M144 160 h24 v18 h-24 z" },
  { id: "elbow_right",       view: "front", label_key: "injuries.zone.elbow_right",       shape: "M32 160 h24 v18 h-24 z" },

  { id: "forearm_left",      view: "front", label_key: "injuries.zone.forearm_left",      shape: "M148 178 h22 v50 h-22 z" },
  { id: "forearm_right",     view: "front", label_key: "injuries.zone.forearm_right",     shape: "M30 178 h22 v50 h-22 z" },
  { id: "hand_left",         view: "front", label_key: "injuries.zone.hand_left",         shape: "M150 228 h20 v22 h-20 z" },
  { id: "hand_right",        view: "front", label_key: "injuries.zone.hand_right",        shape: "M30 228 h20 v22 h-20 z" },

  { id: "hip_left",          view: "front", label_key: "injuries.zone.hip_left",          shape: "M100 210 h36 v36 h-36 z" },
  { id: "hip_right",         view: "front", label_key: "injuries.zone.hip_right",         shape: "M64 210 h36 v36 h-36 z" },

  { id: "thigh_front_left",  view: "front", label_key: "injuries.zone.thigh_front_left",  shape: "M100 246 h32 v90 h-32 z" },
  { id: "thigh_front_right", view: "front", label_key: "injuries.zone.thigh_front_right", shape: "M68 246 h32 v90 h-32 z" },

  // Knee subdivided: medial / anterior (patella) / lateral.
  // "Left" = client's left = viewer's right (x ≥ 100).
  { id: "knee_medial_left",    view: "front", label_key: "injuries.zone.knee_medial_left",    shape: "M100 336 h8 v24 h-8 z" },
  { id: "knee_anterior_left",  view: "front", label_key: "injuries.zone.knee_anterior_left",  shape: "M108 336 h16 v24 h-16 z" },
  { id: "knee_lateral_left",   view: "front", label_key: "injuries.zone.knee_lateral_left",   shape: "M124 336 h8 v24 h-8 z" },
  { id: "knee_lateral_right",  view: "front", label_key: "injuries.zone.knee_lateral_right",  shape: "M68 336 h8 v24 h-8 z" },
  { id: "knee_anterior_right", view: "front", label_key: "injuries.zone.knee_anterior_right", shape: "M76 336 h16 v24 h-16 z" },
  { id: "knee_medial_right",   view: "front", label_key: "injuries.zone.knee_medial_right",   shape: "M92 336 h8 v24 h-8 z" },

  { id: "shin_left",         view: "front", label_key: "injuries.zone.shin_left",         shape: "M102 360 h28 v80 h-28 z" },
  { id: "shin_right",        view: "front", label_key: "injuries.zone.shin_right",        shape: "M70 360 h28 v80 h-28 z" },
  { id: "foot_left",         view: "front", label_key: "injuries.zone.foot_left",         shape: "M100 440 h34 v32 h-34 z" },
  { id: "foot_right",        view: "front", label_key: "injuries.zone.foot_right",        shape: "M66 440 h34 v32 h-34 z" },

  // Legacy aggregate zones — render saved data, not directly tappable.
  { id: "shoulder_left",     view: "front", legacy: true, label_key: "injuries.zone.shoulder_left",     shape: "M115 88 q24 -2 30 18 q-15 6 -30 0 z" },
  { id: "shoulder_right",    view: "front", legacy: true, label_key: "injuries.zone.shoulder_right",    shape: "M85 88 q-24 -2 -30 18 q15 6 30 0 z" },
  { id: "chest",             view: "front", legacy: true, label_key: "injuries.zone.chest",             shape: "M62 105 h76 v45 h-76 z" },
  { id: "knee_left",         view: "front", legacy: true, label_key: "injuries.zone.knee_left",         shape: "M100 336 h32 v24 h-32 z" },
  { id: "knee_right",        view: "front", legacy: true, label_key: "injuries.zone.knee_right",        shape: "M68 336 h32 v24 h-32 z" },
];

const BACK_ZONES: BodyZone[] = [
  { id: "back_of_head",        view: "back", label_key: "injuries.zone.back_of_head",        shape: "M100 12 a22 28 0 1 0 0.01 0 z" },
  { id: "neck_back",           view: "back", label_key: "injuries.zone.neck_back",           shape: "M88 70 h24 v16 h-24 z" },
  { id: "traps",               view: "back", label_key: "injuries.zone.traps",               shape: "M68 88 h64 v18 h-64 z" },
  { id: "shoulder_back_left",  view: "back", label_key: "injuries.zone.shoulder_back_left",  shape: "M132 88 q24 -2 30 18 q-15 6 -30 0 z" },
  { id: "shoulder_back_right", view: "back", label_key: "injuries.zone.shoulder_back_right", shape: "M68 88 q-24 -2 -30 18 q15 6 30 0 z" },

  // Scapula — sits inside the upper back, flanking the spine.
  { id: "scapula_left",        view: "back", label_key: "injuries.zone.scapula_left",        shape: "M104 106 h28 v34 h-28 z" },
  { id: "scapula_right",       view: "back", label_key: "injuries.zone.scapula_right",       shape: "M68 106 h28 v34 h-28 z" },

  { id: "upper_back",          view: "back", label_key: "injuries.zone.upper_back",          shape: "M62 106 h76 v44 h-76 z", legacy: true },
  { id: "lumbar",              view: "back", label_key: "injuries.zone.lumbar",              shape: "M68 150 h64 v44 h-64 z" },
  { id: "sacrum",              view: "back", label_key: "injuries.zone.sacrum",              shape: "M84 194 h32 v18 h-32 z" },

  { id: "bicep_back_left",     view: "back", label_key: "injuries.zone.bicep_back_left",     shape: "M142 116 h22 v44 h-22 z" },
  { id: "bicep_back_right",    view: "back", label_key: "injuries.zone.bicep_back_right",    shape: "M36 116 h22 v44 h-22 z" },
  { id: "elbow_back_left",     view: "back", label_key: "injuries.zone.elbow_back_left",     shape: "M144 160 h24 v18 h-24 z" },
  { id: "elbow_back_right",    view: "back", label_key: "injuries.zone.elbow_back_right",    shape: "M32 160 h24 v18 h-24 z" },
  { id: "forearm_back_left",   view: "back", label_key: "injuries.zone.forearm_back_left",   shape: "M148 178 h22 v50 h-22 z" },
  { id: "forearm_back_right",  view: "back", label_key: "injuries.zone.forearm_back_right",  shape: "M30 178 h22 v50 h-22 z" },
  { id: "hand_back_left",      view: "back", label_key: "injuries.zone.hand_back_left",      shape: "M150 228 h20 v22 h-20 z" },
  { id: "hand_back_right",     view: "back", label_key: "injuries.zone.hand_back_right",     shape: "M30 228 h20 v22 h-20 z" },

  { id: "glute_left",          view: "back", label_key: "injuries.zone.glute_left",          shape: "M100 212 h36 v34 h-36 z" },
  { id: "glute_right",         view: "back", label_key: "injuries.zone.glute_right",         shape: "M64 212 h36 v34 h-36 z" },
  { id: "hamstring_left",      view: "back", label_key: "injuries.zone.hamstring_left",      shape: "M100 246 h32 v90 h-32 z" },
  { id: "hamstring_right",     view: "back", label_key: "injuries.zone.hamstring_right",     shape: "M68 246 h32 v90 h-32 z" },
  { id: "knee_back_left",      view: "back", label_key: "injuries.zone.knee_back_left",      shape: "M100 336 h32 v20 h-32 z" },
  { id: "knee_back_right",     view: "back", label_key: "injuries.zone.knee_back_right",     shape: "M68 336 h32 v20 h-32 z" },
  { id: "calf_left",           view: "back", label_key: "injuries.zone.calf_left",           shape: "M102 356 h28 v60 h-28 z" },
  { id: "calf_right",          view: "back", label_key: "injuries.zone.calf_right",          shape: "M70 356 h28 v60 h-28 z" },
  { id: "achilles_left",       view: "back", label_key: "injuries.zone.achilles_left",       shape: "M104 416 h24 v24 h-24 z" },
  { id: "achilles_right",      view: "back", label_key: "injuries.zone.achilles_right",      shape: "M72 416 h24 v24 h-24 z" },
  { id: "foot_back_left",      view: "back", label_key: "injuries.zone.foot_back_left",      shape: "M100 440 h34 v32 h-34 z" },
  { id: "foot_back_right",     view: "back", label_key: "injuries.zone.foot_back_right",     shape: "M66 440 h34 v32 h-34 z" },
];

export const BODY_ZONES: BodyZone[] = [...FRONT_ZONES, ...BACK_ZONES];

export function getZone(id: string): BodyZone | undefined {
  return BODY_ZONES.find((z) => z.id === id);
}

export interface BodyMapProps {
  selectedZones?: string[];
  onZoneTap?: (zoneId: string, view: "front" | "back") => void;
  view?: "front" | "back";
  onViewChange?: (view: "front" | "back") => void;
  className?: string;
  /** Map of zoneId -> small badge (e.g. severity number) rendered on dot. */
  badges?: Record<string, string | number>;
}

export function BodyMap({
  selectedZones = [],
  onZoneTap,
  view = "front",
  onViewChange,
  className,
  badges = {},
}: BodyMapProps) {
  const { t } = useTranslation("common");
  const titleId = useId();
  const zones = view === "front" ? FRONT_ZONES : BACK_ZONES;
  const selected = new Set(selectedZones);

  // Render legacy zones first (behind), tappable zones on top.
  const legacy = zones.filter((z) => z.legacy);
  const tappable = zones.filter((z) => !z.legacy);

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
      {/* View toggle */}
      <div role="tablist" className="inline-flex rounded-full border border-border/60 bg-background/40 p-0.5 text-xs">
        {(["front", "back"] as const).map((v) => {
          const on = view === v;
          return (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onViewChange?.(v)}
              className={`min-w-[88px] rounded-full px-3 py-1.5 transition ${on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t(v === "front" ? "injuries.view_front" : "injuries.view_back")}
            </button>
          );
        })}
      </div>

      <svg
        viewBox="0 0 200 500"
        role="img"
        aria-labelledby={titleId}
        className="h-[420px] w-auto max-w-full text-foreground"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>{t(view === "front" ? "injuries.view_front" : "injuries.view_back")}</title>

        {/* Anatomy outline — symbolic, not detailed */}
        <g fill="none" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
          {/* Head */}
          <ellipse cx="100" cy="40" rx="22" ry="28" />
          {/* Neck */}
          <path d="M88 70 h24 v16 h-24 z" />
          {/* Torso */}
          <path d="M55 106 q5 -22 30 -22 h30 q25 0 30 22 v100 q0 14 -10 22 q-20 14 -70 0 q-10 -8 -10 -22 z" />
          {/* Hips / pelvis */}
          <path d="M55 200 q15 22 45 22 q30 0 45 -22" />
          {/* Arms */}
          <path d="M55 106 q-15 6 -19 14 v110 q0 6 4 10 h22 q4 -4 4 -10 v-110 q-1 -8 -11 -14" />
          <path d="M145 106 q15 6 19 14 v110 q0 6 -4 10 h-22 q-4 -4 -4 -10 v-110 q1 -8 11 -14" />
          {/* Legs */}
          <path d="M70 222 q-2 60 -2 130 q0 60 2 120 h28 q2 -60 2 -120 q0 -70 -2 -130" />
          <path d="M130 222 q2 60 2 130 q0 60 -2 120 h-28 q-2 -60 -2 -120 q0 -70 2 -130" />

          {view === "front" ? (
            <>
              {/* Clavicles */}
              <path d="M70 96 L100 92 L130 96" />
              {/* Sternum */}
              <line x1="100" y1="104" x2="100" y2="148" />
              {/* Pec divider */}
              <path d="M70 108 q30 18 60 0" strokeOpacity="0.18" />
              {/* Deltoid arcs */}
              <path d="M40 110 q12 -8 22 -2" />
              <path d="M160 110 q-12 -8 -22 -2" />
              {/* Elbow joint markers */}
              <ellipse cx="44" cy="170" rx="11" ry="6" />
              <ellipse cx="156" cy="170" rx="11" ry="6" />
              {/* Patella */}
              <ellipse cx="84" cy="348" rx="10" ry="9" />
              <ellipse cx="116" cy="348" rx="10" ry="9" />
              {/* Linea alba (subtle) */}
              <line x1="100" y1="150" x2="100" y2="208" strokeOpacity="0.16" />
            </>
          ) : (
            <>
              {/* Spine */}
              <line x1="100" y1="92" x2="100" y2="208" strokeOpacity="0.22" />
              {/* Scapula triangles */}
              <path d="M72 108 L96 110 L96 138 Z" strokeOpacity="0.24" />
              <path d="M128 108 L104 110 L104 138 Z" strokeOpacity="0.24" />
              {/* Sacrum tri */}
              <path d="M88 196 L100 212 L112 196 Z" strokeOpacity="0.24" />
              {/* Elbow joint markers */}
              <ellipse cx="44" cy="170" rx="11" ry="6" />
              <ellipse cx="156" cy="170" rx="11" ry="6" />
              {/* Calf bellies (subtle) */}
              <path d="M76 376 q8 14 16 0" strokeOpacity="0.16" />
              <path d="M108 376 q8 14 16 0" strokeOpacity="0.16" />
            </>
          )}
        </g>

        {/* Legacy zones — only show fill if selected (carry old data) */}
        <g pointerEvents="none">
          {legacy.map((z) => {
            const on = selected.has(z.id);
            if (!on) return null;
            return (
              <path
                key={z.id}
                d={z.shape}
                fill="currentColor"
                fillOpacity={0.18}
                stroke="currentColor"
                strokeOpacity={0.4}
                strokeWidth={1}
              />
            );
          })}
        </g>

        {/* Tappable zones — always faintly visible so the user perceives them */}
        <g>
          {tappable.map((z) => {
            const on = selected.has(z.id);
            const badge = badges[z.id];
            return (
              <g key={z.id} className="cursor-pointer">
                <path
                  d={z.shape}
                  fill="currentColor"
                  fillOpacity={on ? 0.32 : 0}
                  stroke="currentColor"
                  strokeOpacity={on ? 0.55 : 0.22}
                  strokeWidth={on ? 1.1 : 0.8}
                  strokeDasharray={on ? undefined : "2.5 2.5"}
                  className="transition-[fill-opacity,stroke-opacity] hover:[fill-opacity:0.18] hover:[stroke-opacity:0.5]"
                  onClick={() => onZoneTap?.(z.id, z.view)}
                  role="button"
                  aria-label={t(z.label_key)}
                  aria-pressed={on}
                  style={{ touchAction: "manipulation" }}
                >
                  <title>{t(z.label_key)}</title>
                </path>
                {on ? <ZoneBadge zoneId={z.id} badge={badge} /> : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/** Tiny badge dot near the centre of a zone — uses the zone's bbox midpoint. */
function ZoneBadge({ zoneId, badge }: { zoneId: string; badge?: string | number }) {
  const z = BODY_ZONES.find((zz) => zz.id === zoneId);
  if (!z) return null;
  const center = approxCenter(z.shape);
  if (!center) return null;
  return (
    <g pointerEvents="none">
      <circle cx={center.x} cy={center.y} r={9} fill="currentColor" fillOpacity={0.85} />
      <text
        x={center.x}
        y={center.y + 3.5}
        textAnchor="middle"
        fontSize="10"
        fontWeight={600}
        fill="var(--background)"
      >
        {badge ?? "•"}
      </text>
    </g>
  );
}

/** Crude bbox extractor — supports our `M x y h W v H z` and ellipse-like start `M cx cy a rx ry`. */
function approxCenter(d: string): { x: number; y: number } | null {
  const rect = /M\s*(-?[\d.]+)\s+(-?[\d.]+)\s*h\s*(-?[\d.]+)\s*v\s*(-?[\d.]+)/.exec(d);
  if (rect) {
    const x = parseFloat(rect[1]);
    const y = parseFloat(rect[2]);
    const w = parseFloat(rect[3]);
    const h = parseFloat(rect[4]);
    return { x: x + w / 2, y: y + h / 2 };
  }
  const start = /M\s*(-?[\d.]+)\s+(-?[\d.]+)/.exec(d);
  if (start) return { x: parseFloat(start[1]) + 8, y: parseFloat(start[2]) + 8 };
  return null;
}
