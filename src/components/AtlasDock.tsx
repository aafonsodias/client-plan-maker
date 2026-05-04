import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X, Send, Loader2, ArrowRight, Compass, MessageSquare, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ModelPicker } from "@/components/ai/ModelPicker";
import { useModelPreference } from "@/hooks/use-model-preference";
import { askConcierge } from "@/server/concierge.functions";
import { askAtlas } from "@/server/atlas.functions";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

type Mode = "navigate" | "ask";
type Msg = {
  role: "user" | "assistant";
  content: string;
  suggestions?: Array<{ path: string; label: string }>;
};

/**
 * AtlasDock — global floating dock for Atlas, Protocol's named copilot. Two modes:
 *  - Navigate: route-aware concierge ("where is X?") that returns clickable
 *    suggestion chips (replaces the old GuideDock).
 *  - Ask: open-ended coaching/programming chat with the user-chosen AI
 *    model and live credit cost (mirrors OpenAI/Claude UX).
 * Available to every signed-in trainer; not just founders.
 */
export function AtlasDock({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("ask");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [navigateMsgs, setNavigateMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Sou o Atlas. Diga-me o que procura na app — mostro-lhe onde está." },
  ]);
  const [askMsgs, setAskMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Sou o Atlas, copiloto do Protocol. Pergunte sobre programação, técnica, progressão ou um cliente que tenha aberto. Escolha o modelo em baixo — vê os créditos antes de gastar." },
  ]);
  const { model, setModel } = useModelPreference();
  const askConciergeFn = useServerFn(askConcierge);
  const askAtlasFn = useServerFn(askAtlas);
  const location = useLocation();
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const speechSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggleMic = () => {
    if (!speechSupported) {
      toast.error("O teu browser não suporta ditado por voz.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.lang = "pt-PT";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput((prev) => (prev ? prev + " " : "") + text.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  };

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [navigateMsgs, askMsgs, mode, busy]);

  if (!enabled) return null;

  const messages = mode === "navigate" ? navigateMsgs : askMsgs;
  const setMessages = mode === "navigate" ? setNavigateMsgs : setAskMsgs;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      if (mode === "navigate") {
        const res: any = await askConciergeFn({
          data: {
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            currentPath: location.pathname,
          },
        });
        if (!res?.ok) {
          toast.error(res?.error ?? "Falhou.");
          return;
        }
        setMessages((m) => [...m, { role: "assistant", content: res.reply, suggestions: res.suggestions }]);
      } else {
        const res: any = await askAtlasFn({
          data: {
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            model,
            currentPath: location.pathname,
          },
        });
        if (!res?.ok) {
          toast.error(res?.error ?? "Falhou.");
          return;
        }
        setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou.");
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
          className="fixed bottom-4 left-4 z-40 inline-flex h-12 items-center gap-2 rounded-full border border-accent/40 bg-card px-4 text-sm font-medium shadow-[var(--shadow-elegant)] transition hover:border-accent"
          aria-label="Atlas"
          title="Atlas — copiloto do Protocol"
        >
          <Logo className="h-4 w-4" />
          <span>Atlas</span>
        </button>
      )}
      {open && (
        <div className="fixed bottom-4 left-4 z-40 flex max-h-[80vh] w-96 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-accent/40 bg-card/95 backdrop-blur shadow-[var(--shadow-elegant)]">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <Logo className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold uppercase tracking-widest text-accent">Atlas</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-muted" aria-label="Fechar">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setMode("ask")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition",
                mode === "ask"
                  ? "border-b-2 border-accent text-accent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MessageSquare className="h-3 w-3" /> Perguntar à IA
            </button>
            <button
              type="button"
              onClick={() => setMode("navigate")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition",
                mode === "navigate"
                  ? "border-b-2 border-accent text-accent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Compass className="h-3 w-3" /> Navegar
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollerRef} className="flex-1 space-y-3 overflow-auto p-3 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[88%] rounded-2xl px-3 py-2 leading-relaxed",
                  m.role === "user"
                    ? "ml-auto rounded-tr-sm bg-secondary text-secondary-foreground"
                    : "rounded-tl-sm border border-accent/20 bg-accent/5",
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
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

          {/* Composer + (Ask mode) model picker */}
          <div className="border-t border-border p-2">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={mode === "navigate" ? "Onde está…?" : "Pergunta algo de coaching ou programação…"}
                className="h-8 flex-1 rounded-md bg-secondary px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                disabled={busy}
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs transition",
                    listening
                      ? "border-red-500/60 bg-red-500/10 text-red-500"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={listening ? "Parar ditado" : "Ditar"}
                  title={listening ? "Parar ditado" : "Ditar (PT)"}
                >
                  {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </button>
              )}
              <Button type="button" size="sm" onClick={() => void send()} disabled={busy || !input.trim()} className="h-8 px-2">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            {mode === "ask" && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Paga só o que usares
                </span>
                <ModelPicker value={model} onChange={setModel} size="sm" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}