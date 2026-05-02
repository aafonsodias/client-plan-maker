import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { saveTemplateFromPlan } from "@/server/templates.functions";

export function SaveAsTemplateDialog({ planId, defaultName }: { planId: string; defaultName?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName ?? "");
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const saveFn = useServerFn(saveTemplateFromPlan);

  const onSave = async () => {
    if (!name.trim()) return toast.error("Dá um nome ao template.");
    setBusy(true);
    try {
      const tags = tagsRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
      const res: any = await saveFn({ data: { planId, name: name.trim(), description: description.trim() || undefined, tags } });
      if (res?.ok) {
        toast.success("Template guardado. Reutiliza em qualquer cliente.");
        setOpen(false);
        setName(defaultName ?? "");
        setDescription("");
        setTagsRaw("");
      } else {
        toast.error(res?.error ?? "Falhou guardar template.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8" title="Guardar como template para reutilizar">
          <Bookmark className="mr-1.5 h-3.5 w-3.5" /> Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Guardar como template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="tpl-name">Nome</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hipertrofia 12sem · iniciante" />
          </div>
          <div>
            <Label htmlFor="tpl-desc">Descrição (opcional)</Label>
            <Textarea id="tpl-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quem é o cliente típico, objetivos, equipamento…" />
          </div>
          <div>
            <Label htmlFor="tpl-tags">Tags (separadas por vírgula)</Label>
            <Input id="tpl-tags" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="hipertrofia, iniciante, ginásio" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Guardar template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}