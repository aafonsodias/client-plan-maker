// Logo — raw Protocol "P_" mark used on landing + auth + internal chrome.
// For internal app chrome (headers under authentication), prefer <BrandMark />
// which adds the amber under-glow ring.
import logoUrl from "@/assets/protocol-mark.png";

export function Logo({ className = "h-4 w-4" }: { className?: string }) {
  return <img src={logoUrl} alt="Protocol logo" className={className} />;
}