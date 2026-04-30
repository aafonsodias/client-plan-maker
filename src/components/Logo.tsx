import logoUrl from "@/assets/forge-logo.png";

export function Logo({ className = "h-4 w-4" }: { className?: string }) {
  return <img src={logoUrl} alt="Forge logo" className={className} />;
}