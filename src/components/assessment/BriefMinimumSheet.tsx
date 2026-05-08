import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import type { BmvResult } from "@/lib/brief-minimum";

/**
 * Checklist humano (sem percentagens) com o que ainda falta para o brief.
 * Cada item em falta tem um botão "Ver" que faz scroll para a secção certa
 * e fecha a sheet.
 */
export function BriefMinimumSheet({
  open,
  onOpenChange,
  bmv,
  busy,
  onJumpToSection,
  onStartBrief,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bmv: BmvResult;
  busy?: boolean;
  onJumpToSection: (sectionId: string) => void;
  onStartBrief: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Antes de gerar o brief</SheetTitle>
          <SheetDescription>
            {bmv.ready
              ? "Tem o mínimo. Pode gerar agora ou enriquecer com mais um ou dois itens recomendados."
              : "Faltam alguns dados básicos — todos preenchíveis sem laboratório, em casa ou no estúdio."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Block
            title="Obrigatório"
            tone={bmv.ready ? "ok" : "warn"}
            items={bmv.required}
            onJump={(s) => { onJumpToSection(s); onOpenChange(false); }}
          />
          <Block
            title="Recomendado · enriquece o plano"
            tone="info"
            items={bmv.recommended}
            onJump={(s) => { onJumpToSection(s); onOpenChange(false); }}
          />
          {bmv.ready && bmv.confidence === "lean" && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs text-foreground/80">
              Pode gerar já — mas com tão pouca informação extra o brief vai ser mais
              genérico. Importar a Tanita ou fazer uma medição de FC repouso (ver Performance)
              demora 1 minuto e melhora bastante o output.
            </p>
          )}
        </div>

        <SheetFooter className="mt-6 flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Continuar a preencher</Button>
          <Button
            disabled={!bmv.ready || busy}
            onClick={() => { onOpenChange(false); onStartBrief(); }}
          >
            {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
            Iniciar briefing IA
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Block({
  title,
  tone,
  items,
  onJump,
}: {
  title: string;
  tone: "ok" | "warn" | "info";
  items: BmvResult["required"];
  onJump: (sectionId: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <ul className="divide-y divide-border rounded-md border border-border bg-background/40">
        {items.map((it) => (
          <li key={it.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              {it.ok ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className={`h-4 w-4 shrink-0 ${tone === "warn" ? "text-amber-500" : "text-muted-foreground"}`} />
              )}
              <span className={`truncate text-sm ${it.ok ? "text-muted-foreground line-through decoration-emerald-500/40" : "text-foreground"}`}>
                {it.label}
              </span>
            </div>
            {!it.ok && (
              <button
                type="button"
                onClick={() => onJump(it.sectionId)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-secondary"
              >
                Ver <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
