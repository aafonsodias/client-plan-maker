import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoTextarea } from "@/components/AutoTextarea";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useServerFn } from "@tanstack/react-start";
import {
  getSharedPlan,
  saveClientSession,
  getOpenSession,
  getSessionStreak,
} from "@/server/sessions.functions";
import type { PlanData } from "@/lib/pdf";
import { ExerciseSetsCard, type LogEntryV2, type SetLog } from "@/components/log/ExerciseSetsCard";
import { LogHeader, type SaveState } from "@/components/log/LogHeader";
import { Confetti } from "@/components/log/Confetti";
import { ImportFromPhotoButton } from "@/components/log/ImportFromPhotoButton";
import RationaleChip from "@/components/ux/RationaleChip";
import { inferLogbookModeFromDayFocus } from "@/lib/auto-infer";

const LOGBOOK_MODE_LABELS_PT: Record<string, string> = {
  strength: "Força",
  hypertrophy: "Hipertrofia",
  cardio: "Cardio",
  intervals: "Intervalos",
  mobility: "Mobilidade",
  skill: "Técnica",
  mixed: "Misto",
};

export const Route = createFileRoute("/log/$token")({
  component: ClientLogPage,
});

/* Parse a "3" / "3-4" sets string into an integer count, default 3. */
function plannedSetCount(planned?: string): number {
  if (!planned) return 3;
  const m = String(planned).match(/\d+/);
  if (!m) return 3;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 && n <= 10 ? n : 3;
}

function emptyEntriesForDay(day: PlanData["weeks"][number]["days"][number]): LogEntryV2[] {
  return day.exercises.map((e) => {
    const count = plannedSetCount(e.sets);
    return {
      exercise_name: e.name,
      planned: {
        sets: e.sets ?? "",
        reps: e.reps ?? "",
        rpe: (e as any).rpe ?? "",
        rest: e.rest ?? "",
        notes: e.notes ?? "",
      },
      sets: Array.from({ length: count }, (): SetLog => ({ reps: "", weight: "", rpe: "", done: false, ts: null })),
      notes: "",
    };
  });
}

