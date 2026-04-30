import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/clients")({
  component: () => (
    <AppShell>
      <Clients />
    </AppShell>
  ),
});

type Client = { id: string; full_name: string; email: string | null; age: number | null; created_at: string };

function Clients() {
  const { user } = useAuth();
  const [list, setList] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", age: "", sex: "", height_cm: "", weight_kg: "", notes: "" });

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
    setOpen(false);
    setForm({ full_name: "", email: "", age: "", sex: "", height_cm: "", weight_kg: "", notes: "" });
    void load();
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
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((c) => (
            <Link
              key={c.id}
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0 hover:bg-secondary/50"
            >
              <div>
                <p className="font-semibold">{c.full_name}</p>
                <p className="text-sm text-muted-foreground">{c.email ?? "No email"}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
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