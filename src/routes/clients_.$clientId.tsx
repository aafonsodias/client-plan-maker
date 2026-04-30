import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, FileText, ArrowLeft, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generatePlanDraft } from "@/server/plan.functions";

export const Route = createFileRoute("/clients_/$clientId")({
  component: () => (
    <AppShell>
      <ClientDetail />
    </AppShell>
  ),
});

const EQUIPMENT = ["Barbell", "Dumbbells", "Kettlebells", "Cable machine", "Bench", "Pull-up bar", "Bands", "Bodyweight only"];

function ClientDetail() {
  const { clientId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const generateFn = useServerFn(generatePlanDraft);

  const [client, setClient] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>({
    primary_goal: "",
    experience_level: "",
    training_days_per_week: 3,
    session_duration_minutes: 60,
    available_equipment: [] as string[],
    training_location: "",
    injuries: "",
    medical_conditions: "",
    preferences: "",
    sleep_quality: "",
    stress_level: "",
    nutrition_habits: "",
    hydration_glasses_per_day: "",
    mobility_limitations: "",
    energy_levels: "",
    recovery_capacity: "",
    lifestyle: "",
  });
  const [duration, setDuration] = useState(4);
  const [plans, setPlans] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).single();
      setClient(c);
      const { data: a } = await supabase.from("assessments").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (a) setAssessment({ ...assessment, ...a, available_equipment: a.available_equipment ?? [] });
      const { data: p } = await supabase.from("workout_plans").select("id, title, status, updated_at").eq("client_id", clientId).order("updated_at", { ascending: false });
      setPlans(p ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, clientId]);

  const toggleEq = (e: string) => {
    const has = assessment.available_equipment.includes(e);
    setAssessment({ ...assessment, available_equipment: has ? assessment.available_equipment.filter((x: string) => x !== e) : [...assessment.available_equipment, e] });
  };

  const generate = async () => {
    if (!user || !client) return;
    setBusy(true);
    try {
      // upsert assessment
      const payload = {
        trainer_id: user.id,
        client_id: clientId,
        primary_goal: assessment.primary_goal || null,
        experience_level: assessment.experience_level || null,
        training_days_per_week: assessment.training_days_per_week ? Number(assessment.training_days_per_week) : null,
        session_duration_minutes: assessment.session_duration_minutes ? Number(assessment.session_duration_minutes) : null,
        available_equipment: assessment.available_equipment,
        training_location: assessment.training_location || null,
        injuries: assessment.injuries || null,
        medical_conditions: assessment.medical_conditions || null,
        preferences: assessment.preferences || null,
        sleep_quality: assessment.sleep_quality ? Number(assessment.sleep_quality) : null,
        stress_level: assessment.stress_level ? Number(assessment.stress_level) : null,
        nutrition_habits: assessment.nutrition_habits || null,
        hydration_glasses_per_day: assessment.hydration_glasses_per_day ? Number(assessment.hydration_glasses_per_day) : null,
        mobility_limitations: assessment.mobility_limitations || null,
        energy_levels: assessment.energy_levels || null,
        recovery_capacity: assessment.recovery_capacity || null,
        lifestyle: assessment.lifestyle || null,
      };
      let assessmentId: string | null = assessment.id ?? null;
      if (assessmentId) {
        await supabase.from("assessments").update(payload).eq("id", assessmentId);
      } else {
        const { data, error } = await supabase.from("assessments").insert(payload).select("id").single();
        if (error) throw error;
        assessmentId = data!.id;
      }

      const result = await generateFn({
        data: {
          client: {
            full_name: client.full_name,
            age: client.age,
            sex: client.sex,
            height_cm: client.height_cm ? Number(client.height_cm) : null,
            weight_kg: client.weight_kg ? Number(client.weight_kg) : null,
          },
          assessment: {
            ...payload,
            secondary_goals: null,
          },
          duration_weeks: duration,
        },
      });

      if (!result.ok) throw new Error(result.error);

      const { data: plan, error } = await supabase
        .from("workout_plans")
        .insert({
          trainer_id: user.id,
          client_id: clientId,
          assessment_id: assessmentId,
          title: result.plan.title || `${client.full_name} – ${duration}-Week Plan`,
          summary: result.plan.summary || null,
          duration_weeks: duration,
          status: "draft",
          plan_data: { weeks: result.plan.weeks ?? [] },
        })
        .select("id")
        .single();
      if (error) throw error;

      toast.success("Draft generated");
      navigate({ to: "/plans/$planId", params: { planId: plan!.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate plan");
    } finally {
      setBusy(false);
    }
  };

  if (!client) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All clients
        </Link>
        <h1 className="mt-2 text-4xl font-black tracking-tight">{client.full_name}</h1>
        <p className="text-muted-foreground">{client.email ?? "No email"}</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-bold">Assessment</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primary goal" placeholder="e.g. Build muscle, lose fat, run a 10K" value={assessment.primary_goal} onChange={(v) => setAssessment({ ...assessment, primary_goal: v })} />
          <div className="space-y-1.5">
            <Label>Experience level</Label>
            <Select value={assessment.experience_level} onValueChange={(v) => setAssessment({ ...assessment, experience_level: v })}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Training days / week" type="number" value={String(assessment.training_days_per_week ?? "")} onChange={(v) => setAssessment({ ...assessment, training_days_per_week: v })} />
          <Field label="Session length (minutes)" type="number" value={String(assessment.session_duration_minutes ?? "")} onChange={(v) => setAssessment({ ...assessment, session_duration_minutes: v })} />
          <Field label="Training location" placeholder="Home, commercial gym, garage…" value={assessment.training_location} onChange={(v) => setAssessment({ ...assessment, training_location: v })} />
          <Field label="Plan length (weeks)" type="number" value={String(duration)} onChange={(v) => setDuration(Math.max(1, Math.min(16, Number(v) || 4)))} />
        </div>

        <div className="mt-4">
          <Label>Available equipment</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {EQUIPMENT.map((eq) => {
              const on = assessment.available_equipment.includes(eq);
              return (
                <button
                  key={eq}
                  type="button"
                  onClick={() => toggleEq(eq)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {eq}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Injuries" value={assessment.injuries} onChange={(v) => setAssessment({ ...assessment, injuries: v })} />
          <TextField label="Medical conditions" value={assessment.medical_conditions} onChange={(v) => setAssessment({ ...assessment, medical_conditions: v })} />
        </div>
        <div className="mt-4">
          <TextField label="Preferences / dislikes" value={assessment.preferences} onChange={(v) => setAssessment({ ...assessment, preferences: v })} />
        </div>

        {/* Holistic / lifestyle factors */}
        <div className="mt-8">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-widest text-accent">Lifestyle &amp; recovery</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Used by the AI to design a program that fits the client's recovery, energy, and daily life — not just their training capacity.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Sleep quality (1–10)"
              type="number"
              placeholder="1 = terrible, 10 = excellent"
              value={String(assessment.sleep_quality ?? "")}
              onChange={(v) => setAssessment({ ...assessment, sleep_quality: v })}
            />
            <Field
              label="Stress level (1–10)"
              type="number"
              placeholder="1 = relaxed, 10 = burned out"
              value={String(assessment.stress_level ?? "")}
              onChange={(v) => setAssessment({ ...assessment, stress_level: v })}
            />
            <Field
              label="Hydration (glasses / day)"
              type="number"
              placeholder="e.g. 6"
              value={String(assessment.hydration_glasses_per_day ?? "")}
              onChange={(v) => setAssessment({ ...assessment, hydration_glasses_per_day: v })}
            />
            <div className="space-y-1.5">
              <Label>Lifestyle</Label>
              <Select value={assessment.lifestyle ?? ""} onValueChange={(v) => setAssessment({ ...assessment, lifestyle: v })}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary (desk job, little movement)</SelectItem>
                  <SelectItem value="active">Active (on feet, regular movement)</SelectItem>
                  <SelectItem value="very_active">Very active (manual job / athlete)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField label="Nutrition habits" value={assessment.nutrition_habits} onChange={(v) => setAssessment({ ...assessment, nutrition_habits: v })} />
            <TextField label="Mobility limitations" value={assessment.mobility_limitations} onChange={(v) => setAssessment({ ...assessment, mobility_limitations: v })} />
            <TextField label="Energy throughout day" value={assessment.energy_levels} onChange={(v) => setAssessment({ ...assessment, energy_levels: v })} />
            <TextField label="Recovery capacity" value={assessment.recovery_capacity} onChange={(v) => setAssessment({ ...assessment, recovery_capacity: v })} />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={generate} disabled={busy} size="lg">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate plan draft
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold">Plans</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plans yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {plans.map((p) => (
              <Link
                key={p.id}
                to="/plans/$planId"
                params={{ planId: p.id }}
                className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0 hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{p.title}</p>
                    <p className="text-xs text-muted-foreground">Updated {new Date(p.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium uppercase">{p.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={2} />
    </div>
  );
}