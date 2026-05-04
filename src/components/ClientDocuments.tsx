import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Upload, Trash2, Loader2, Download, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import {
  listClientDocuments,
  uploadClientDocument,
  getDocumentSignedUrl,
  deleteClientDocument,
} from "@/server/client-documents.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Item = { name: string; created_at?: string; metadata?: { size?: number; mimetype?: string } };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/**
 * ClientDocuments — pasta privada de exames médicos, prescrições e outros
 * ficheiros do cliente. RLS garante que cada trainer só vê os seus.
 */
export function ClientDocuments({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const list = useServerFn(listClientDocuments);
  const upload = useServerFn(uploadClientDocument);
  const sign = useServerFn(getDocumentSignedUrl);
  const del = useServerFn(deleteClientDocument);

  const refresh = async () => {
    try {
      const r: any = await list({ data: { clientId } });
      setItems((r?.items ?? []).filter((i: Item) => i.name && !i.name.startsWith(".")));
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou ao listar.");
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 15_000_000) {
          toast.error(`${f.name}: máx 15MB`);
          continue;
        }
        const dataUrl = await fileToDataUrl(f);
        await upload({ data: { clientId, filename: f.name, dataUrl } });
      }
      toast.success("Carregado.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload falhou.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const open = async (name: string) => {
    try {
      const r: any = await sign({ data: { clientId, name } });
      if (r?.url) window.open(r.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou.");
    }
  };

  const remove = async (name: string) => {
    if (!confirm(`Remover ${name}?`)) return;
    try {
      await del({ data: { clientId, name } });
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou.");
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Documentos do cliente"
          title="Documentos · exames, prescrições, anamneses (privado)"
          className="relative inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-[oklch(0.78_0.10_200)] hover:border-[oklch(0.78_0.10_200/0.5)] hover:bg-[oklch(0.78_0.10_200/0.08)]"
        >
          <Stethoscope className="h-3.5 w-3.5" />
          <span>Docs</span>
          {items.length > 0 && (
            <span className="ml-0.5 rounded-full bg-[oklch(0.78_0.10_200/0.18)] px-1.5 py-px text-[10px] font-semibold text-[oklch(0.78_0.10_200)]">
              {items.length}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-[oklch(0.78_0.10_200)]">
            <Stethoscope className="h-4 w-4" /> Documentos
          </SheetTitle>
          <p className="text-xs text-muted-foreground">Exames médicos, prescrições, anamneses (privado)</p>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-xs font-medium hover:border-accent"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Carregar ficheiro
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept="application/pdf,image/*,.doc,.docx,.txt"
            onChange={(e) => void onPick(e.target.files)}
          />
          {items.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Sem documentos.</p>
          ) : (
            <ul className="space-y-1">
              {items.map((it) => (
                <li key={it.name} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/40">
                  <button onClick={() => open(it.name)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[oklch(0.78_0.10_200)]" />
                    <span className="truncate">{it.name.replace(/^[\w-]+-/, "")}</span>
                  </button>
                  <button onClick={() => open(it.name)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Abrir">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(it.name)} className="rounded p-1 text-muted-foreground hover:text-red-500" aria-label="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}