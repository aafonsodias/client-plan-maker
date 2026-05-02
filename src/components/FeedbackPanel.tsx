import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare, AlertCircle, HelpCircle, ThumbsUp, Bug, Wrench, CheckCircle2, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  listClientFeedback,
  addClientFeedback,
  setFeedbackStatus,
} from "@/server/feedback.functions";

type Row = {
  id: string;
  author: "client" | "trainer" | "bot" | "system";
  category: "pain" | "question" | "complaint" | "praise" | "app_bug" | "ux";
  body: string;
  status: "open" | "acknowledged" | "resolved";
  created_at: string;
  metadata?: any;
  plan_id?: string | null;
};

const CATEGORY_ICON: Record<Row["category"], typeof AlertCircle> = {
  pain: AlertCircle,
  question: HelpCircle,
  complaint: MessageSquare,
  praise: ThumbsUp,
  app_bug: Bug,
  ux: Wrench,
};

const CATEGORY_TONE: Record<Row["category"], string> = {
  pain: "text-red-500",
  complaint: "text-amber-500",
  question: "text-sky-500",
  praise: "text-emerald-500",
  app_bug: "text-fuchsia-500",
  ux: "text-violet-500",
};

const CATEGORY_LABEL: Record<Row["category"], string> = {
  pain: "Dor",
  complaint: "Queixa",
  question: "Pergunta",
  praise: "Elogio",
  app_bug: "Bug",
  ux: "UX",
};

const AUTHOR_LABEL: Record<Row["author"], string> = {
  client: "Cliente",
  trainer: "Treinador",
  bot: "Bot",
  system: "Sistema",
};

export function FeedbackPanel({ clientId, planId }: { clientId: string; planId?: string | null }) {
  const list = useServerFn(listClientFeedback);
  const add = useServerFn(addClientFeedback);
  const setStatus = useServerFn(setFeedbackStatus);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState<Row["category"]>("complaint");
  const [author, setAuthor] = useState<Row["author"]>("trainer");
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    setLoading(true);
    const res: any = await list({ data: { clientId } });
    setRows((res?.rows ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function submit() {
    if (!draft.trim()) return;
    setSubmitting(true);
    const res: any = await add({
      data: { clientId, planId: planId ?? null, author, category, body: draft.trim() },
    });
    setSubmitting(false);
    if (res?.ok) {
      setDraft("");
      toast.success("Feedback registado");
      reload();
    } else {
      toast.error(res?.error || "Falha ao registar feedback");
    }
  }

  async function ack(id: string, status: Row["status"]) {
    const res: any = await setStatus({ data: { id, status } });
    if (res?.ok) reload();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Feedback do cliente</h3>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{rows.length} entradas</span>
      </div>

      <div className="rounded-xl border border-dashed border-border/70 p-3">
        <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
          <select
            value={author}
            onChange={(e) => setAuthor(e.target.value as Row["author"])}
            className="rounded-md border border-border bg-background px-2 py-1"
          >
            <option value="trainer">Como treinador</option>
            <option value="client">Como cliente</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Row["category"])}
            className="rounded-md border border-border bg-background px-2 py-1"
          >
            <option value="complaint">Queixa</option>
            <option value="pain">Dor</option>
            <option value="question">Pergunta</option>
            <option value="praise">Elogio</option>
            <option value="app_bug">Bug da app</option>
            <option value="ux">UX</option>
          </select>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ex: O agachamento dói no joelho direito a meio do segundo set."
          className="w-full rounded-md border border-border bg-background p-2 text-xs"
          rows={2}
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !draft.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
            Registar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> A carregar…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">Sem feedback registado para este cliente.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const Icon = CATEGORY_ICON[r.category];
            return (
              <li
                key={r.id}
                className={`rounded-xl border border-border bg-background p-3 text-xs ${
                  r.status === "resolved" ? "opacity-60" : ""
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${CATEGORY_TONE[r.category]}`} />
                  <span className="font-medium text-foreground">{CATEGORY_LABEL[r.category]}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {AUTHOR_LABEL[r.author]} · {new Date(r.created_at).toLocaleDateString("pt-PT")}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{r.status}</span>
                </div>
                <p className="text-foreground/90">{r.body}</p>
                {r.status !== "resolved" && (
                  <div className="mt-2 flex justify-end gap-1.5">
                    {r.status === "open" && (
                      <button
                        onClick={() => ack(r.id, "acknowledged")}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-secondary"
                      >
                        <Eye className="h-3 w-3" /> Visto
                      </button>
                    )}
                    <button
                      onClick={() => ack(r.id, "resolved")}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-secondary"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Resolvido
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}