import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { Loader2, Users, User, Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/welcome")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: WelcomePage,
});

type Choice = "coach" | "solo" | "coached_client";

function WelcomePage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<Choice | null>(null);
  const [checking, setChecking] = useState(true);

  // If user already chose, skip directly.
  useEffect(() => {
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const t = (prof as any)?.account_type as Choice | null | undefined;
      if (t === "coach") navigate({ to: "/dashboard" });
      else if (t === "coached_client") navigate({ to: "/me" });
      else if (t === "solo") navigate({ to: "/dashboard" });
      else setChecking(false);
    })();
  }, [navigate]);

  const choose = async (kind: Choice) => {
    setBusy(kind);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { error } = await supabase
        .from("profiles")
        .update({ account_type: kind } as any)
        .eq("user_id", u.user.id);
      if (error) throw error;
      navigate({ to: kind === "coached_client" ? "/me" : "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Tenta outra vez.");
      setBusy(null);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <BrandMark size="sm" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Forge</p>
        </div>
        <h1 className="mt-8 text-3xl font-light tracking-tight sm:text-4xl">Como vais usar o Forge?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Adaptamos a app — perguntas, dashboard, ferramentas — ao teu contexto. Podes mudar mais tarde.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <ChoiceCard
            icon={<Users className="h-5 w-5" />}
            title="Sou treinador"
            desc="Construir planos para os meus clientes, gerir agenda e progresso."
            onClick={() => choose("coach")}
            busy={busy === "coach"}
          />
          <ChoiceCard
            icon={<User className="h-5 w-5" />}
            title="Treino sozinho/a"
            desc="Quero que a IA me crie e ajuste o plano com base no meu objetivo."
            onClick={() => choose("solo")}
            busy={busy === "solo"}
          />
          <ChoiceCard
            icon={<Heart className="h-5 w-5" />}
            title="Tenho coach"
            desc="Quero acompanhar o plano que o meu coach me está a fazer."
            onClick={() => choose("coached_client")}
            busy={busy === "coached_client"}
          />
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Os dashboards "Treino sozinho" e "Tenho coach" estão em rollout — por agora caem no dashboard principal e a tua escolha fica guardada para quando forem ativados.
        </p>
      </div>
    </div>
  );
}

function ChoiceCard({ icon, title, desc, onClick, busy }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="group relative rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg disabled:opacity-60"
    >
      <div className="flex items-center gap-2 text-accent">{icon}</div>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-4">
        <Button variant="outline" size="sm" disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Escolher"}
        </Button>
      </div>
    </button>
  );
}