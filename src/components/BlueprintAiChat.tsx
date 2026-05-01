import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Send, Loader2, Check, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { discussBlueprint } from "@/server/phased/stage2-blueprint.functions";
import type { Blueprint } from "@/server/phased/schemas";
import { toast } from "sonner";

type ChatMsg = { role: "user" | "assistant"; content: string; patch?: Partial<Blueprint> | null; costUsd?: number };

export function BlueprintAiChat({
  planId,
  blueprint,
  onApplyPatch,
}: {
  planId: string;
  blueprint: Blueprint;
  onApplyPatch: (patch: Partial<Blueprint>) => void;
}) {
  const discussFn = useServerFn(discussBlueprint);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const payload = next.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const res = await discussFn({
        data: { planId, messages: payload, currentBlueprint: blueprint },
      });
      if (!res.ok) {
        toast.error(res.error || "AI error");
        setMessages([...next, { role: "assistant", content: `⚠️ ${res.error || "AI error"}` }]);
        return;
      }
      setMessages([
        ...next,
        {
          role: "assistant",
          content: res.reply || (res.patch ? "Proposta de alteração pronta." : "(sem resposta)"),
          patch: res.patch ?? null,
          costUsd: res.costUsd,
        },
      ]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Pedir à IA
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> Assistente do Blueprint
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Pede para reequilibrar, trocar archetypes ou explicar uma decisão.
          </p>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Exemplo: "Adiciona um dia de mobilidade", "Troca conditioning por full body", "Justifica o modelo undulating".
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-xl p-3 text-sm ${
                m.role === "user"
                  ? "ml-6 bg-accent/15 text-foreground"
                  : "mr-6 border border-border bg-card text-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.patch && (
                <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                  <div className="mb-1 font-semibold text-amber-600">Patch proposto</div>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {m.patch.session_archetypes && (
                      <li>session_archetypes ({m.patch.session_archetypes.length})</li>
                    )}
                    {m.patch.week_to_session_map && (
                      <li>week_to_session_map ({Object.keys(m.patch.week_to_session_map).length} weeks)</li>
                    )}
                    {m.patch.progression_model_proposal && (
                      <li>progression_model_proposal: {m.patch.progression_model_proposal.model}</li>
                    )}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        onApplyPatch(m.patch!);
                        toast.success("Patch aplicado localmente. Não esqueças de Aprovar.");
                        setOpen(false);
                      }}
                      className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                    >
                      <Check className="h-3 w-3" /> Aplicar
                    </button>
                    <button
                      onClick={() =>
                        setMessages((prev) => prev.map((x, j) => (j === i ? { ...x, patch: null } : x)))
                      }
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
                    >
                      <X className="h-3 w-3" /> Descartar
                    </button>
                  </div>
                </div>
              )}
              {m.costUsd != null && m.role === "assistant" && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  ${m.costUsd.toFixed(4)}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Escreve a tua pergunta…"
              className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
              aria-label="Enviar"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}