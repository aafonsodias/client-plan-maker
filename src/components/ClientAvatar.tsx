import { User, BadgeCheck } from "lucide-react";

/**
 * Deterministic warm palette for monogram fallback.
 * Same client id → same swatch, every render. Tones picked to sit
 * comfortably on the warm tonal canvas (muted amber / clay / sage / sand /
 * taupe / dusk). No skin-tone implications, no AI portrait gambling.
 */
const MONOGRAM_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: "#E8D9C0", fg: "#5C4424" }, // sand
  { bg: "#E4CBB0", fg: "#6B4524" }, // muted amber
  { bg: "#D9C9B8", fg: "#4F3E2C" }, // taupe
  { bg: "#CFD8C7", fg: "#3D4A37" }, // sage
  { bg: "#D8C9C0", fg: "#5A3F38" }, // clay
  { bg: "#C9CFD6", fg: "#3A4654" }, // dusk
  { bg: "#E0D2C0", fg: "#5A4128" }, // wheat
  { bg: "#CCBFB1", fg: "#46382A" }, // stone
];

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Compact circular avatar for clients.
 *
 * Falls back to a confident deterministic monogram (1-2 initials over a
 * warm tonal swatch derived from the client's name) when no `photo_url` is
 * provided. Same name → same swatch, every render. Real photos always win.
 */
export function ClientAvatar({
  name,
  photoUrl,
  size = 32,
  className = "",
  verified = false,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
  /** When true, overlays a small amber check badge (bottom-right). */
  verified?: boolean;
}) {
  const initials = (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const badgeSize = Math.max(12, Math.round(size * 0.32));
  const swatch = MONOGRAM_PALETTE[hashString(name || "·") % MONOGRAM_PALETTE.length];
  const inner = photoUrl ? (
    <img
      src={photoUrl}
      alt={name}
      loading="lazy"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded-full object-cover ring-1 ring-border"
    />
  ) : (
    <div
      aria-hidden
      style={{ width: size, height: size, backgroundColor: swatch.bg, color: swatch.fg }}
      className="flex items-center justify-center rounded-full ring-1 ring-border/40"
      title={name}
    >
      {initials ? (
        <span
          className="font-semibold leading-none tracking-tight"
          style={{ fontSize: Math.max(11, Math.round(size * 0.42)) }}
        >
          {initials}
        </span>
      ) : (
        <User style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </div>
  );
  if (!verified) {
    return <span className={`inline-block ${className}`}>{inner}</span>;
  }
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
      title={`${name} · verificado`}
    >
      {inner}
      <BadgeCheck
        className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background fill-amber-500 text-amber-950"
        style={{ width: badgeSize, height: badgeSize }}
        aria-label="verified"
      />
    </span>
  );
}