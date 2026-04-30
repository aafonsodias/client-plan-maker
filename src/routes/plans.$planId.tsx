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
import { ArrowLeft, Download, Plus, Save, Trash2, CheckCircle2, Settings as SettingsIcon, Lock, LockOpen } from "lucide-react";
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
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
      if (pr?.logo_url) {
        const { data: signed } = await supabase.storage.from("logos").createSignedUrl(pr.logo_url, 3600);
        setLogoUrl(signed?.signedUrl ?? null);
      }
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
      toast.success(extra.status === "finalized" ? "Plan finalized" : "Plan unlocked — back to draft");
    } else {
      toast.success("Plan saved", {
        description: client ? `View ${client.full_name}'s profile` : undefined,
        action: client
          ? { label: "Open client", onClick: () => { window.location.href = `/clients/${client.id}`; } }
          : undefined,
      });
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
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
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
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Link to="/settings" className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-xs hover:border-accent">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-background">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
              ) : (
                <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="text-left">
              <p className="font-semibold">{logoUrl ? "PDF logo" : "No logo set"}</p>
              <p className="text-muted-foreground group-hover:text-foreground">Edit branding →</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Summary</Label>
        <Textarea rows={2} value={plan.summary ?? ""} onChange={(e) => setPlan({ ...plan, summary: e.target.value })} />
      </div>

      <div className="space-y-4">
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
        {plan.status === "finalized" ? (
          <Button variant="outline" onClick={() => save({ status: "draft" })} disabled={saving}>
            <LockOpen className="mr-2 h-4 w-4" /> Un-finalize
          </Button>
        ) : (
          <Button variant="outline" onClick={() => save({ status: "finalized" })} disabled={saving}>
            <Lock className="mr-2 h-4 w-4" /> Finalize
          </Button>
        )}
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
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-accent px-2 py-0.5 text-[11px] font-black uppercase tracking-widest text-accent-foreground">Week {week.week_number}</span>
        <Input value={week.focus} onChange={(e) => onChange({ ...week, focus: e.target.value })} placeholder="Focus (e.g. Hypertrophy block)" className="h-8 flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3">
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
    <div className="rounded-lg border border-border/60 bg-background p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Input className="h-7 w-24 text-sm" value={day.day_label} onChange={(e) => onChange({ ...day, day_label: e.target.value })} />
        <Input value={day.focus} onChange={(e) => onChange({ ...day, focus: e.target.value })} placeholder="Focus (e.g. Push)" className="h-7 flex-1 text-sm" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Header row — desktop only */}
      {day.exercises.length > 0 && (
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_56px_56px_72px_minmax(0,1.4fr)_28px] items-center gap-1.5 px-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>Exercise</span>
          <span>Sets</span>
          <span>Reps</span>
          <span>Rest</span>
          <span>Notes</span>
          <span />
        </div>
      )}

      <div className="space-y-1.5">
        {day.exercises.map((ex, ei) => (
          <div key={ei}>
            {/* Desktop: dense single-row */}
            <div className="hidden md:grid grid-cols-[minmax(0,1fr)_56px_56px_72px_minmax(0,1.4fr)_28px] items-center gap-1.5">
              <Input className="h-8 text-sm" placeholder="Exercise" value={ex.name} onChange={(e) => updateEx(ei, { ...ex, name: e.target.value })} />
              <Input className="h-8 text-sm" placeholder="3" value={ex.sets} onChange={(e) => updateEx(ei, { ...ex, sets: e.target.value })} />
              <Input className="h-8 text-sm" placeholder="10" value={ex.reps} onChange={(e) => updateEx(ei, { ...ex, reps: e.target.value })} />
              <Input className="h-8 text-sm" placeholder="60s" value={ex.rest} onChange={(e) => updateEx(ei, { ...ex, rest: e.target.value })} />
              <Input className="h-8 text-sm" placeholder="Tempo, RPE, cues…" value={ex.notes} onChange={(e) => updateEx(ei, { ...ex, notes: e.target.value })} />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEx(ei)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Mobile: compact stacked card */}
            <div className="md:hidden rounded-md border border-border/60 bg-card/40 p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Input className="h-8 flex-1 text-sm" placeholder="Exercise" value={ex.name} onChange={(e) => updateEx(ei, { ...ex, name: e.target.value })} />
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeEx(ei)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Input className="h-8 text-sm" placeholder="Sets" value={ex.sets} onChange={(e) => updateEx(ei, { ...ex, sets: e.target.value })} />
                <Input className="h-8 text-sm" placeholder="Reps" value={ex.reps} onChange={(e) => updateEx(ei, { ...ex, reps: e.target.value })} />
                <Input className="h-8 text-sm" placeholder="Rest" value={ex.rest} onChange={(e) => updateEx(ei, { ...ex, rest: e.target.value })} />
              </div>
              <Input className="h-8 text-sm" placeholder="Notes" value={ex.notes} onChange={(e) => updateEx(ei, { ...ex, notes: e.target.value })} />
            </div>
          </div>
        ))}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addEx}>
          <Plus className="mr-1 h-3 w-3" /> Add exercise
        </Button>
      </div>
    </div>
  );
}