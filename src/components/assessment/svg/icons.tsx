/**
 * Inline SVG icon library for the assessment UI.
 * - All shapes use `currentColor` so they inherit text color and theme.
 * - Body silhouettes: stroke 1.5; measurement dashes: stroke 2 amber.
 * - viewBox 48x48 for chip icons; 80x120 for measurement silhouettes.
 */
import type { SVGProps } from "react";

const baseProps: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-full w-full",
};

/* ---------- Sex ---------- */
export const FemaleSilhouette = () => (
  <svg {...baseProps}>
    <circle cx="24" cy="13" r="5" />
    <path d="M14 36c2-7 6-11 10-11s8 4 10 11" />
    <path d="M16 36l-2 6M32 36l2 6" />
  </svg>
);
export const MaleSilhouette = () => (
  <svg {...baseProps}>
    <circle cx="24" cy="13" r="5" />
    <path d="M13 36c1-8 5-11 11-11s10 3 11 11" />
    <path d="M15 36v6M33 36v6" />
  </svg>
);

/* ---------- Body fat methods ---------- */
export const IconCalipers = () => (
  <svg {...baseProps}>
    <path d="M16 8l8 16 8-16" />
    <path d="M14 30c0 4 4 8 10 8s10-4 10-8" />
    <circle cx="24" cy="24" r="1.5" fill="currentColor" />
  </svg>
);
export const IconBIA = () => (
  <svg {...baseProps}>
    <rect x="10" y="28" width="28" height="12" rx="2" />
    <path d="M16 28v-4M32 28v-4" />
    <path d="M20 20q4-6 8 0" strokeDasharray="2 2" />
    <path d="M22 14l4 4-4 4" />
  </svg>
);
export const IconDEXA = () => (
  <svg {...baseProps}>
    <rect x="6" y="18" width="36" height="12" rx="2" />
    <circle cx="20" cy="24" r="2" />
    <path d="M22 24h6" />
    <path d="M14 24l-2-2M14 24l-2 2" strokeDasharray="2 2" />
  </svg>
);
export const IconBodPod = () => (
  <svg {...baseProps}>
    <path d="M24 8c-8 0-12 8-12 16s4 16 12 16 12-8 12-16-4-16-12-16z" />
    <circle cx="24" cy="22" r="3" />
  </svg>
);
export const IconVisualEstimate = () => (
  <svg {...baseProps}>
    <path d="M6 24c4-7 10-10 18-10s14 3 18 10c-4 7-10 10-18 10S10 31 6 24z" />
    <circle cx="24" cy="24" r="4" />
    <circle cx="24" cy="24" r="1.5" fill="currentColor" />
  </svg>
);

/* ---------- Training location ---------- */
export const IconHome = () => (
  <svg {...baseProps}>
    <path d="M8 24l16-14 16 14" />
    <path d="M12 22v18h24V22" />
    <path d="M20 40v-8h8v8" />
  </svg>
);
export const IconGym = () => (
  <svg {...baseProps}>
    <path d="M6 24h36" />
    <rect x="4" y="18" width="4" height="12" rx="1" />
    <rect x="40" y="18" width="4" height="12" rx="1" />
    <rect x="10" y="20" width="3" height="8" rx="1" />
    <rect x="35" y="20" width="3" height="8" rx="1" />
  </svg>
);
export const IconOutdoor = () => (
  <svg {...baseProps}>
    <circle cx="14" cy="14" r="4" />
    <path d="M14 14l-3 3M14 14l3 3M14 8v-3M14 20v3M8 14h-3M20 14h3" />
    <path d="M34 38v-12" />
    <path d="M28 26q6-12 12 0" />
  </svg>
);
export const IconHybrid = () => (
  <svg {...baseProps}>
    <path d="M6 22l10-9 10 9" />
    <path d="M9 21v17h14V21" />
    <path d="M36 38v-10" />
    <path d="M30 28q6-10 12 0" />
  </svg>
);

