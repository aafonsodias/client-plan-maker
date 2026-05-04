import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listTemplates, deleteTemplate, applyTemplateToClient } from "@/server/templates.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowRight, Bookmark, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PaywallDialog } from "@/components/PaywallDialog";

export const Route = createFileRoute("/templates")({
  component: () => (
    <AppShell back={{ to: "/dashboard", label: "Dashboard" }}>
      <TemplatesIndex />
    </AppShell>
  ),
});

type Tpl = {
  id: string; name: string; description: string | null;
  duration_weeks: number; tags: string[]; use_count: number; updated_at: string;
};

function TemplatesIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(listTemplates);
  const delFn = useServerFn(deleteTemplate);
  const applyFn = useServerFn(applyTemplateToClient);
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [picker, setPicker] = useState<Tpl | null>(null);
  const [applying, setApplying] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const refresh = async () => {
    const r: any = await listFn({});
    setItems(r?.ok ? r.templates : []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void refresh();
    void supabase.from("clients").select("id, full_name").order("full_name").then(({ data }) => {
      setClients((data as any) ?? []);
    });
  }, [user]);

  const onDelete = async (id: string) => {
    const r: any = await delFn({ data: { templateId: id } });
    if (r?.ok) {
      setItems((l) => l.filter((t) => t.id !== id));
      toast.success("Template apagado.");
    } else toast.error(r?.error ?? "Falhou.");
  };

  const onApply = async (clientId: string) => {
    if (!picker) return;
    setApplying(true);
    try {
      const r: any = await applyFn({ data: { templateId: picker.id, clientId } });
      if (r?.ok) {
        toast.success("Plano criado a partir do template.");
        setPicker(null);
        navigate({ to: "/plans/$planId", params: { planId: r.planId } });
      } else if (r?.error === "quota_exceeded") {
        setPicker(null);
        setPaywallOpen(true);
      } else {
        toast.error(r?.error ?? "Falhou aplicar template.");
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Library</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight">Templates</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Guarda planos finalizados e reutiliza-os em qualquer cliente em segundos — sem refazer o pipeline da AI.
          Para guardar, abre um plano e clica em <span className="font-medium text-foreground">Template</span>.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          <Bookmark className="mx-auto mb-3 h-8 w-8 text-accent" />
          <p>Ainda não tens templates. Abre um plano pronto e guarda como template.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{t.name}</h3>
                  {t.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {t.duration_weeks} sem
                    </span>
                    {t.tags?.map((tg) => (
                      <span key={tg} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                        {tg}
                      </span>
                    ))}
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                      usado {t.use_count}×
                    </span>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Apagar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apagar template "{t.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita. Planos já criados a partir deste template não são afetados.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void onDelete(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Apagar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={() => setPicker(t)}>
                  Aplicar a cliente <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aplicar "{picker?.name}" a um cliente</DialogTitle>
          </DialogHeader>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Adiciona um cliente primeiro.{" "}
              <Link to="/dashboard" search={{ filter: "all" }} className="text-accent underline">Ir para o Dashboard</Link>
            </p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {clients.map((c) => (
                <button
                  key={c.id}
                  disabled={applying}
                  onClick={() => void onApply(c.id)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                >
                  <span>{c.full_name}</span>
                  {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} reason="quota" />
    </div>
  );
}