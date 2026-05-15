import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { loadProposal } from "@/server/adaptation/proposal.functions";
import { decideAdaptation } from "@/server/blocks.functions";

export const Route = createFileRoute(
  "/clients_/$clientId/adaptation/$proposalId",
)({
  head: () => ({
    meta: [
      { title: "Decisão de bloco — Protocol" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdaptationReview,
});

type DecisionKind =
  | "continueAsIs"
  | "adjustCurrentSession"
  | "adjustUpcoming"
  | "defer"
  | "accept";

const KIND_LABELS: Record<DecisionKind, { title: string; help: string }> = {
  continueAsIs: {
    title: "Continuar como está",
    help: "Mantém o programa actual sem alterações. Nada é gerado.",
  },
  adjustCurrentSession: {
    title: "Ajustar a sessão actual",
    help: "Alteração pontual no plano em curso. Não gera bloco novo.",
  },
  adjustUpcoming: {
    title: "Ajustar próximo bloco",
    help: "Gera Bloco N+1 usando a proposta — com as suas edições por cima.",
  },
  defer: {
    title: "Adiar decisão",
    help: "Regista a evidência e revisita mais tarde. Nada é gerado.",
  },
  accept: {
    title: "Aceitar proposta",
    help: "Gera Bloco N+1 exactamente como o motor sugere.",
  },
};

function AdaptationReview() {
  const { clientId, proposalId } = Route.useParams();
  const navigate = useNavigate();
  const fetchProposal = useServerFn(loadProposal);
  const submitDecision = useServerFn(decideAdaptation);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["adaptation-proposal", proposalId],
    queryFn: () => fetchProposal({ data: { proposalId } }),
  });

  const [kind, setKind] = useState<DecisionKind>("accept");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const proposalJson = (data?.ok && (data.proposal?.proposal ?? {})) || {};
  const diff = (proposalJson as any).prescriptionDiff ?? [];
  const metrics = (proposalJson as any).metrics ?? [];
  const adherencePct = (proposalJson as any).adherencePct ?? 0;
  const recommendDeload = (proposalJson as any).recommendDeload ?? false;
  const status = data?.ok ? data.proposal?.status : null;
  const decision = data?.ok ? data.decision : null;

  const markersByMetric = useMemo(() => {
    const out = new Map<string, Array<{ scope: string; value: number }>>();
    if (!data?.ok) return out;
    for (const m of data.markers) {
      const arr = out.get(m.metric as string) ?? [];
      arr.push({ scope: m.scope as string, value: Number(m.value) });
      out.set(m.metric as string, arr);
    }
    return out;
  }, [data]);

  async function handleSubmit() {
    if (rationale.trim().length < 1) {
      toast.error("Escreva uma justificação antes de submeter.");
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await submitDecision({
        data: { proposalId, kind, rationale: rationale.trim() },
      });
      if (!res?.ok) {
        toast.error(res?.error ?? "Falhou a registar a decisão.");
        return;
      }
      toast.success("Decisão registada.");
      if (res.planId) {
        navigate({ to: "/plans/$planId", params: { planId: res.planId } });
      } else {
        await refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell back={{ to: `/clients/${clientId}` }}>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!data?.ok) {
    return (
      <AppShell back={{ to: `/clients/${clientId}` }}>
        <div className="mx-auto max-w-xl py-16 text-center">
          <h1 className="text-xl font-semibold">Proposta indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data?.error ?? "Não foi possível carregar a proposta."}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/clients_/$clientId" params={{ clientId }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao cliente
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const clientName = data.client?.full_name ?? "cliente";
  const priorBlock = data.priorPlan?.block_number ?? 1;

  return (
    <AppShell back={{ to: `/clients/${clientId}`, label: clientName }}>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Bloco {priorBlock} · Decisão de transição
          </p>
          <h1 className="text-2xl font-semibold">
            O Protocol mostra evidência. Você decide.
          </h1>
          <p className="text-sm text-muted-foreground">
            Calculado a partir dos logs deste bloco. Não é uma recomendação.
            Cargas e progressões são suas para definir.
          </p>
          {status === "decided" && decision ? (
            <Badge variant="secondary" className="mt-2">
              Já decidido: {KIND_LABELS[decision.kind as DecisionKind]?.title}
            </Badge>
          ) : null}
        </header>

        {/* 1. Evidence — read-only, neutral */}
        <section className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Evidência
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Calculado a partir dos seus logs.
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Adesão</dt>
              <dd className="text-lg font-medium">{adherencePct}%</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Pain flags</dt>
              <dd className="text-lg font-medium">
                {(proposalJson as any).painFlagsCount ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Padrões com sinal</dt>
              <dd className="text-lg font-medium">{metrics.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Hash dos inputs</dt>
              <dd className="font-mono text-[11px] text-muted-foreground">
                {String(data.proposal.inputs_hash ?? "").slice(0, 10)}…
              </dd>
            </div>
          </dl>

          {metrics.length > 0 ? (
            <div className="mt-4 space-y-2">
              {metrics.map((m: any) => (
                <div
                  key={m.pattern}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background/60 px-3 py-2 text-xs"
                >
                  <span className="font-medium">{m.pattern}</span>
                  <span className="text-muted-foreground">
                    Δe1RM {m.e1rmDeltaPct > 0 ? "+" : ""}
                    {m.e1rmDeltaPct}% · RPE drift{" "}
                    {m.rpeDriftPoints > 0 ? "+" : ""}
                    {m.rpeDriftPoints}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* 2. Engine proposal — read-only, amber */}
        <section className="rounded-lg border border-amber-300/60 bg-amber-50/40 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Proposta do motor
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Determinístico · v{(data.proposal.engine_versions as any)?.adaptation ?? "?"}
            </span>
          </div>
          {recommendDeload ? (
            <p className="mb-3 text-xs text-amber-900 dark:text-amber-200">
              {(proposalJson as any).deloadReason ?? "Sinais de fadiga acumulada."}
            </p>
          ) : null}
          {diff.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem diferenças por padrão — dados insuficientes ou bloco estável.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {diff.map((d: any, i: number) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200/60 bg-background/60 px-3 py-2 dark:border-amber-500/20"
                >
                  <span className="font-medium">{d.exerciseSlug}</span>
                  <span className="text-xs text-muted-foreground">
                    Carga {d.loadDeltaPct > 0 ? "+" : ""}
                    {d.loadDeltaPct}% · Sets{" "}
                    {d.setsDelta > 0 ? "+" : ""}
                    {d.setsDelta} · RPE alvo {d.rpeTarget}
                  </span>
                  <span className="basis-full text-xs text-muted-foreground">
                    {d.reasonChip}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. Trainer decision */}
        <section className="rounded-lg border bg-background p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            A sua decisão
          </h2>

          {status === "decided" ? (
            <p className="text-sm text-muted-foreground">
              Esta proposta já foi decidida em{" "}
              {decision?.decided_at
                ? new Date(decision.decided_at).toLocaleString()
                : "—"}
              . Justificação: {decision?.rationale ?? "—"}
            </p>
          ) : (
            <>
              <RadioGroup
                value={kind}
                onValueChange={(v) => setKind(v as DecisionKind)}
                className="space-y-2"
              >
                {(Object.keys(KIND_LABELS) as DecisionKind[]).map((k) => (
                  <div
                    key={k}
                    className="flex items-start gap-3 rounded border p-3"
                  >
                    <RadioGroupItem value={k} id={`kind-${k}`} className="mt-1" />
                    <Label htmlFor={`kind-${k}`} className="flex-1 cursor-pointer">
                      <div className="text-sm font-medium">
                        {KIND_LABELS[k].title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {KIND_LABELS[k].help}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="mt-4 space-y-2">
                <Label htmlFor="rationale" className="text-xs">
                  Justificação (obrigatória)
                </Label>
                <Textarea
                  id="rationale"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Porquê esta decisão? O que viu nos logs ou na conversa que pesou?"
                  rows={4}
                />
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Registar decisão
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}