import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import {
  checkAdmin,
  listIterations,
  createIteration,
} from "@/server/knowledge/system-iterations.functions";

export const Route = createFileRoute("/admin/system")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AdminSystemPage,
});

function AdminSystemPage() {
  const checkAdminFn = useServerFn(checkAdmin);
  const listFn = useServerFn(listIterations);
  const createFn = useServerFn(createIteration);

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [iterations, setIterations] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", title: "", summary: "", modules: "" });
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const res = await listFn();
    if ((res as any).ok) setIterations((res as any).iterations);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const a = await checkAdminFn();
      if (cancelled) return;
      setIsAdmin(!!(a as any).isAdmin);
      if ((a as any).isAdmin) await refresh();
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setSaving(true);
    const res = await createFn({
      data: {
        code: form.code.trim(),
        title: form.title.trim(),
        summary: form.summary.trim(),
        affected_modules: form.modules.split(",").map((s) => s.trim()).filter(Boolean),
      },
    });
    setSaving(false);
    if ((res as any).ok) {
      toast.success("Iteração registada.");
      setOpen(false);
      setForm({ code: "", title: "", summary: "", modules: "" });
      await refresh();
    } else {
      toast.error((res as any).error ?? "Falhou.");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A verificar permissões…
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">
          Esta área é restrita a administradores.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell back={{ to: "/dashboard", label: "Dashboard" }}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            System · Iterações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico de evolução do produto. Só visível para admins.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Nova iteração</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova iteração</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="mb-1 block text-xs">Código (ex: R74)</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Título</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Resumo</Label>
                <Textarea
                  rows={4}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Módulos afetados (separados por vírgula)</Label>
                <Input value={form.modules} onChange={(e) => setForm({ ...form, modules: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving || !form.code || !form.title || !form.summary}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Registar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {iterations.map((it) => (
          <Card key={it.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <Badge variant="outline" className="font-mono text-xs">{it.code}</Badge>
                <span>{it.title}</span>
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {new Date(it.shipped_at).toLocaleDateString("pt-PT")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{it.summary}</p>
              {it.affected_modules?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {it.affected_modules.map((m: string) => (
                    <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {iterations.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">Sem iterações registadas.</div>
        )}
      </div>
    </AppShell>
  );
}