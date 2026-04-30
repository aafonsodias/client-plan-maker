import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Home, Users, Settings, LogOut, ArrowLeft, ExternalLink } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useEffect, type ReactNode } from "react";

export function AppShell({ children, back }: { children: ReactNode; back?: { to: string; label?: string } }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: Home },
    { to: "/clients", label: "Clients", icon: Users },
    { to: "/settings", label: "Branding", icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-light tracking-[0.2em] uppercase text-sm">
            <Logo className="h-8 w-8" />
            <span>FORGE</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = location.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" title="View landing page">
              <Link to="/">
                <ExternalLink className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Landing</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { void signOut().then(() => navigate({ to: "/" })); }}>
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">
        {back && location.pathname !== "/dashboard" && (
          <button
            onClick={() => navigate({ to: back.to as any })}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {back.label ?? "Back"}
          </button>
        )}
        {children}
      </main>
    </div>
  );
}