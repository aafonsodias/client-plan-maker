import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { loadMe } from "@/server/me.functions";
import { ClientAvatar } from "@/components/ClientAvatar";
import { BrandMark } from "@/components/BrandMark";
import { Eye, Loader2 } from "lucide-react";

export const Route = createFileRoute("/me")({
  validateSearch: (s: Record<string, unknown>): { as?: string } => ({
    as: typeof s.as === "string" ? s.as : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: MePage,
});

function MePage() {
  const search = Route.useSearch();
  const load = useServerFn(loadMe);
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    void (async () => setState(await load({ data: { as: search.as ?? null } })))();
  }, [load, search.as]);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.linked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <BrandMark size="md" />
          <h1 className="mt-4 text-2xl font-light">A tua conta ainda não está ligada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pede ao teu treinador um novo link de questionário e termina o processo nesse separador para ligar a conta.
          </p>
          <Link to="/" className="mt-6 inline-block text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const { client, plan, trainer } = state;
  const previewing = !!state.previewing;

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        {previewing && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="inline-flex items-center gap-2">
              <Eye className="h-3.5 w-3.5" /> Pré-visualização como cliente · {client.full_name}
            </span>
            <Link
              to="/clients/$clientId"
              params={{ clientId: client.id }}
              className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest hover:bg-amber-500/30"
            >
              Voltar à ficha
            </Link>
          </div>
        )}
        <header className="flex items-center gap-4">
          <ClientAvatar name={client.full_name} photoUrl={client.photo_url} size={56} />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Cliente</p>
            <h1 className="text-2xl font-light tracking-tight">{client.full_name}</h1>
            {trainer ? (
              <p className="text-xs text-muted-foreground">com {trainer.business_name || trainer.full_name}</p>
            ) : null}
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Plano actual</p>
          {plan ? (
            <>
              <h2 className="mt-1 text-lg font-medium">{plan.title}</h2>
              {plan.summary ? <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p> : null}
              <p className="mt-3 text-xs text-muted-foreground">
                Bloco {plan.block_number} · {plan.duration_weeks} semanas
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Sem plano activo. O teu treinador vai preparar o primeiro bloco em breve.
            </p>
          )}
        </section>

        <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/50">
          Mais funções em breve — mensagens, registo de treino, progresso.
        </p>
      </div>
    </div>
  );
}