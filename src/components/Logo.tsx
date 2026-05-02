// Logo — raw mark used on the public landing page and auth screens.
// For internal app chrome (headers under authentication), use <BrandMark /> instead.
import logoUrl from "@/assets/forge-logo.png";

export function Logo({ className = "h-4 w-4" }: { className?: string }) {
  return <img src={logoUrl} alt="Forge logo" className={className} />;
}