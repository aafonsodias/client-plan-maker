import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoTextarea } from "@/components/AutoTextarea";
import { toast } from "sonner";
import {
  ArrowLeft, Download, Plus, Save, Trash2, CheckCircle2,
  Settings as SettingsIcon, Lock, LockOpen, NotebookPen, Pencil,
  Share2, Copy, RefreshCw, History,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { generatePlanPdf, type PlanData, type Week, type Day, type Exercise } from "@/lib/pdf";
// Trainer-side ops use the browser supabase client directly (RLS-protected).
// Server fns are reserved for the public client-log endpoints.

export const Route = createFileRoute("/plans/$planId")({
  component: () => (
    <AppShell>
      <PlanEditor />
    </AppShell>
  ),
});

type Mode = "edit" | "log";
type SessionRow = {
  id: string; week_number: number; day_label: string; session_date: string;
  logged_by: string; entries: any[]; session_notes: string | null;
};

function PlanEditor() {
  const { planId } = Route.useParams();
  const { user } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [data, setData] = useState<PlanData>({ weeks: [] });
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [sessions, setSessions] = useState<SessionRow[]>([]);

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
      try {
        const { data: list } = await supabase
          .from("workout_sessions")
          .select("*")
          .eq("plan_id", planId)
          .order("session_date", { ascending: false });
        setSessions((list as unknown as SessionRow[]) ?? []);
      } catch { /* ignore */ }
    })();
  }, [user, planId]);

  const reloadSessions = async () => {
    try {
      const { data: list } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("plan_id", planId)
        .order("session_date", { ascending: false });
      setSessions((list as unknown as SessionRow[]) ?? []);
    } catch { /* ignore */ }
  };

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
    const copy = [...data.weeks]; copy[i] = w; setData({ ...data, weeks: copy });
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
      } catch { /* ignore */ }
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {client && (
            <Link to="/clients/$clientId" params={{ clientId: client.id }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> {client.full_name}
            </Link>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Input
              className="h-9 max-w-md border-0 bg-transparent px-0 !text-xl font-bold tracking-tight focus-visible:ring-0"
              value={plan.title}
              onChange={(e) => setPlan({ ...plan, title: e.target.value })}
            />
            {plan.status === "finalized" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                <CheckCircle2 className="h-3 w-3" /> Finalized
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ShareDialog planId={planId} initialToken={plan.share_token} onChange={(t) => setPlan({ ...plan, share_token: t })} />
          <Link to="/settings" className="group flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-xs hover:border-accent">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-dashed border-border bg-background">
              {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <span className="text-muted-foreground group-hover:text-foreground">Branding</span>
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Summary</Label>
        <AutoTextarea
          minRows={1}
          value={plan.summary ?? ""}
          onChange={(e) => setPlan({ ...plan, summary: e.target.value })}
          placeholder="High-level summary of this program…"
        />
      </div>

      {/* Mode tabs */}
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
        <button
          onClick={() => setMode("edit")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${mode === "edit" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit plan
        </button>
        <button
          onClick={() => setMode("log")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${mode === "log" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          <NotebookPen className="h-3.5 w-3.5" /> Workout log
        </button>
      </div>

      {mode === "edit" ? (
        <>
          <div className="space-y-3">
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
        </>
      ) : (
        <LogMode plan={data} planId={planId} sessions={sessions} reload={reloadSessions} onExportPdf={exportPdf} />
      )}
    </div>
  );
}

/* ─────────── Edit-mode blocks (layered: week = darkest, day = medium, ex = lightest) ─────────── */

function WeekBlock({ week, onChange, onRemove }: { week: Week; onChange: (w: Week) => void; onRemove: () => void }) {
  const addDay = () => onChange({ ...week, days: [...week.days, { day_label: `Day ${week.days.length + 1}`, focus: "", exercises: [] }] });
  const updateDay = (i: number, d: Day) => { const c = [...week.days]; c[i] = d; onChange({ ...week, days: c }); };
  const removeDay = (i: number) => onChange({ ...week, days: week.days.filter((_, idx) => idx !== i) });

  return (
    <div className="rounded-xl border border-border bg-muted/70 p-3">
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
  const updateEx = (i: number, e: Exercise) => { const c = [...day.exercises]; c[i] = e; onChange({ ...day, exercises: c }); };
  const removeEx = (i: number) => onChange({ ...day, exercises: day.exercises.filter((_, idx) => idx !== i) });

  return (
    <div className="rounded-lg border border-border/60 bg-card p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Input className="h-7 w-24 text-sm" value={day.day_label} onChange={(e) => onChange({ ...day, day_label: e.target.value })} />
        <Input value={day.focus} onChange={(e) => onChange({ ...day, focus: e.target.value })} placeholder="Focus (e.g. Push)" className="h-7 flex-1 text-sm" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-1.5">
        {day.exercises.map((ex, ei) => (
          <ExerciseRow key={ei} ex={ex} onChange={(e) => updateEx(ei, e)} onRemove={() => removeEx(ei)} />
        ))}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addEx}>
          <Plus className="mr-1 h-3 w-3" /> Add exercise
        </Button>
      </div>
    </div>
  );
}

function ExerciseRow({ ex, onChange, onRemove }: { ex: Exercise; onChange: (e: Exercise) => void; onRemove: () => void }) {
  return (
    <div className="rounded-md border border-border/50 bg-background p-2">
      <div className="flex items-end gap-2">
        <FieldStack label="Exercise name" className="flex-1 min-w-0">
          <Input className="h-8 text-sm" placeholder="e.g. Barbell back squat" value={ex.name} onChange={(e) => onChange({ ...ex, name: e.target.value })} />
        </FieldStack>
        <FieldStack label="Sets" className="w-16 shrink-0">
          <Input className="h-8 text-center text-sm" placeholder="3" value={ex.sets} onChange={(e) => onChange({ ...ex, sets: e.target.value })} />
        </FieldStack>
        <FieldStack label="Reps" className="w-20 shrink-0">
          <Input className="h-8 text-center text-sm" placeholder="8-10" value={ex.reps} onChange={(e) => onChange({ ...ex, reps: e.target.value })} />
        </FieldStack>
        <FieldStack label="Rest" className="w-20 shrink-0">
          <Input className="h-8 text-center text-sm" placeholder="60s" value={ex.rest} onChange={(e) => onChange({ ...ex, rest: e.target.value })} />
        </FieldStack>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-1.5">
        <AutoTextarea
          minRows={1}
          className="text-sm py-1.5"
          placeholder="Notes — tempo, RPE, cues, substitutions…"
          value={ex.notes ?? ""}
          onChange={(e) => onChange({ ...ex, notes: e.target.value })}
        />
      </div>
    </div>
  );
}

function FieldStack({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/* ─────────── Share dialog ─────────── */

function ShareDialog({ planId, initialToken, onChange }: { planId: string; initialToken: string | null; onChange: (t: string | null) => void }) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);

  const url = token ? `${window.location.origin}/log/${token}` : null;

  const enable = async (rotate = false) => {
    setBusy(true);
    try {
      // If a token already exists and we're not rotating, just reuse it.
      if (token && !rotate) {
        toast.success("Share link ready");
        return;
      }
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("workout_plans")
        .update({ share_token: newToken })
        .eq("id", planId);
      if (error) throw error;
      setToken(newToken);
      onChange(newToken);
      toast.success(rotate ? "Link rotated" : "Share link ready");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("workout_plans")
        .update({ share_token: null })
        .eq("id", planId);
      if (error) throw error;
      setToken(null); onChange(null);
      toast.success("Link revoked");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client log link</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Anyone with this link can log their actual sets/reps/weights for this plan. They cannot view or edit the plan itself.
        </p>
        {url ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button onClick={copy} variant="outline"><Copy className="h-4 w-4" /></Button>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => enable(true)} disabled={busy}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Rotate
              </Button>
              <Button variant="destructive" size="sm" onClick={revoke} disabled={busy}>Revoke link</Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button onClick={() => enable(false)} disabled={busy}>
              <Share2 className="mr-2 h-4 w-4" /> Generate link
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── Log mode ─────────── */

type SetLog = { reps: string; weight: string };
type LogEntry = {
  exercise_name: string;
  planned: { sets: string; reps: string; rest: string; notes: string };
  sets: SetLog[];
  notes: string;
};

function parsePlannedSets(s: string): number {
  const n = parseInt((s || "").match(/\d+/)?.[0] ?? "", 10);
  if (Number.isFinite(n) && n > 0 && n < 20) return n;
  return 3;
}

function LogMode({ plan, planId, sessions, reload, onExportPdf }: { plan: PlanData; planId: string; sessions: SessionRow[]; reload: () => void; onExportPdf: () => Promise<void> }) {
  const navigate = useNavigate();
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const firstWeek = plan.weeks[0]?.week_number ?? 1;
  const firstDay = plan.weeks[0]?.days[0]?.day_label ?? "Day 1";
  const [weekNum, setWeekNum] = useState<number>(firstWeek);
  const [dayLabel, setDayLabel] = useState<string>(firstDay);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const week = plan.weeks.find((w) => w.week_number === weekNum) ?? plan.weeks[0];
  const day = week?.days.find((d) => d.day_label === dayLabel) ?? week?.days[0];

  useEffect(() => {
    if (!day) { setEntries([]); return; }
    setEntries(
      day.exercises.map((e) => {
        const n = parsePlannedSets(e.sets ?? "");
        return {
          exercise_name: e.name,
          planned: { sets: e.sets ?? "", reps: e.reps ?? "", rest: e.rest ?? "", notes: e.notes ?? "" },
          sets: Array.from({ length: n }, () => ({ reps: "", weight: "" })),
          notes: "",
        };
      }),
    );
    setNotes("");
  }, [weekNum, dayLabel, plan]);

  const updateSet = (i: number, si: number, k: keyof SetLog, v: string) => {
    const copy = [...entries];
    const sets = [...copy[i].sets];
    sets[si] = { ...sets[si], [k]: v };
    copy[i] = { ...copy[i], sets };
    setEntries(copy);
  };
  const addSet = (i: number) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], sets: [...copy[i].sets, { reps: "", weight: "" }] };
    setEntries(copy);
  };
  const removeSet = (i: number, si: number) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], sets: copy[i].sets.filter((_, idx) => idx !== si) };
    setEntries(copy);
  };
  const updateExNotes = (i: number, v: string) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], notes: v };
    setEntries(copy);
  };

  const submit = async () => {
    if (!day) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data: inserted, error } = await supabase.from("workout_sessions").insert({
        plan_id: planId,
        trainer_id: user.id,
        week_number: weekNum,
        day_label: dayLabel,
        session_date: date,
        session_notes: notes,
        entries: entries as any,
        logged_by: "trainer",
      }).select("id").single();
      if (error) throw error;
      const newId = inserted?.id;
      toast.success("Session logged · view history", {
        description: "Click to see all sessions for this plan",
        action: {
          label: "Open",
          onClick: () => {
            navigate({
              to: "/plans/$planId/sessions",
              params: { planId },
              search: newId ? { highlight: newId } : {},
            });
          },
        },
      });
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  if (!plan.weeks.length) {
    return <p className="text-sm text-muted-foreground">Add weeks and exercises in Edit mode first.</p>;
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mb-4 sm:-mb-6 lg:-mb-8 bg-background px-4 sm:px-6 lg:px-8 pt-3 pb-6 text-foreground">
      {/* Compact single-row picker */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-card px-2.5 py-2 text-xs">
        <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-accent-foreground">Log</span>
        <select
          value={weekNum}
          onChange={(e) => setWeekNum(Number(e.target.value))}
          className="h-7 rounded bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          {plan.weeks.map((w) => <option key={w.week_number} value={w.week_number}>Week {w.week_number}</option>)}
        </select>
        <select
          value={dayLabel}
          onChange={(e) => setDayLabel(e.target.value)}
          className="h-7 rounded bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          {(week?.days ?? []).map((d) => <option key={d.day_label} value={d.day_label}>{d.day_label}{d.focus ? ` · ${d.focus}` : ""}</option>)}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-7 rounded bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <Link
          to="/plans/$planId/sessions"
          params={{ planId }}
          className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <History className="h-3 w-3" /> History ({safeSessions.length})
        </Link>
      </div>

      {/* Exercise cards */}
      <div className="space-y-2">
        {entries.length === 0 && <p className="text-sm text-foreground0">No exercises in this day.</p>}
        {entries.map((e, i) => (
          <div key={i} className="rounded-md bg-card p-2.5">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <h3 className="text-base font-bold tracking-tight text-foreground">
                {e.exercise_name || <span className="text-foreground0">(unnamed)</span>}
              </h3>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-accent">
                Planned · {e.planned.sets || "—"} × {e.planned.reps || "—"} · {e.planned.rest || "—"}
              </span>
            </div>
            {e.planned.notes && (
              <p className="mb-1.5 text-[11px] italic text-accent/70">{e.planned.notes}</p>
            )}

            {/* Per-set rows */}
            <div className="mb-1 grid grid-cols-[2.25rem_1fr_1fr_1.5rem] gap-1.5 px-0.5 text-[9px] font-bold uppercase tracking-widest text-foreground">
              <span className="text-foreground0">Set</span>
              <span>Reps</span>
              <span>Weight</span>
              <span />
            </div>
            <div className="space-y-1">
              {e.sets.map((st, si) => (
                <div key={si} className="grid grid-cols-[2.25rem_1fr_1fr_1.5rem] items-center gap-1.5">
                  <span className="text-center text-xs font-bold text-foreground0">{si + 1}</span>
                  <input
                    inputMode="numeric"
                    value={st.reps}
                    onChange={(ev) => updateSet(i, si, "reps", ev.target.value)}
                    placeholder={e.planned.reps || "—"}
                    className="h-7 w-full rounded bg-secondary px-2 text-center text-sm text-white placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    value={st.weight}
                    onChange={(ev) => updateSet(i, si, "weight", ev.target.value)}
                    placeholder="kg"
                    className="h-7 w-full rounded bg-secondary px-2 text-center text-sm text-white placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={() => removeSet(i, si)}
                    className="text-muted-foreground/50 hover:text-zinc-200"
                    aria-label="Remove set"
                    type="button"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={() => addSet(i)}
                type="button"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-accent"
              >
                <Plus className="h-3 w-3" /> Add set
              </button>
              <input
                value={e.notes}
                onChange={(ev) => updateExNotes(i, ev.target.value)}
                placeholder="Notes…"
                className="h-6 flex-1 rounded bg-transparent px-1 text-xs text-foreground/90 placeholder:text-muted-foreground/50 outline-none focus:bg-secondary"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Session notes */}
      <div className="mt-3">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Session notes — how did it feel?"
          className="h-8 w-full rounded bg-card px-2.5 text-xs text-foreground placeholder:text-foreground0 outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Action bar */}
      <div className="sticky bottom-2 mt-3 flex items-center justify-end gap-2 rounded-md bg-card/95 p-2 backdrop-blur">
        <button
          type="button"
          onClick={() => void onExportPdf()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-foreground transition hover:bg-secondary"
        >
          <Download className="h-3.5 w-3.5" /> Export PDF
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || entries.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save session"}
        </button>
      </div>
    </div>
  );
}
