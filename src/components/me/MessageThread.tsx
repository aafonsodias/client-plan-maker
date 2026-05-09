import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadMessages, sendClientMessage, markMessagesRead } from "@/server/me.functions";

type Msg = { id: string; author: string; body: string; status: string; created_at: string };

/**
 * Realtime client ↔ trainer thread for /me. Powered by plan_feedback rows
 * (`author = client | trainer`). Subscribes to postgres_changes filtered by
 * `client_id`. Send box is disabled in trainer preview mode.
 */
export function MessageThread({
  clientId,
  previewing,
  asParam,
}: {
  clientId: string;
  previewing: boolean;
  asParam: string | null;
}) {
  const { t } = useTranslation("me");
  const load = useServerFn(loadMessages);
  const send = useServerFn(sendClientMessage);
  const markRead = useServerFn(markMessagesRead);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Initial load + mark trainer messages as acknowledged
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await load({ data: { as: asParam } });
        if (cancelled) return;
        setMessages((res as any).messages ?? []);
        if (!previewing) {
          await markRead({}).catch(() => {});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, markRead, asParam, previewing]);

  // Realtime — listen for new rows on plan_feedback for this client
  useEffect(() => {
    const channel = supabase
      .channel(`plan_feedback:${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plan_feedback",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const row = payload.new as Msg;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
          if (!previewing && row.author === "trainer") {
            void markRead({}).catch(() => {});
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, markRead, previewing]);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const onSend = async () => {
    const body = draft.trim();
    if (!body || previewing) return;
    setSending(true);
    // Optimistic
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      author: "client",
      body,
      status: "open",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      await send({ data: { body } });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card">
      <div className="border-b border-border/60 px-5 pb-2 pt-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("message.title")}
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex max-h-[420px] min-h-[160px] flex-col gap-2 overflow-y-auto px-4 py-4"
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("message.empty")}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.author === "client";
            return (
              <div
                key={m.id}
                className={["flex flex-col", mine ? "items-end" : "items-start"].join(" ")}
              >
                <div
                  className={[
                    "max-w-[82%] rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-sm bg-foreground text-background"
                      : "rounded-bl-sm border border-border bg-background/60 text-foreground",
                  ].join(" ")}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
                <span className="mt-0.5 px-1 text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  {mine ? t("message.you") : t("message.trainer")} ·{" "}
                  {new Date(m.created_at).toLocaleString("pt-PT", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          disabled={previewing || sending}
          placeholder={
            previewing ? t("preview.disabled_hint") : t("message.reply_placeholder")
          }
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:border-foreground/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={previewing || sending || !draft.trim()}
          aria-label={t("message.send")}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
}