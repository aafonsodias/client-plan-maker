// Logo — raw Protocol "P_" mark used on landing + auth + internal chrome.
// Inline SVG so the stencil P inherits currentColor (white in dark, ink in
// light/cream, light grey in slate). The blue accent under-tab is fixed.
// For internal app chrome, prefer <BrandMark /> which adds the amber glow.

export function Logo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-label="Protocol"
      role="img"
    >
      <path
        d="M14 12 L14 52 L22 52 L22 38 L36 38 C44 38 50 32 50 25 C50 18 44 12 36 12 Z M22 18 L36 18 C40 18 42 21 42 25 C42 29 40 32 36 32 L22 32 Z"
        fill="currentColor"
      />
      <rect x="20" y="55" width="14" height="3" rx="1" fill="#5BA3D8" />
    </svg>
  );
}