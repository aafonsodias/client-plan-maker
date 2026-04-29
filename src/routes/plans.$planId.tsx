import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Download, Plus, Save, Trash2, CheckCircle2 } from "lucide-react";
import { generatePlanPdf, type PlanData, type Week, type Day, type Exercise } from "@/lib/pdf";

export const Route = createFileRoute("/plans/$planId")({
  component: () => (
    <AppShell>
      <PlanEditor />
    </AppShell>
  ),
});

function PlanEditor() {
  const { planId } = Route.useParams();
  const { user } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [data, setData] = useState<PlanData>({ weeks: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: p } = await supabase.from("workout_plans").select("*").eq("id", planId).single();
      setPlan(p);
      setData((p?.plan_data as unknown as PlanData) ?? { weeks: [] });
      if (p?.client_id) {
        const { data: c } = await supabase.from("clients").select("*").eq("id", p.client_id).single();
        setClient(c);
      }
      const { data: pr } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setProfile(pr);
    })();
  }, [user, planId]);

  const save = async (extra: Partial<{ status: string }> = {}) => {
    setSaving(true);
    const { error } = await supabase
      .from("workout_plans")
      .update({ title: plan.title, summary: plan.summary, plan_data: data, ...extra })
      .eq("id", planId);
    setSaving(false);
    if (error) return toast.error(error.message);
    if (extra.status) {
      setPlan({ ...plan, ...extra });
      toast.success("Plan finalized");
    } else {
      toast.success("Saved");
    }
  };

  const addWeek = () => {
    const n = (data.weeks.at(-1)?.week_number ?? 0) + 1;
    setData({ ...data, weeks: [...data.weeks, { week_number: n, focus: "", days: [] }] });
  };
  const updateWeek = (i: number, w: Week) => {
    const copy = [...data.weeks];
    copy[i] = w;
    setData({ ...data, weeks: copy });
  };
  const removeWeek = (i: number) => setData({ ...data, weeks: data.weeks.filter((_, idx) => idx !== i) });

  const exportPdf = async () => {
    if (!client || !plan) return;
    let logoDataUrl: string | null = null;
    if (profile?.logo_url) {
      try {
        const { data: signed } = await supabase.storage.from("logos").createSignedUrl(profile.logo_url, 600);
        if (signed?.signedUrl) {
          const res = await fetch(signed.signedUrl);
          const blob = await res.blob();
          logoDataUrl = await new Promise<string | null>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => resolve(null);
            r.readAsDataURL(blob);
          });
        }
      } catch {
        /* ignore */
      }
    }
    await generatePlanPdf(
      { title: plan.title, summary: plan.summary, client_name: client.full_name, duration_weeks: plan.duration_weeks },
      data,
      {
        business_name: profile?.business_name,
        full_name: profile?.full_name,
        tagline: profile?.tagline,
        contact_email: profile?.contact_email,
        contact_phone: profile?.contact_phone,
        logo_data_url: logoDataUrl,
      }
    );
  };

  if (!plan) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        {client && (
          <Link to="/clients/$clientId" params={{ clientId: client.id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> {client.full_name}
          </Link>
        )}
        <div className="mt-2 flex items-center gap-3">
          <Input className="h-auto border-0 bg-transparent !text-3xl font-black tracking-tight focus-visible:ring-0" value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} />
          {plan.status === "finalized" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-foreground">
              <CheckCircle2 className="h-3 w-3" /> Finalized
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Summary</Label>
        <Textarea rows={3} value={plan.summary ?? ""} onChange={(e) => setPlan({ ...plan, summary: e.target.value })} />
      </div>

      <div className="space-y-6">
        {data.weeks.map((w, wi) => (
          <WeekBlock key={wi} week={w} onChange={(nw) => updateWeek(wi, nw)} onRemove={() => removeWeek(wi)} />
        ))}
        <Button variant="outline" onClick={addWeek}>
          <Plus className="mr-2 h-4 w-4" /> Add week
        </Button>
      </div>

      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-[var(--shadow-elegant)] backdrop-blur">
        <Button variant="outline" onClick={() => save()} disabled={saving}>
          <Save className="mr-2 h-4 w-4" /> Save
        </Button>
        <Button variant="outline" onClick={() => save({ status: "finalized" })} disabled={saving}>
          Finalize
        </Button>
        <Button onClick={exportPdf}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>
    </div>
  );
}

function WeekBlock({ week, onChange, onRemove }: { week: Week; onChange: (w: Week) => void; onRemove: () => void }) {
  const addDay = () => onChange({ ...week, days: [...week.days, { day_label: `Day ${week.days.length + 1}`, focus: "", exercises: [] }] });
  const updateDay = (i: number, d: Day) => {
    const copy = [...week.days];
    copy[i] = d;
    onChange({ ...week, days: copy });
  };
  const removeDay = (i: number) => onChange({ ...week, days: week.days.filter((_, idx) => idx !== i) });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-md bg-accent px-2 py-1 text-xs font-black uppercase tracking-widest text-accent-foreground">Week {week.week_number}</span>
        <Input value={week.focus} onChange={(e) => onChange({ ...week, focus: e.target.value })} placeholder="Focus (e.g. Hypertrophy block)" className="flex-1" />
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-4">
        {week.days.map((d, di) => (
          <DayBlock key={di} day={d} onChange={(nd) => updateDay(di, nd)} onRemove={() => removeDay(di)} />
        ))}
        <Button variant="outline" size="sm" onClick={addDay}>
          <Plus className="mr-2 h-3 w-3" /> Add day
        </Button>
      </div>
    </div>
  );
}

function DayBlock({ day, onChange, onRemove }: { day: Day; onChange: (d: Day) => void; onRemove: () => void }) {
  const addEx = () => onChange({ ...day, exercises: [...day.exercises, { name: "", sets: "3", reps: "10", rest: "60s", notes: "" }] });
  const updateEx = (i: number, e: Exercise) => {
    const copy = [...day.exercises];
    copy[i] = e;
    onChange({ ...day, exercises: copy });
  };
  const removeEx = (i: number) => onChange({ ...day, exercises: day.exercises.filter((_, idx) => idx !== i) });

  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="mb-3 flex items-center gap-2">
        <Input className="w-32" value={day.day_label} onChange={(e) => onChange({ ...day, day_label: e.target.value })} />
        <Input value={day.focus} onChange={(e) => onChange({ ...day, focus: e.target.value })} placeholder="Focus (e.g. Push)" className="flex-1" />
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2">
        {day.exercises.map((ex, ei) => (
          <div key={ei} className="grid grid-cols-12 items-center gap-2">
            <Input className="col-span-4" placeholder="Exercise" value={ex.name} onChange={(e) => updateEx(ei, { ...ex, name: e.target.value })} />
            <Input className="col-span-1" placeholder="Sets" value={ex.sets} onChange={(e) => updateEx(ei, { ...ex, sets: e.target.value })} />
            <Input className="col-span-1" placeholder="Reps" value={ex.reps} onChange={(e) => updateEx(ei, { ...ex, reps: e.target.value })} />
            <Input className="col-span-2" placeholder="Rest" value={ex.rest} onChange={(e) => updateEx(ei, { ...ex, rest: e.target.value })} />
            <Input className="col-span-3" placeholder="Notes" value={ex.notes} onChange={(e) => updateEx(ei, { ...ex, notes: e.target.value })} />
            <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeEx(ei)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addEx}>
          <Plus className="mr-2 h-3 w-3" /> Add exercise
        </Button>
      </div>
    </div>
  );
}