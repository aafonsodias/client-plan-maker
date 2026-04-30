import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X } from "lucide-react";
import waveHand from "@/assets/wave-hand.png";

type Steps = {
  add_client?: boolean;
  run_assessment?: boolean;
  generate_plan?: boolean;
  export_pdf?: boolean;
};

const STEPS: { key: keyof Steps; title: string; desc: string; cta: string; to: string }[] = [
  { key: "add_client",      title: "Add your first client",  desc: "Create a client profile to track everything.",        cta: "Go to Clients",  to: "/clients" },
  { key: "run_assessment",  title: "Run an assessment",      desc: "Complete the ACSM-aligned intake on a client page.",  cta: "Open a client",  to: "/clients" },
  { key: "generate_plan",   title: "Generate a plan",        desc: "Let AI draft a periodized program from the intake.",  cta: "Generate now",   to: "/clients" },
  { key: "export_pdf",      title: "Export a branded PDF",   desc: "Send the polished plan to your client.",              cta: "Open Plans",     to: "/plans" },
];

export function OnboardingChecklist() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<Steps>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed, onboarding_steps")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data && !data.onboarding_completed) {
        setSteps((data.onboarding_steps as Steps) ?? {});
        setOpen(true);
      }
      setLoaded(true);
    })();
  }, [user]);

  const dismiss = async (markDone: boolean) => {
    setOpen(false);
    if (!user) return;
    if (markDone) {
      await supabase.from("profiles").update({ onboarding_completed: true }).eq("user_id", user.id);
    }
  };

  if (!loaded) return null;

  const completed = STEPS.filter((s) => steps[s.key]).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void dismiss(false); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="items-center text-center">
          <img src={waveHand} alt="" className="mb-2 h-10 w-10 object-contain" />
          <DialogTitle>Welcome to Forge</DialogTitle>
          <DialogDescription>
            Four quick steps to your first branded plan. {completed}/{STEPS.length} done.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-accent transition-all" style={{ width: `${(completed / STEPS.length) * 100}%` }} />
        </div>
        <ol className="mt-4 space-y-2">
          {STEPS.map((s, i) => {
            const done = !!steps[s.key];
            return (
              <li key={s.key} className={`flex items-start gap-3 rounded-xl border p-3 ${done ? "border-accent/40 bg-accent/5" : "border-border bg-background"}`}>
                {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent" /> : <Circle className="mt-0.5 h-5 w-5 text-muted-foreground/60" />}
                <div className="flex-1">
                  <p className={`font-medium ${done ? "text-muted-foreground line-through" : ""}`}>{i + 1}. {s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                {!done && (
                  <Button asChild size="sm" variant="outline" onClick={() => setOpen(false)}>
                    <Link to={s.to as any}>{s.cta}</Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex justify-between">
          <Button variant="ghost" size="sm" onClick={() => void dismiss(false)}>
            <X className="mr-1 h-4 w-4" /> Remind me later
          </Button>
          <Button size="sm" onClick={() => void dismiss(true)}>I've got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Helper to mark a step as done from anywhere. */
export async function markOnboardingStep(userId: string, key: keyof Steps) {
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_steps")
    .eq("user_id", userId)
    .maybeSingle();
  const next = { ...((data?.onboarding_steps as Steps) ?? {}), [key]: true };
  await supabase.from("profiles").update({ onboarding_steps: next }).eq("user_id", userId);
}