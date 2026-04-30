import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoTextarea } from "@/components/AutoTextarea";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getSharedPlan, saveClientSession } from "@/server/sessions.functions";
import type { PlanData } from "@/lib/pdf";

export const Route = createFileRoute("/log/$token")({
  component: ClientLogPage,
});

type LogEntry = {
  exercise_name: string;
  planned: { sets: string; reps: string; rest: string; notes: string };
  actual: { sets: string; reps: string; weight: string; notes: string };
};

function ClientLogPage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<{ id: string; title: string; summary: string | null; plan_data: PlanData; client_name: string | null; trainer_name: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weekNum, setWeekNum] = useState<number>(1);
  const [dayLabel, setDayLabel] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = (await getSharedPlan({ data: { token } })) as any;
        setInfo(res);
        const w0 = res.plan_data?.weeks?.[0];
        if (w0) {
          setWeekNum(w0.week_number);
          setDayLabel(w0.days?.[0]?.day_label ?? "");
        }
      } catch (e: any) {
        setError(e.message || "Invalid link");
      }
    })();
  }, [token]);

  const week = info?.plan_data.weeks.find((w) => w.week_number === weekNum) ?? info?.plan_data.weeks[0];
  const day = week?.days.find((d) => d.day_label === dayLabel) ?? week?.days[0];

  useEffect(() => {
    if (!day) { setEntries([]); return; }
    setEntries(day.exercises.map((e) => ({
      exercise_name: e.name,
      planned: { sets: e.sets ?? "", reps: e.reps ?? "", rest: e.rest ?? "", notes: e.notes ?? "" },
      actual: { sets: "", reps: "", weight: "", notes: "" },
    })));
  }, [weekNum, dayLabel, info]);

  if (error) return <Centered><p className="text-destructive">{error}</p></Centered>;
  if (!info) return <Centered><p className="text-muted-foreground">Loading…</p></Centered>;
  if (done) return (
    <Centered>
      <div className="space-y-3 text-center">
        <Logo className="mx-auto h-12 w-12" />
        <h1 className="text-2xl font-bold">Session logged 💪</h1>
        <p className="text-muted-foreground">Thanks — your trainer can see it now.</p>
        <Button onClick={() => setDone(false)}>Log another session</Button>
      </div>
    </Centered>
  );

  const updateActual = (i: number, k: keyof LogEntry["actual"], v: string) => {
    const c = [...entries]; c[i] = { ...c[i], actual: { ...c[i].actual, [k]: v } }; setEntries(c);
  };

  const submit = async () => {
    setSaving(true);
    try {
      await saveClientSession({
        data: { token, plan_id: info.id, week_number: weekNum, day_label: dayLabel, session_date: date, session_notes: notes, entries },
      });
      setDone(true);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{info.trainer_name ?? "Workout log"}</p>
        <h1 className="text-2xl font-bold tracking-tight">{info.title}</h1>
        {info.client_name && <p className="text-sm text-muted-foreground">For {info.client_name}</p>}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/70 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Week</span>
          <select value={weekNum} onChange={(e) => setWeekNum(Number(e.target.value))} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            {info.plan_data.weeks.map((w) => <option key={w.week_number} value={w.week_number}>Week {w.week_number}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Day</span>
          <select value={dayLabel} onChange={(e) => setDayLabel(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            {(week?.days ?? []).map((d) => <option key={d.day_label} value={d.day_label}>{d.day_label}{d.focus ? ` · ${d.focus}` : ""}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Date</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40 text-sm" />
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-card p-3">
            <p className="mb-2 text-sm font-semibold">{e.exercise_name}</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Target: {e.planned.sets || "—"} × {e.planned.reps || "—"} · rest {e.planned.rest || "—"}
            </p>
            <div className="flex gap-1.5">
              <Stack label="Sets" className="w-14"><Input className="h-8 text-center text-sm" value={e.actual.sets} onChange={(ev) => updateActual(i, "sets", ev.target.value)} /></Stack>
              <Stack label="Reps" className="w-20"><Input className="h-8 text-center text-sm" value={e.actual.reps} onChange={(ev) => updateActual(i, "reps", ev.target.value)} /></Stack>
              <Stack label="Weight" className="flex-1"><Input className="h-8 text-sm" placeholder="e.g. 80kg" value={e.actual.weight} onChange={(ev) => updateActual(i, "weight", ev.target.value)} /></Stack>
            </div>
            <AutoTextarea minRows={1} className="mt-1.5 text-sm py-1.5" placeholder="Notes…" value={e.actual.notes} onChange={(ev) => updateActual(i, "notes", ev.target.value)} />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">How did it feel?</Label>
        <AutoTextarea minRows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button onClick={submit} disabled={saving || entries.length === 0} className="w-full">
        <Save className="mr-2 h-4 w-4" /> Save session
      </Button>
    </div>
  );
}

function Stack({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6">{children}</div>;
}