/* ---------- Job type ---------- */
export const IconJobSedentary = () => (
  <svg {...baseProps}>
    <circle cx="18" cy="14" r="3" />
    <path d="M18 17v8l-6 6" />
    <path d="M18 25h8" />
    <path d="M10 38h12v-6" />
    <path d="M28 24h12v6h-12z" />
  </svg>
);
export const IconJobStanding = () => (
  <svg {...baseProps}>
    <circle cx="20" cy="10" r="3" />
    <path d="M20 13v18" />
    <path d="M20 22l-6 4M20 22l6 4" />
    <path d="M20 31l-4 9M20 31l4 9" />
    <path d="M28 26h12" />
  </svg>
);
export const IconJobPhysical = () => (
  <svg {...baseProps}>
    <circle cx="20" cy="10" r="3" />
    <path d="M20 13v10" />
    <path d="M20 18l-6 4 6 4" />
    <path d="M20 18l8-4" />
    <path d="M20 23v8l-4 9M20 31l4 9" />
    <rect x="24" y="10" width="10" height="8" rx="1" />
  </svg>
);
export const IconJobMixed = () => (
  <svg {...baseProps}>
    <path d="M24 4v40" strokeDasharray="2 3" />
    <circle cx="14" cy="14" r="3" />
    <path d="M14 17v8" />
    <path d="M10 38h8v-6" />
    <circle cx="34" cy="10" r="3" />
    <path d="M34 13v18" />
    <path d="M34 31l-3 9M34 31l3 9" />
  </svg>
);

/* ---------- Smoking ---------- */
export const IconSmokeNever = () => (
  <svg {...baseProps}>
    <rect x="8" y="22" width="28" height="6" rx="1" />
    <path d="M30 22v6" />
    <path d="M6 38L42 10" stroke="currentColor" strokeWidth="2" />
  </svg>
);
export const IconSmokeFormer = () => (
  <svg {...baseProps}>
    <rect x="8" y="22" width="28" height="6" rx="1" />
    <path d="M30 22v6" />
    <path d="M14 14l-4 4 4 4" />
    <path d="M10 18h12" />
  </svg>
);
export const IconSmokeCurrent = () => (
  <svg {...baseProps}>
    <rect x="8" y="28" width="28" height="6" rx="1" />
    <path d="M30 28v6" />
    <path d="M16 22q2-4 0-8M22 22q2-4 0-8M28 22q2-4 0-8" />
  </svg>
);

/* ---------- Goal icons ---------- */
const goalProps: SVGProps<SVGSVGElement> = { ...baseProps };
export const IconGoalStrength = () => (
  <svg {...goalProps}>
    <rect x="4" y="20" width="4" height="8" rx="1" />
    <rect x="40" y="20" width="4" height="8" rx="1" />
    <rect x="10" y="22" width="3" height="4" rx="1" />
    <rect x="35" y="22" width="3" height="4" rx="1" />
    <path d="M13 24h22" strokeWidth="2" />
  </svg>
);
export const IconGoalHypertrophy = () => (
  <svg {...goalProps}>
    <path d="M10 24c0-6 4-10 10-10h8c6 0 10 4 10 10s-4 10-10 10h-8c-6 0-10-4-10-10z" />
    <path d="M16 22q4-4 8 0M24 22q4-4 8 0" />
  </svg>
);
export const IconGoalHealth = () => (
  <svg {...goalProps}>
    <path d="M24 38s-12-7-12-18a7 7 0 0 1 12-5 7 7 0 0 1 12 5c0 11-12 18-12 18z" />
  </svg>
);
export const IconGoalPerformance = () => (
  <svg {...goalProps}>
    <circle cx="30" cy="10" r="3" />
    <path d="M30 13l-6 8 4 6-8 8" />
    <path d="M28 21l-8-4M28 27l8 2" />
  </svg>
);
export const IconGoalRecomp = () => (
  <svg {...goalProps}>
    <path d="M24 8v32" />
    <path d="M8 18l8-8 8 8M8 18h16" />
    <path d="M40 30l-8 8-8-8M40 30H24" />
  </svg>
);
export const IconGoalMobility = () => (
  <svg {...goalProps}>
    <circle cx="24" cy="10" r="3" />
    <path d="M24 13v6l-8 8M24 19l8 8" />
    <path d="M16 27l-2 13M32 27l2 13" />
  </svg>
);
export const IconGoalFunction = () => (
  <svg {...goalProps}>
    <circle cx="16" cy="10" r="3" />
    <path d="M16 13v8l6 4" />
    <path d="M22 21l8-4 8 4" />
    <path d="M16 21l-4 10M22 25v8l-4 7M22 33l4 7" />
  </svg>
);

