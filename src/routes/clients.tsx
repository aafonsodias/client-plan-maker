import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ArrowRight, Trash2 } from "lucide-react";
import { markOnboardingStep } from "@/components/OnboardingChecklist";
import { useClientPhases } from "@/hooks/use-client-phases";
import { ClientPhasePill } from "@/components/ClientPhasePill";
import { PhaseKind } from "@/lib/client-phase";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/clients")({
  validateSearch: (s: Record<string, unknown>): { filter?: string } => ({
    filter: typeof s.filter === "string" ? s.filter : undefined,
  }),
  component: () => (
    <AppShell back={{ to: "/dashboard", label: "Dashboard" }}>
      <Clients />
    </AppShell>
  ),
});

type Client = { id: string; full_name: string; email: string | null; age: number | null; created_at: string };

function Clients() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const filter = search.filter ?? "all";
  const [list, setList] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", age: "", sex: "", height_cm: "", weight_kg: "", notes: "" });
  const phases = useClientPhases(useMemo(() => list.map((c) => c.id), [list]));

  const matchesFilter = (kind?: PhaseKind): boolean => {
    if (filter === "all" || !kind) return filter === "all";
    if (filter === "active") return kind === "active";
    if (filter === "idle") return kind === "idle";
    if (filter === "ready") return kind === "ready";
    if (filter === "onboarding") return kind === "onboarding" || kind === "assessment";
    return true;
  };

  const filtered = list.filter((c) => filter === "all" || matchesFilter(phases[c.id]?.kind));

  const counts = useMemo(() => {
    const c = { all: list.length, active: 0, idle: 0, ready: 0, onboarding: 0 };
    list.forEach((cl) => {
      const k = phases[cl.id]?.kind;
      if (k === "active") c.active++;
      else if (k === "idle") c.idle++;
      else if (k === "ready") c.ready++;
      else if (k === "onboarding" || k === "assessment") c.onboarding++;
    });
    return c;
  }, [list, phases]);

  const load = async () => {
    const { data } = await supabase.from("clients").select("id, full_name, email, age, created_at").order("created_at", { ascending: false });
    setList((data as Client[]) ?? []);
  };

  useEffect(() => {
    if (user) void load();
  }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = {
      trainer_id: user.id,
      full_name: form.full_name,
      email: form.email || null,
      age: form.age ? Number(form.age) : null,
      sex: form.sex || null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      notes: form.notes || null,
    };
    const { error } = await supabase.from("clients").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Client added");
    void markOnboardingStep(user.id, "add_client");
    setOpen(false);
    setForm({ full_name: "", email: "", age: "", sex: "", height_cm: "", weight_kg: "", notes: "" });
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setList((l) => l.filter((c) => c.id !== id));
    toast.success("Client removed");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Roster</p>
          <h1 className="mt-1 text-4xl font-light tracking-tight">Clients</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New client</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <Field label="Full name" required value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Age" type="number" value={form.age} onChange={(v) => setForm({ ...form, age: v })} />
                <Field label="Sex" value={form.sex} onChange={(v) => setForm({ ...form, sex: v })} />
                <Field label="Height (cm)" type="number" value={form.height_cm} onChange={(v) => setForm({ ...form, height_cm: v })} />
              </div>
              <Field label="Weight (kg)" type="number" value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: v })} />
              <DialogFooter>
                <Button type="submit">Save client</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          No clients yet. Add your first one to get started.
        </div>
      ) : (
        <>
        <div className="flex flex-wrap gap-1 text-[11px] uppercase tracking-widest">
          {[
            { id: "all", label: `All · ${counts.all}` },
            { id: "onboarding", label: `Onboarding · ${counts.onboarding}` },
            { id: "active", label: `Active · ${counts.active}` },
            { id: "idle", label: `Idle · ${counts.idle}` },
            { id: "ready", label: `Ready for plan · ${counts.ready}` },
          ].map((f) => (
            <Link
              key={f.id}
              to="/clients"
              search={{ filter: f.id }}
              className={`rounded-full px-3 py-1 transition ${filter === f.id ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((c) => (
            <div key={c.id} className="group flex items-center border-b border-border last:border-b-0 hover:bg-secondary/50">
              <Link
                to="/clients/$clientId"
                params={{ clientId: c.id }}
                className="flex flex-1 items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-semibold">{c.full_name}</p>
                    <p className="text-sm text-muted-foreground">{c.email ?? "No email"}</p>
                  </div>
                  {phases[c.id] && <ClientPhasePill phase={phases[c.id]} />}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="mr-3 rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete client"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {c.full_name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the client and any associated assessments and plans. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void remove(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required = false,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}