function ClientLogPage() {
  const { token } = Route.useParams();
  const getSharedPlanFn = useServerFn(getSharedPlan);
  const saveFn = useServerFn(saveClientSession);
  const getOpenSessionFn = useServerFn(getOpenSession);
  const getStreakFn = useServerFn(getSessionStreak);

  const [info, setInfo] = useState<{ id: string; title: string; summary: string | null; plan_data: PlanData; client_name: string | null; trainer_name: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weekNum, setWeekNum] = useState<number>(1);
  const [dayLabel, setDayLabel] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<LogEntryV2[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [streak, setStreak] = useState<{ currentStreak: number; weekDone: number; weekTotal: number; totalSessions: number }>({
    currentStreak: 0,
    weekDone: 0,
    weekTotal: 0,
    totalSessions: 0,
  });

  // Track whether the user has interacted yet (no autosave on read-only loads)
  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = (await getSharedPlanFn({ data: { token } })) as any;
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
  }, [token, getSharedPlanFn]);

  const week = info?.plan_data.weeks.find((w) => w.week_number === weekNum) ?? info?.plan_data.weeks[0];
  const day = week?.days.find((d) => d.day_label === dayLabel) ?? week?.days[0];

  // When week/day/date changes: rebuild entries from plan, then try to
  // restore an in-progress draft for this exact slot.
  useEffect(() => {
    if (!day || !info) {
      setEntries([]);
      return;
    }
    dirtyRef.current = false;
    const fresh = emptyEntriesForDay(day);
    setEntries(fresh);
    setNotes("");
    setSaveState("idle");
    setLastSavedAt(null);

    void (async () => {
      try {
        const draft = await getOpenSessionFn({
          data: {
            token,
            plan_id: info.id,
            week_number: weekNum,
            day_label: dayLabel,
            session_date: date,
          },
        });
        if (!draft) return;
        // Merge: prefer stored entries when names match (positionally), keep
        // freshly built ones otherwise. Old v1 drafts have `actual` instead
        // of `sets[]` — skip them rather than mis-render.
        const stored = Array.isArray((draft as any).entries) ? (draft as any).entries : [];
        const next = fresh.map((f, i) => {
          const s = stored[i];
          if (!s || s.exercise_name !== f.exercise_name) return f;
          if (!Array.isArray(s.sets)) return f;
          return {
            ...f,
            sets: f.sets.map((ss, si) => ({
              ...ss,
              ...(s.sets[si] ?? {}),
            })),
            felt: s.felt,
            notes: typeof s.notes === "string" ? s.notes : f.notes,
          } as LogEntryV2;
        });
        setEntries(next);
        if (typeof (draft as any).session_notes === "string") {
          setNotes((draft as any).session_notes);
        }
        setSaveState("saved");
        setLastSavedAt(new Date((draft as any).updated_at ?? Date.now()).getTime());
        toast.success("Continuámos de onde paraste.");
      } catch {
        /* draft restore is best-effort */
      }
    })();
  }, [weekNum, dayLabel, info, date, day, token, getOpenSessionFn]);

  // Streak refresh whenever the plan or current week changes
  useEffect(() => {
    if (!info) return;
    void (async () => {
      try {
        const s = await getStreakFn({
          data: { token, plan_id: info.id, current_week: weekNum },
        });
        setStreak(s);
      } catch {
        /* decorative — silent */
      }
    })();
  }, [info, weekNum, token, getStreakFn]);

  /* ─────────── Autosave (debounced 1.2s after change) ─────────── */
  useEffect(() => {
    if (!dirtyRef.current || !info || !day) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("saving");
    debounceRef.current = setTimeout(async () => {
      try {
        await saveFn({
          data: {
            token,
            plan_id: info.id,
            week_number: weekNum,
            day_label: dayLabel,
            session_date: date,
            session_notes: notes,
            entries,
            status: "in_progress",
          },
        });
        setSaveState("saved");
        setLastSavedAt(Date.now());
      } catch (e) {
        setSaveState(navigator.onLine === false ? "offline" : "idle");
      }
    }, 1200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [entries, notes, info, day, weekNum, dayLabel, date, token, saveFn]);

  const updateEntry = (i: number, next: LogEntryV2) => {
    dirtyRef.current = true;
    setEntries((prev) => prev.map((e, idx) => (idx === i ? next : e)));
  };

  if (error) return <Centered><p className="text-destructive">{error}</p></Centered>;
  if (!info) return <Centered><p className="text-muted-foreground">Loading…</p></Centered>;
  if (done) return (
    <>
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <Centered>
        <div className="space-y-3 text-center">
          <Logo className="mx-auto h-12 w-12" />
          <h1 className="text-2xl font-bold">Sessão registada 💪</h1>
          <p className="text-muted-foreground">Obrigado — o teu treinador já vê.</p>
          <Button onClick={() => { setDone(false); setShowConfetti(false); }}>Registar outra sessão</Button>
        </div>
      </Centered>
    </>
  );

  const submit = async () => {
    setSaving(true);
    try {
      await saveFn({
        data: {
          token,
          plan_id: info.id,
          week_number: weekNum,
          day_label: dayLabel,
          session_date: date,
          session_notes: notes,
          entries,
          status: "done",
        },
      });
      // Re-pull streak to know if we just closed the week
      try {
        const s = await getStreakFn({
          data: { token, plan_id: info.id, current_week: weekNum },
        });
        setStreak(s);
        if (s.weekTotal > 0 && s.weekDone >= s.weekTotal) {
          setShowConfetti(true);
          toast.success("Semana completa 🎯");
        }
      } catch { /* ignore */ }
      setDone(true);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const totalSets = entries.reduce((acc, e) => acc + e.sets.length, 0);
  const doneSets = entries.reduce((acc, e) => acc + e.sets.filter((s) => s.done).length, 0);
  const sessionPct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <LogHeader
        trainerName={info.trainer_name}
        planTitle={info.title}
        clientName={info.client_name}
        currentStreak={streak.currentStreak}
        weekDone={streak.weekDone}
        weekTotal={streak.weekTotal}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
      />

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/70 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Semana</span>
          <select value={weekNum} onChange={(e) => setWeekNum(Number(e.target.value))} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            {info.plan_data.weeks.map((w) => <option key={w.week_number} value={w.week_number}>Week {w.week_number}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Dia</span>
          <select value={dayLabel} onChange={(e) => setDayLabel(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            {(week?.days ?? []).map((d) => <option key={d.day_label} value={d.day_label}>{d.day_label}{d.focus ? ` · ${d.focus}` : ""}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Data</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40 text-sm" />
        </div>
        <div className="ml-auto flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Progresso</span>
          <span className="text-sm font-semibold tabular-nums">
            {doneSets}/{totalSets} sets · {sessionPct}%
          </span>
        </div>
      </div>

      {day?.focus ? (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {LOGBOOK_MODE_LABELS_PT[inferLogbookModeFromDayFocus(day.focus).value] ?? "Misto"}
          </span>
          <RationaleChip inference={inferLogbookModeFromDayFocus(day.focus)} />
        </div>
      ) : null}

      <div className="space-y-3">
        {entries.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Treinaste com a folha impressa? Tira foto e a IA importa os valores.
            </span>
            <ImportFromPhotoButton
              token={token}
              planId={info.id}
              weekNumber={weekNum}
              dayLabel={dayLabel}
              entries={entries}
              onApply={(merged, notesAppend) => {
                dirtyRef.current = true;
                setEntries(merged);
                if (notesAppend) {
                  setNotes((cur) => (cur.trim() ? `${cur}\n\n${notesAppend}` : notesAppend));
                }
              }}
            />
          </div>
        )}
        {entries.map((e, i) => (
          <ExerciseSetsCard
            key={`${e.exercise_name}-${i}`}
            entry={e}
            index={i}
            onChange={(idx, next) => updateEntry(idx, next)}
            token={token}
            planId={info.id}
            onSetKeyDown={(ev, si, field) => {
              // ↓/↑ jump to the same field on the next/prev set; Enter behaves like ↓.
              const isDown = ev.key === "ArrowDown" || ev.key === "Enter";
              const isUp = ev.key === "ArrowUp";
              if (!isDown && !isUp) return;
              ev.preventDefault();
              const total = e.sets.length;
              let nextIdx = i;
              let nextSi = si + (isDown ? 1 : -1);
              if (nextSi >= total) { nextIdx = i + 1; nextSi = 0; }
              if (nextSi < 0) { nextIdx = i - 1; nextSi = entries[nextIdx]?.sets.length ? entries[nextIdx].sets.length - 1 : 0; }
              const sel = `[data-set-input="${nextIdx}:${nextSi}:${field}"]`;
              const target = document.querySelector(sel) as HTMLInputElement | null;
              target?.focus();
              target?.select?.();
            }}
          />
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Notas da sessão</Label>
        <AutoTextarea
          minRows={1}
          value={notes}
          onChange={(e) => {
            dirtyRef.current = true;
            setNotes(e.target.value);
          }}
        />
      </div>

      <Button onClick={submit} disabled={saving || entries.length === 0} className="w-full">
        <Save className="mr-2 h-4 w-4" /> Concluir sessão
      </Button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6">{children}</div>;
}