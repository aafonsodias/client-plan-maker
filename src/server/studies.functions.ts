import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * getStudiesFeed — devolve estudos recentes do PubMed para um tópico.
 * Sem chave, sem dependências externas. Cache em memória de 6 h por tópico
 * (válido enquanto o worker estiver vivo — bom o suficiente).
 */

type Study = {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubdate: string;
  url: string;
};

type Topic = "strength" | "hypertrophy" | "rehab" | "endurance";

const TOPIC_QUERY: Record<Topic, string> = {
  strength: '("resistance training"[MeSH] OR "strength training") AND ("last 1 year"[PDat])',
  hypertrophy: '"muscle hypertrophy"[MeSH] AND ("last 1 year"[PDat])',
  rehab: '("rehabilitation"[MeSH] OR "physical therapy") AND exercise AND ("last 1 year"[PDat])',
  endurance: '"endurance training"[MeSH] AND ("last 1 year"[PDat])',
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<Topic, { fetchedAt: number; data: Study[] }>();

async function fetchPubmed(topic: Topic, limit: number): Promise<Study[]> {
  const term = encodeURIComponent(TOPIC_QUERY[topic]);
  const esearch = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=date&retmax=${limit}&term=${term}`,
  );
  if (!esearch.ok) throw new Error(`esearch ${esearch.status}`);
  const esearchJson: any = await esearch.json();
  const ids: string[] = esearchJson?.esearchresult?.idlist ?? [];
  if (!ids.length) return [];
  const esum = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`,
  );
  if (!esum.ok) throw new Error(`esummary ${esum.status}`);
  const esumJson: any = await esum.json();
  const result = esumJson?.result ?? {};
  return ids
    .map((pmid) => {
      const r = result[pmid];
      if (!r) return null;
      return {
        pmid,
        title: String(r.title ?? "").replace(/\s+/g, " ").trim(),
        authors: ((r.authors ?? []) as any[]).slice(0, 4).map((a) => a.name).filter(Boolean),
        journal: String(r.fulljournalname ?? r.source ?? ""),
        pubdate: String(r.pubdate ?? ""),
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      } satisfies Study;
    })
    .filter((s): s is Study => Boolean(s));
}

export const getStudiesFeed = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        topic: z.enum(["strength", "hypertrophy", "rehab", "endurance"]).default("strength"),
        limit: z.number().int().min(1).max(20).default(8),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const cached = cache.get(data.topic);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { ok: true as const, studies: cached.data, cached: true };
    }
    try {
      const studies = await fetchPubmed(data.topic, data.limit);
      cache.set(data.topic, { fetchedAt: Date.now(), data: studies });
      return { ok: true as const, studies, cached: false };
    } catch (e: any) {
      // Falha de rede: devolve o cache antigo se existir.
      if (cached) return { ok: true as const, studies: cached.data, cached: true, stale: true };
      return { ok: false as const, error: e?.message ?? "Falha ao consultar PubMed.", studies: [] as Study[] };
    }
  });