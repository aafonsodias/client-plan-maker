import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStudiesFeed } from "@/server/studies.functions";

type Topic = "strength" | "hypertrophy" | "rehab" | "endurance";
const TOPICS: { id: Topic; label: string }[] = [
  { id: "strength", label: "Força" },
  { id: "hypertrophy", label: "Hipertrofia" },
  { id: "rehab", label: "Reabilitação" },
  { id: "endurance", label: "Resistência" },
];

type Study = {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubdate: string;
  url: string;
};

export function StudiesFeed() {
  const fn = useServerFn(getStudiesFeed);
  const [topic, setTopic] = useState<Topic>("strength");
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn({ data: { topic, limit: 8 } })
      .then((r: any) => {
        if (cancelled) return;
        if (r?.ok) setStudies(r.studies ?? []);
        else setError(r?.error ?? "Falha a carregar estudos.");
      })
      .catch((e) => !cancelled && setError(e?.message ?? "Erro de rede."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [topic, fn]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Quadro de estudos</h3>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          <BookOpenCheck className="h-3 w-3" /> PubMed · 12 meses
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTopic(t.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
              topic === t.id
                ? "border-amber-500/60 bg-amber-500/15 text-amber-500"
                : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && studies.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border p-8 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> a consultar PubMed…
        </div>
      ) : error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
      ) : studies.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          Sem resultados.
        </p>
      ) : (
        <ol className="space-y-2">
          {studies.map((s) => (
            <li key={s.pmid} className="rounded-md border border-border/60 bg-card/40 p-3 text-sm">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2"
              >
                <span className="flex-1">
                  <span className="block font-medium leading-snug text-foreground group-hover:text-amber-500">
                    {s.title}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {s.authors.join(", ")}
                    {s.authors.length === 4 && " et al."}
                    {s.journal && <> · <em className="not-italic">{s.journal}</em></>}
                    {s.pubdate && <> · {s.pubdate}</>}
                  </span>
                </span>
                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-amber-500" />
              </a>
            </li>
          ))}
        </ol>
      )}

      <p className="text-[10px] text-muted-foreground">
        Resultados em cache 6 h. Conteúdo proveniente de PubMed (NCBI/NLM), domínio público.
      </p>
    </div>
  );
}