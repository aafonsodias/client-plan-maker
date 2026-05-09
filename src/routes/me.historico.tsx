import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { loadMe } from "@/server/me.functions";
import { MeShell } from "@/components/me/MeShell";
import { Loader2, History } from "lucide-react";

export const Route = createFileRoute("/me/historico")({
  validateSearch: (s: Record<string, unknown>): { as?: string } => ({
    as: typeof s.as === "string" ? s.as : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: MeHistoricoPage,
});

function MeHistoricoPage() {
  const search = Route.useSearch();
  const load = useServerFn(loadMe);
  const { t } = useTranslation("me");
  const [state, setState] = useState<any>(null);
  useEffect(() => {
    void (async () => setState(await load({ data: { as: search.as ?? null } })))();
  }, [load, search.as]);

  if (!state || !state.linked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <MeShell
      client={state.client}
      trainer={state.trainer}
      previewing={state.previewing}
      unreadCount={state.unreadCount ?? 0}
    >
      <section className="rounded-2xl border border-border bg-card p-6 text-center">
        <History className="mx-auto h-8 w-8 text-amber-500/70" />
        <h2 className="mt-3 text-lg font-medium">{t("history.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("history.soon")}</p>
      </section>
    </MeShell>
  );
}