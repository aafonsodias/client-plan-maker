import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, FileText } from "lucide-react";

export const Route = createFileRoute("/plans/")({
  component: () => (
    <AppShell>
      <PlansIndex />
    </AppShell>
  ),
});

type PlanRow = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  client: { full_name: string } | null;
};

function PlansIndex() {
  const { user } = useAuth();
  const [list, setList] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("workout_plans")
        .select("id, title, status, updated_at, client:clients(full_name)")
        .order("updated_at", { ascending: false });
      setList((data as any) ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Library</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight">Plans</h1>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-8 w-8 text-accent" />
          <p>No plans yet. Open a client and generate one.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((p) => (
            <Link
              key={p.id}
              to="/plans/$planId"
              params={{ planId: p.id }}
              className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0 hover:bg-secondary/50"
            >
              <div>
                <p className="font-semibold">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.client?.full_name ?? "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium uppercase tracking-wider text-secondary-foreground">
                  {p.status}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