/* ---------- Measurement guides (silhouette + amber dashed line) ---------- */
const guideSvgProps: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 80 120",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-32 w-auto",
};
const AMBER = "hsl(38 92% 50%)";

function FrontSilhouette() {
  return (
    <g>
      {/* head */}
      <circle cx="40" cy="14" r="8" />
      {/* neck + torso */}
      <path d="M36 22v4M44 22v4" />
      <path d="M28 30q12-8 24 0" />
      {/* shoulders to waist */}
      <path d="M28 30c-2 12-2 18 0 28" />
      <path d="M52 30c2 12 2 18 0 28" />
      {/* waist taper */}
      <path d="M28 58q12 4 24 0" />
      {/* hips */}
      <path d="M28 58c-1 6 0 10 2 14" />
      <path d="M52 58c1 6 0 10-2 14" />
      <path d="M30 72q10 4 20 0" />
      {/* legs */}
      <path d="M32 72v40" />
      <path d="M48 72v40" />
      {/* arms */}
      <path d="M28 32q-6 14-4 26" />
      <path d="M52 32q6 14 4 26" />
    </g>
  );
}

export const GuideHeight = () => (
  <svg {...guideSvgProps}>
    <FrontSilhouette />
    <line x1="68" y1="6" x2="68" y2="112" stroke={AMBER} strokeWidth="2" strokeDasharray="4 2" />
    <path d="M65 8l3-3 3 3M65 110l3 3 3-3" stroke={AMBER} strokeWidth="2" />
  </svg>
);
export const GuideWaist = () => (
  <svg {...guideSvgProps}>
    <FrontSilhouette />
    <line x1="22" y1="56" x2="58" y2="56" stroke={AMBER} strokeWidth="2" strokeDasharray="4 2" />
  </svg>
);
export const GuideHip = () => (
  <svg {...guideSvgProps}>
    <FrontSilhouette />
    <line x1="22" y1="70" x2="58" y2="70" stroke={AMBER} strokeWidth="2" strokeDasharray="4 2" />
  </svg>
);
export const GuideChest = () => (
  <svg {...guideSvgProps}>
    <FrontSilhouette />
    <line x1="22" y1="38" x2="58" y2="38" stroke={AMBER} strokeWidth="2" strokeDasharray="4 2" />
  </svg>
);
export const GuideArm = () => (
  <svg {...guideSvgProps}>
    <FrontSilhouette />
    <line x1="20" y1="42" x2="30" y2="42" stroke={AMBER} strokeWidth="2" strokeDasharray="4 2" />
  </svg>
);
export const GuideThigh = () => (
  <svg {...guideSvgProps}>
    <FrontSilhouette />
    <line x1="28" y1="84" x2="36" y2="84" stroke={AMBER} strokeWidth="2" strokeDasharray="4 2" />
    <line x1="44" y1="84" x2="52" y2="84" stroke={AMBER} strokeWidth="2" strokeDasharray="4 2" />
  </svg>
);
export const GuideCalf = () => (
  <svg {...guideSvgProps}>
    <FrontSilhouette />
    <line x1="28" y1="100" x2="36" y2="100" stroke={AMBER} strokeWidth="2" strokeDasharray="4 2" />
    <line x1="44" y1="100" x2="52" y2="100" stroke={AMBER} strokeWidth="2" strokeDasharray="4 2" />
  </svg>
);