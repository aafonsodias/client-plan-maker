import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { planStatusInfo } from "@/lib/plan-status";

export const Route = createFileRoute("/plans/")({
  component: () => (
    <AppShell back={{ to: "/dashboard", label: "Dashboard" }}>
      <PlansIndex />
    </AppShell>
  ),
});

type PlanRow = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  generation_state: { stage?: string } | null;
  generation_status: string | null;
  client: { full_name: string } | null;
};

function PlansIndex() {
  const { user } = useAuth();
  const [list, setList] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("workout_plans")
        .select("id, title, status, updated_at, generation_state, generation_status, client:clients(full_name)")
        .order("updated_at", { ascending: false });
      setList((data as any) ?? []);
      setLoading(false);
      const { data: cs } = await supabase.from("clients").select("id, full_name").order("full_name");
      setClients((cs as any) ?? []);
    })();
  }, [user]);

  const removePlan = async (id: string) => {
    const { error } = await supabase.from("workout_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setList((l) => l.filter((p) => p.id !== id));
    toast.success("Plan deleted");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Library</p>
          <h1 className="mt-1 text-4xl font-light tracking-tight">Plans</h1>
        </div>
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New plan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Choose a client</DialogTitle>
            </DialogHeader>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add a client first.{" "}
                <Link to="/dashboard" search={{ filter: "all" }} className="text-accent underline">Go to Dashboard</Link>
              </p>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {clients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setPickerOpen(false);
                      navigate({ to: "/clients/$clientId", params: { clientId: c.id } });
                    }}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <span>{c.full_name}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-8 w-8 text-accent" />
          <p>No plans yet. Click "New plan" to start.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((p) => (
            <div key={p.id} className="group flex items-center border-b border-border last:border-b-0 hover:bg-secondary/50">
              <Link
                to="/plans/$planId"
                params={{ planId: p.id }}
                className="flex flex-1 items-center justify-between px-5 py-4"
              >
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.client?.full_name ?? "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const s = planStatusInfo(p, t);
                    return (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider ${s.className}`}
                      >
                        {s.label}
                      </span>
                    );
                  })()}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="mr-3 rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete plan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{p.title}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the plan and all logged sessions. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void removePlan(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
