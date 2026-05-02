import { useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, X, Send, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { askConcierge } from "@/server/concierge.functions";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string; suggestions?: Array<{ path: string; label: string }> };

/**
 * ConciergeDock — floating help chat. Founder-only for now.
 * Sends current route to the server fn so answers are context-aware.
 */
export function ConciergeDock({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Olá! Pergunta-me onde encontrar algo na app." },
  ]);
  const ask = useServerFn(askConcierge);
  const location = useLocation();
  const navigate = useNavigate();

  if (!enabled) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res: any = await ask({
        data: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          currentPath: location.pathname,
        },
      });
      if (!res?.ok) {
        toast.error(res?.error ?? "Concierge falhou");
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: res.reply, suggestions: res.suggestions }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Concierge falhou");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-accent/40 bg-card shadow-[var(--shadow-elegant)] hover:border-accent transition"
          aria-label="Abrir concierge"
          title="Concierge"
        >
          <HelpCircle className="h-5 w-5 text-accent" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-4 left-4 z-40 w-80 max-h-[70vh] flex flex-col rounded-2xl border border-accent/40 bg-card/95 backdrop-blur shadow-[var(--shadow-elegant)]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Concierge</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-muted" aria-label="Fechar">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-secondary px-3 py-2 text-secondary-foreground" : "max-w-[85%] rounded-lg bg-muted/40 px-3 py-2"}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.suggestions.map((s, si) => (
                      <button
                        key={si}
                        type="button"
                        onClick={() => navigate({ to: s.path as any })}
                        className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/20"
                      >
                        {s.label} <ArrowRight className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> A pensar…
              </div>
            )}
          </div>
          <div className="border-t border-border p-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
              placeholder="Onde está…?"
              className="flex-1 h-8 rounded-md bg-secondary px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              disabled={busy}
            />
            <Button type="button" size="sm" onClick={() => void send()} disabled={busy || !input.trim()} className="h-8 px-2">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}