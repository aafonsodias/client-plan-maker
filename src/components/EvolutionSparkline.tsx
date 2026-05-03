/**
 * Tiny dependency-free sparkline. Renders an SVG polyline tonal to the
 * verdict (emerald = gain, amber = flat, red = regression). Designed for
 * the dashboard "Recent plans" row — sits next to the Δ% chip.
 */
type Props = {
  values: number[];
  verdict?: "gain" | "flat" | "regression" | "unknown";
  width?: number;
  height?: number;
};

const STROKE: Record<NonNullable<Props["verdict"]>, string> = {
  gain: "rgb(16 185 129)",       // emerald-500
  flat: "rgb(245 158 11)",       // amber-500
  regression: "rgb(239 68 68)",  // red-500
  unknown: "rgb(148 163 184)",   // slate-400
};

export function EvolutionSparkline({
  values,
  verdict = "unknown",
  width = 64,
  height = 16,
}: Props) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = STROKE[verdict];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 opacity-90"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}