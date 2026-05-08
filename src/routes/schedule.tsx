import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Plus, Sparkles, Loader2, Trash2, Copy, Check, CalendarPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  listWeekBookings,
  listMonthBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  duplicateBookingNextWeek,
  listPacks,
  seedScheduleDemo,
  setClientColor,
} from "@/server/schedule.functions";
import { RevenuePanel } from "@/components/schedule/RevenuePanel";
import { ClientAvatar } from "@/components/ClientAvatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PacksPanel, PackFormDialog } from "./schedule.packs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type Booking,
  type Pack,
  PACK_COLORS,
  clientColor,
  addDays,
  fmtWeekRange,
  packBlockClasses,
  packStatus,
  startOfIsoWeek,
} from "@/lib/schedule";

export const Route = createFileRoute("/schedule")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { tab?: "week" | "packs"; newBooking?: 1; clientId?: string; packId?: string } => ({
    tab: s.tab === "packs" ? "packs" : "week",
    newBooking: s.newBooking === 1 || s.newBooking === "1" ? 1 : undefined,
    clientId: typeof s.clientId === "string" ? s.clientId : undefined,
    packId: typeof s.packId === "string" ? s.packId : undefined,
  }),
  component: () => (
    <AppShell>
      <ScheduleShell />
    </AppShell>
  ),
});

function ScheduleShell() {
  // Single stable tree on every render. /schedule/packs is a redirect-only
  // route (see src/routes/schedule.packs.tsx) — there is no nested Outlet
  // to swap into, so we always render the tabbed shell. This kills the
  // remaining hook-order mismatch where ScheduleShell rendered two trees.
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [bookingTick, setBookingTick] = useState(0);
  const tab = search.tab === "packs" ? "packs" : "week";
  return (
    <Tabs
      value={tab}
      onValueChange={(v) =>
        navigate({ to: "/schedule", search: { tab: v === "packs" ? "packs" : "week" } })
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <ScheduleHeading />
        <ScheduleTabs />
      </div>
      <TabsContent value="week" className="mt-4">
        <ScheduleWeek bookingTick={bookingTick} onBookingsMutated={() => setBookingTick((n) => n + 1)} />
      </TabsContent>
      <TabsContent value="packs" className="mt-4">
        <PacksPanel bookingTick={bookingTick} onBookingsMutated={() => setBookingTick((n) => n + 1)} />
      </TabsContent>
    </Tabs>
  );
}

function ScheduleHeading() {
  const { t } = useTranslation("schedule");
  return <h1 className="text-xl font-light tracking-wide sm:text-2xl">{t("title")}</h1>;
}

function ScheduleTabs() {
  const { t } = useTranslation("schedule");
  return (
    <TabsList>
      <TabsTrigger value="week">{t("tab.week")}</TabsTrigger>
      <TabsTrigger value="packs">{t("tab.packs")}</TabsTrigger>
    </TabsList>
  );
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06..22

/** Next sensible booking slot: today rounded up to next hour if it's a weekday before 19:00,
 *  otherwise next weekday at 09:00. */
function nextCoachableSlot(): Date {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 6=Sat
  if (dow >= 1 && dow <= 5 && now.getHours() < 19) {
    const d = new Date(now);
    d.setHours(now.getHours() + 1, 0, 0, 0);
    return d;
  }
  const d = new Date(now);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  d.setHours(9, 0, 0, 0);
  return d;
}

type ClientLite = { id: string; full_name: string; photo_url: string | null; color?: string | null };

function ScheduleWeek({ bookingTick, onBookingsMutated }: { bookingTick: number; onBookingsMutated: () => void }) {
  const { t, i18n } = useTranslation("schedule");
  const { t: tc } = useTranslation("common");
  const { user } = useAuth();
  const list = useServerFn(listWeekBookings);
  const seed = useServerFn(seedScheduleDemo);
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [monday, setMonday] = useState<Date>(() => startOfIsoWeek(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creating, setCreating] = useState<{ startsAt: string; clientId?: string; packId?: string } | null>(null);
  const [clipboard, setClipboard] = useState<Booking | null>(null);
  const createFn = useServerFn(createBooking);
  const updateFn = useServerFn(updateBooking);

  // Esc cancels paste mode
  useEffect(() => {
    if (!clipboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClipboard(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clipboard]);

  const handleSlotClick = async (iso: string) => {
    if (clipboard) {
      const r: any = await createFn({
        data: {
          clientId: clipboard.client_id,
          packId: clipboard.pack_id ?? undefined,
          startsAt: iso,
          durationMin: clipboard.duration_min,
          sessionType: clipboard.session_type,
          notes: clipboard.notes ?? undefined,
        },
      });
      if (r?.ok) {
        toast.success(t("clipboard.toast_pasted"));
        setClipboard(null);
        await refresh();
        onBookingsMutated();
      } else {
        toast.error(r?.error ?? "Erro");
      }
      return;
    }
    setCreating({ startsAt: iso });
  };

  // Day-level paste: keep original HH:mm, just swap the date.
  const handleDayPaste = async (day: Date) => {
    if (!clipboard) return;
    const src = new Date(clipboard.starts_at);
    const target = new Date(day);
    target.setHours(src.getHours(), src.getMinutes(), 0, 0);
    await handleSlotClick(target.toISOString());
  };

  const handleDragMove = async (id: string, newIso: string) => {
    // optimistic
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, starts_at: newIso } : b)));
    const r: any = await updateFn({ data: { id, startsAt: newIso } });
    if (!r?.ok) {
      toast.error(r?.error ?? "Erro");
      await refresh();
    } else {
      onBookingsMutated();
    }
  };

  const handleToggleDone = async (b: Booking) => {
    const next = b.status === "done" ? "scheduled" : "done";
    setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, status: next } : x)));
    const r: any = await updateFn({ data: { id: b.id, status: next } });
    if (!r?.ok) {
      toast.error(r?.error ?? "Erro");
      await refresh();
    } else {
      onBookingsMutated();
    }
  };

  const refresh = async () => {
    setLoading(true);
    const r: any = await list({ data: { weekStart: monday.toISOString() } });
    setBookings(r?.ok ? r.rows : []);
    setLoading(false);
  };

  const refreshPacks = async () => {
    const lp = await (await import("@/server/schedule.functions")).listPacks({ data: { activeOnly: false } } as any);
    const r: any = lp;
    setPacks(r?.ok ? r.rows : []);
  };

  const refreshClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, full_name, photo_url, color")
      .order("full_name");
    setClients((data as any) ?? []);
  };

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user, monday, bookingTick]);

  useEffect(() => {
    if (!user) return;
    void refreshPacks();
    void supabase
      .from("clients")
      .select("id, full_name, photo_url, color")
      .order("full_name")
      .then(({ data }) => setClients((data as any) ?? []));
  }, [user]);

  // Search-param-driven prefill: /schedule?tab=week&newBooking=1&clientId=…&packId=…
  useEffect(() => {
    if (!user) return;
    if (search.newBooking !== 1) return;
    if (creating) return;
    const d = nextCoachableSlot();
    const next = { startsAt: d.toISOString(), clientId: search.clientId, packId: search.packId };
    // Clear the search params first so the dialog can't re-trigger from stale URL state.
    navigate({ to: "/schedule", search: { tab: "week" }, replace: true });
    setCreating(next);
  }, [user, search.newBooking, search.clientId, search.packId, creating]);

  const packById = useMemo(() => {
    const m = new Map<string, Pack>();
    packs.forEach((p) => m.set(p.id, p));
    return m;
  }, [packs]);

  const clientById = useMemo(() => {
    const m = new Map<string, ClientLite>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const expectedIncome = useMemo(() => {
    let sum = 0;
    for (const b of bookings) {
      if (b.status === "cancelled" || b.status === "no_show") continue;
      if (!b.pack_id) continue;
      const price = packById.get(b.pack_id)?.price_per_session_eur ?? 0;
      sum += Number(price);
    }
    return sum;
  }, [bookings, packById]);

  const sessionsThisWeek = bookings.filter((b) => b.status !== "cancelled").length;
  const sessionsRemaining = packs
    .filter((p) => !p.archived)
    .reduce((acc, p) => acc + Math.max(0, p.pack_size - p.sessions_used), 0);
  const packsEndingSoon = packs.filter((p) => !p.archived && packStatus(p).key === "ending_soon").length;

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const locale = i18n.language?.startsWith("pt") ? "pt-PT" : "en-GB";
  const [view, setView] = useState<"week" | "month">("week");

  // Out-of-hours: any non-cancelled booking whose hour is outside HOURS.
  const HOUR_MIN = HOURS[0];
  const HOUR_MAX = HOURS[HOURS.length - 1];
  const outOfHoursBookings = bookings
    .filter((b) => {
      const h = new Date(b.starts_at).getHours();
      return h < HOUR_MIN || h > HOUR_MAX;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const onSavedJumpToWeek = async (savedIso?: string) => {
    if (savedIso) {
      const w = startOfIsoWeek(new Date(savedIso));
      if (w.getTime() !== monday.getTime()) {
        setMonday(w);
        // refresh will re-trigger via the [monday] effect below
        await refreshPacks();
        onBookingsMutated();
        return;
      }
    }
    await refresh();
    await refreshPacks();
    onBookingsMutated();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-border">
            <button
              type="button"
              className="px-2 py-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setMonday((d) => addDays(d, -7))}
              aria-label={t("previous")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="px-2 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
              onClick={() => setMonday(startOfIsoWeek(new Date()))}
            >
              {t("this_week")}
            </button>
            <button
              type="button"
              className="px-2 py-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setMonday((d) => addDays(d, 7))}
              aria-label={t("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{fmtWeekRange(monday, locale)}</span>
          <Button
            size="sm"
            onClick={() => setCreating({ startsAt: nextCoachableSlot().toISOString() })}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("new_booking")}
          </Button>
          <div className="ml-2 inline-flex items-center rounded-md border border-border text-[11px]">
            <button
              type="button"
              onClick={() => setView("week")}
              className={`px-2.5 py-1.5 ${view === "week" ? "bg-secondary font-medium" : "text-muted-foreground"}`}
            >
              {t("view.week")}
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={`px-2.5 py-1.5 ${view === "month" ? "bg-secondary font-medium" : "text-muted-foreground"}`}
            >
              {t("view.month")}
            </button>
          </div>
        </div>
      </header>

      {clipboard ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <Copy className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate">
            {t("clipboard.copying", {
              name: clientById.get(clipboard.client_id)?.full_name ?? "—",
              time: new Date(clipboard.starts_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
              duration: clipboard.duration_min,
            })}
          </span>
          <button
            type="button"
            onClick={() => setClipboard(null)}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-0.5 hover:bg-amber-500/20"
          >
            <X className="h-3 w-3" />
            {t("clipboard.cancel")}
          </button>
        </div>
      ) : null}

      {sessionsThisWeek > 0 || expectedIncome > 0 || packsEndingSoon > 0 ? (
        <RevenuePanel
          expectedIncomeEur={expectedIncome}
          sessionsThisWeek={sessionsThisWeek}
          sessionsRemaining={sessionsRemaining}
          packsEndingSoon={packsEndingSoon}
        />
      ) : (
        <div className="rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
          {sessionsThisWeek} {t("panel.sessions_this_week").toLowerCase()} · 0€ {t("panel.expected_income").toLowerCase()}
          {sessionsRemaining > 0 && <> · {sessionsRemaining} {t("panel.sessions_remaining").toLowerCase()}</>}
        </div>
      )}

      {/* Desktop weekly grid */}
      {view === "week" ? (
      <div className={`hidden md:block overflow-hidden rounded-xl border border-border ${clipboard ? "cursor-copy" : ""}`}>
        <div className="grid" style={{ gridTemplateColumns: "60px repeat(7, minmax(0,1fr))" }}>
          <div className="border-b border-border bg-secondary/30" />
          {days.map((d, i) => (
            <div key={i} className="border-b border-l border-border bg-secondary/30 p-2 text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d)}
              </div>
              <div className="text-sm font-medium">
                {new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(d)}
              </div>
            </div>
          ))}
          {HOURS.map((h) => (
            <RowHour
              key={h}
              hour={h}
              days={days}
              bookings={bookings}
              packById={packById}
              clientById={clientById}
              onSlotClick={handleSlotClick}
              onBookingClick={(b) => setEditing(b)}
              onCopy={(b) => setClipboard(b)}
              onDragCommit={handleDragMove}
              onToggleDone={handleToggleDone}
              clipboardActive={!!clipboard}
            />
          ))}
        </div>
      </div>
      ) : (
        <ScheduleMonth
          monday={monday}
          packById={packById}
          clientById={clientById}
          locale={locale}
          onBookingClick={(b) => setEditing(b)}
          onToggleDone={handleToggleDone}
          onDayClick={(d) => (clipboard ? handleDayPaste(d) : setCreating({ startsAt: (() => { const t = new Date(d); t.setHours(9,0,0,0); return t.toISOString(); })() }))}
        />
      )}

      {/* Mobile day-strip */}
      {view === "week" && (
      <div className="md:hidden">
        <DayStrip
          days={days}
          bookings={bookings}
          packById={packById}
          clientById={clientById}
          onToggleDone={handleToggleDone}
          onSlotClick={handleSlotClick}
          onDayPaste={handleDayPaste}
          onBookingClick={(b) => setEditing(b)}
          onCopy={(b) => setClipboard(b)}
          clipboardActive={!!clipboard}
          locale={locale}
        />
      </div>
      )}

      {outOfHoursBookings.length > 0 && (
        <section
          aria-labelledby="oof-heading"
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"
        >
          <h3
            id="oof-heading"
            className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400"
          >
            {t("out_of_hours.heading")}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {outOfHoursBookings.map((b) => {
              const c = clientById.get(b.client_id);
              const pack = b.pack_id ? packById.get(b.pack_id) : undefined;
              const cls = packBlockClasses(clientColor(c, pack?.color));
              const dt = new Date(b.starts_at);
              const time = dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
              const wd = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(dt);
              const typeLabel = b.session_type === "online" ? t("form.online") : t("form.in_person");
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(b)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs ring-1 ${cls.bg} ${cls.ring} ${cls.text}`}
                  >
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls.dot}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{c?.full_name ?? "—"}</span>
                    <span className="font-mono opacity-80">
                      {wd} · {time} · {typeLabel} · {b.duration_min}′
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {loading ? null : bookings.length === 0 ? (
        <div className="flex justify-center">
          <div className="w-full max-w-[320px] rounded-xl border border-dashed border-border bg-secondary/20 p-5 text-center">
            <p className="text-sm text-foreground">{t("empty.headline")}</p>
            <ol className="mt-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              <li className="flex items-center gap-1">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px]">1</span>
                {t("empty.step1")}
              </li>
              <span aria-hidden>·</span>
              <li className="flex items-center gap-1">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px]">2</span>
                {t("empty.step2")}
              </li>
              <span aria-hidden>·</span>
              <li className="flex items-center gap-1">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px]">3</span>
                {t("empty.step3")}
              </li>
            </ol>
            <div className="mt-5 flex flex-col items-center gap-2">
              <Button
                size="sm"
                className="min-h-10 w-full"
                onClick={() => setCreating({ startsAt: nextCoachableSlot().toISOString() })}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                {t("empty.cta_new")}
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => navigate({ to: "/schedule", search: { tab: "packs" } })}
              >
                {t("empty.cta_packs")}
              </button>
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 hover:text-muted-foreground"
                onClick={async () => {
                  const r: any = await seed({});
                  if (r?.ok) {
                    toast.success(t("pack.demo_seeded", { count: r.count }));
                    await refresh();
                    await refreshPacks();
                  } else if (r?.error === "no_clients") {
                    toast.error(tc("nav.clients") + " · 0");
                  } else {
                    toast.error(r?.error ?? "error");
                  }
                }}
              >
                <Sparkles className="h-3 w-3" />
                {t("pack.demo_seed")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* New booking dialog */}
      <BookingDialog
        open={!!creating}
        onOpenChange={(v) => {
          if (!v) setCreating(null);
        }}
        initial={creating ? { startsAt: creating.startsAt, clientId: creating.clientId, packId: creating.packId } : undefined}
        clients={clients}
        packs={packs}
        onPacksRefresh={refreshPacks}
        onClientsRefresh={refreshClients}
        onSaved={async (savedIso) => {
          setCreating(null);
          await onSavedJumpToWeek(savedIso);
        }}
      />

      {/* Edit booking dialog */}
      <BookingDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        editing={editing ?? undefined}
        clients={clients}
        packs={packs}
        onPacksRefresh={refreshPacks}
        onClientsRefresh={refreshClients}
        onSaved={async (savedIso) => {
          setEditing(null);
          await onSavedJumpToWeek(savedIso);
        }}
      />
    </div>
  );
}

function RowHour({
  hour,
  days,
  bookings,
  packById,
  clientById,
  onSlotClick,
  onBookingClick,
  onCopy,
  onDragCommit,
  onToggleDone,
  clipboardActive,
}: {
  hour: number;
  days: Date[];
  bookings: Booking[];
  packById: Map<string, Pack>;
  clientById: Map<string, ClientLite>;
  onSlotClick: (iso: string) => void;
  onBookingClick: (b: Booking) => void;
  onCopy: (b: Booking) => void;
  onDragCommit: (id: string, newIso: string) => void;
  onToggleDone: (b: Booking) => void;
  clipboardActive: boolean;
}) {
  const [dropDay, setDropDay] = useState<number | null>(null);
  return (
    <>
      <div className="border-b border-border px-1 py-2 text-right text-[10px] font-mono text-muted-foreground">
        {String(hour).padStart(2, "0")}:00
      </div>
      {days.map((d, i) => {
        const slot = new Date(d);
        slot.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(slot);
        slotEnd.setHours(hour + 1, 0, 0, 0);
        const here = bookings.filter((b) => {
          const t = new Date(b.starts_at);
          return t >= slot && t < slotEnd;
        });
        return (
          <div
            key={i}
            className={`relative h-14 border-b border-l border-border ${clipboardActive ? "hover:bg-secondary/70 cursor-copy" : "hover:bg-secondary/40"} ${dropDay === i ? "drop-target-active" : ""}`}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/x-booking-id")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropDay !== i) setDropDay(i);
              }
            }}
            onDragLeave={() => {
              if (dropDay === i) setDropDay(null);
            }}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("application/x-booking-id");
              setDropDay(null);
              if (!id) return;
              e.preventDefault();
              // Preserve original minute offset; snap to this cell's day+hour.
              const original = bookings.find((b) => b.id === id);
              const minutes = original ? new Date(original.starts_at).getMinutes() : 0;
              const next = new Date(slot);
              next.setMinutes(minutes, 0, 0);
              if (original && next.toISOString() === original.starts_at) return;
              onDragCommit(id, next.toISOString());
            }}
          >
            <button
              type="button"
              className="absolute inset-0"
              onClick={() => onSlotClick(slot.toISOString())}
              aria-label="add"
            />
            {here.map((b) => {
              const pack = b.pack_id ? packById.get(b.pack_id) : undefined;
              const c = clientById.get(b.client_id);
              const cls = packBlockClasses(clientColor(c, pack?.color));
              return (
                <BookingBlock
                  key={b.id}
                  booking={b}
                  clientName={c?.full_name ?? "—"}
                  cls={cls}
                  onClick={() => onBookingClick(b)}
                  onCopy={() => onCopy(b)}
                  onDragCommit={onDragCommit}
                  onToggleDone={() => onToggleDone(b)}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function BookingBlock({
  booking,
  clientName,
  cls,
  onClick,
  onCopy,
  onDragCommit,
  onToggleDone,
}: {
  booking: Booking;
  clientName: string;
  cls: { bg: string; ring: string; text: string; dot: string };
  onClick: () => void;
  onCopy: () => void;
  onDragCommit: (id: string, newIso: string) => void;
  onToggleDone: () => void;
}) {
  const [dragOffset, setDragOffset] = useState(0); // minutes
  const [dragging, setDragging] = useState(false);
  const PX_PER_MIN = 56 / 60;

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-copy-btn]")) return;
    e.preventDefault();
    const startY = e.clientY;
    let started = false;
    let lastDelta = 0;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      if (!started && Math.abs(dy) < 4) return;
      started = true;
      setDragging(true);
      const minutes = Math.round(dy / PX_PER_MIN / 15) * 15;
      lastDelta = minutes;
      setDragOffset(minutes);
    };
    const onUp = () => {
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!started) {
        onClick();
      } else if (lastDelta !== 0) {
        const next = new Date(booking.starts_at);
        next.setMinutes(next.getMinutes() + lastDelta);
        onDragCommit(booking.id, next.toISOString());
      }
      setDragOffset(0);
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const previewTime = (() => {
    const t = new Date(booking.starts_at);
    if (dragOffset) t.setMinutes(t.getMinutes() + dragOffset);
    return t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  })();

  return (
    <div
      onPointerDown={onPointerDown}
      style={{ transform: dragOffset ? `translateY(${dragOffset * PX_PER_MIN}px)` : undefined }}
      className={`group absolute left-1 right-1 top-1 bottom-1 rounded-md ring-1 px-2 py-1 text-left text-[11px] select-none touch-none ${cls.bg} ${cls.ring} ${cls.text} ${booking.status === "cancelled" ? "opacity-40 line-through" : ""} ${dragging ? "cursor-ns-resize ring-2 ring-foreground/40 z-10" : "cursor-grab"}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className={`truncate font-medium ${booking.status === "done" ? "line-through opacity-70" : ""}`}>{clientName}</div>
          <div className="truncate font-mono text-[10px] opacity-80">
            {previewTime} · {booking.duration_min}′
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            data-copy-btn
            onClick={(e) => {
              e.stopPropagation();
              onToggleDone();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={booking.status === "done" ? "mark scheduled" : "mark done"}
            title={booking.status === "done" ? "Marcar como agendada" : "Marcar como feita"}
            className={`rounded p-0.5 transition-opacity hover:bg-foreground/10 ${booking.status === "done" ? "opacity-100 text-emerald-600 dark:text-emerald-400" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            type="button"
            data-copy-btn
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="copy"
            title="Copiar"
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded p-0.5 hover:bg-foreground/10 transition-opacity"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DayStrip({
  days,
  bookings,
  packById,
  clientById,
  onSlotClick,
  onDayPaste,
  onBookingClick,
  onCopy,
  onToggleDone,
  clipboardActive,
  locale,
}: {
  days: Date[];
  bookings: Booking[];
  packById: Map<string, Pack>;
  clientById: Map<string, ClientLite>;
  onSlotClick: (iso: string) => void;
  onDayPaste?: (day: Date) => void;
  onBookingClick: (b: Booking) => void;
  onCopy: (b: Booking) => void;
  onToggleDone: (b: Booking) => void;
  clipboardActive: boolean;
  locale: string;
}) {
  const [active, setActive] = useState(0);
  const day = days[active];
  const list = bookings
    .filter((b) => {
      const t = new Date(b.starts_at);
      return t.toDateString() === day.toDateString();
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const { t: ts } = useTranslation("schedule");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isActive = i === active;
          const isToday = d.toDateString() === new Date().toDateString();
          // Some locales (PT) return "seg.", "qua." etc. Strip punctuation
          // and clip to 3 chars so every pill stays the same width.
          const wdRaw = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
          const wd = wdRaw.replace(/[.\s]/g, "").slice(0, 3).toUpperCase();
          return (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-lg border px-0.5 py-2 text-center leading-tight ${isActive ? "border-foreground bg-secondary" : "border-border text-muted-foreground"}`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider">{wd}</span>
              <span className={`mt-0.5 text-sm font-medium ${isToday ? "underline underline-offset-4" : ""}`}>
                {new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(d)}
              </span>
            </button>
          );
        })}
      </div>
      {list.length > 0 && (
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {ts("day.list_header", { count: list.length })}
        </p>
      )}
      <div className="space-y-2">
        {list.length === 0 ? (
          <button
            type="button"
            onClick={() => {
              const t = new Date(day);
              t.setHours(9, 0, 0, 0);
              onSlotClick(t.toISOString());
            }}
            className="w-full rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground"
          >
            +
          </button>
        ) : (
          list.map((b) => {
            const pack = b.pack_id ? packById.get(b.pack_id) : undefined;
            const c = clientById.get(b.client_id);
            const cls = packBlockClasses(clientColor(c, pack?.color));
            const time = new Date(b.starts_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
            const typeLabel = b.session_type === "online" ? ts("form.online") : ts("form.in_person");
            return (
              <div
                key={b.id}
                className={`flex w-full items-center gap-2 rounded-md ring-1 px-3 py-2 text-left text-sm ${cls.bg} ${cls.ring} ${cls.text}`}
              >
                <button
                  type="button"
                  onClick={() => onBookingClick(b)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ClientAvatar name={c?.full_name ?? ""} photoUrl={c?.photo_url ?? null} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-medium ${b.status === "done" ? "line-through opacity-70" : ""}`}>{c?.full_name ?? "—"}</div>
                    <div className="truncate text-[11px] opacity-80">
                      <span className="font-mono">{time}</span> · {typeLabel} · {b.duration_min}′
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleDone(b);
                  }}
                  aria-label={b.status === "done" ? "mark scheduled" : "mark done"}
                  title={b.status === "done" ? "Marcar como agendada" : "Marcar como feita"}
                  className={`rounded p-1 hover:bg-foreground/10 ${b.status === "done" ? "text-emerald-600 dark:text-emerald-400" : "opacity-70 hover:opacity-100"}`}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy(b);
                  }}
                  aria-label="copy"
                  title="Copiar"
                  className="rounded p-1 opacity-70 hover:opacity-100 hover:bg-foreground/10"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
      {clipboardActive && (
        <button
          type="button"
          onClick={() => onDayPaste?.(day)}
          className="w-full rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
        >
          {ts("clipboard.paste_same_day", { time: "" }).replace(/\s*\(\s*\)\s*/g, "")}
        </button>
      )}
    </div>
  );
}

function ScheduleMonth({
  monday,
  packById,
  clientById,
  locale,
  onBookingClick,
  onDayClick,
  onToggleDone,
}: {
  monday: Date;
  packById: Map<string, Pack>;
  clientById: Map<string, ClientLite>;
  locale: string;
  onBookingClick: (b: Booking) => void;
  onDayClick: (d: Date) => void;
  onToggleDone: (b: Booking) => void;
}) {
  const { t } = useTranslation("schedule");
  const monthFn = useServerFn(listMonthBookings);
  const [rows, setRows] = useState<Booking[]>([]);
  const monthAnchor = useMemo(() => {
    const d = new Date(monday);
    d.setDate(1);
    return d;
  }, [monday]);
  useEffect(() => {
    void (async () => {
      const r: any = await monthFn({
        data: { year: monthAnchor.getFullYear(), month: monthAnchor.getMonth() },
      });
      setRows(r?.ok ? r.rows : []);
    })();
  }, [monthAnchor]);

  // Build 6×7 grid starting on Monday of week containing day 1
  const gridStart = startOfIsoWeek(monthAnchor);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const byDay = new Map<string, Booking[]>();
  for (const b of rows) {
    const k = new Date(b.starts_at).toDateString();
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(b);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 bg-secondary/30 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        {Array.from({ length: 7 }, (_, i) => addDays(gridStart, i)).map((d, i) => (
          <div key={i} className="border-l border-border first:border-l-0 py-1.5">
            {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === monthAnchor.getMonth();
          const isToday = d.toDateString() === new Date().toDateString();
          const list = (byDay.get(d.toDateString()) ?? []).filter((b) => b.status !== "cancelled");
          const visible = list.slice(0, 3);
          const more = list.length - visible.length;
          return (
            <div
              key={i}
              className={`min-h-24 border-l border-t border-border p-1.5 text-left ${inMonth ? "" : "bg-secondary/20 text-muted-foreground/60"}`}
            >
              <button
                type="button"
                onClick={() => onDayClick(d)}
                className={`mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${isToday ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-secondary"}`}
              >
                {d.getDate()}
              </button>
              <div className="space-y-0.5">
                {visible.map((b) => {
                  const c = clientById.get(b.client_id);
                  const pack = b.pack_id ? packById.get(b.pack_id) : undefined;
                  const col = clientColor(c, pack?.color);
                  const cls = packBlockClasses(col);
                  const time = new Date(b.starts_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div
                      key={b.id}
                      className={`group flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] ring-1 ${cls.bg} ${cls.ring} ${cls.text}`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleDone(b);
                        }}
                        aria-label={b.status === "done" ? "mark scheduled" : "mark done"}
                        title={b.status === "done" ? "Marcar como agendada" : "Marcar como feita"}
                        className={`shrink-0 rounded p-0.5 hover:bg-foreground/10 ${b.status === "done" ? "text-emerald-600 dark:text-emerald-400" : "opacity-50 group-hover:opacity-100"}`}
                      >
                        <Check className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onBookingClick(b)}
                        className={`flex min-w-0 flex-1 items-center gap-1 truncate text-left ${b.status === "done" ? "line-through opacity-70" : ""}`}
                      >
                        <span className="font-mono">{time}</span>
                        <span className="min-w-0 truncate">{c?.full_name ?? "—"}</span>
                      </button>
                    </div>
                  );
                })}
                {more > 0 && (
                  <div className="px-1 text-[10px] text-muted-foreground">{t("view.more", { count: more })}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingDialog({
  open,
  onOpenChange,
  initial,
  editing,
  clients,
  packs,
  onPacksRefresh,
  onClientsRefresh,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: { startsAt: string; clientId?: string; packId?: string };
  editing?: Booking;
  clients: ClientLite[];
  packs: Pack[];
  onPacksRefresh?: () => void | Promise<void>;
  onClientsRefresh?: () => void | Promise<void>;
  onSaved: (savedIso?: string) => void | Promise<void>;
}) {
  const { t } = useTranslation("schedule");
  const { t: tc } = useTranslation("common");
  const create = useServerFn(createBooking);
  const upd = useServerFn(updateBooking);
  const del = useServerFn(deleteBooking);
  const dup = useServerFn(duplicateBookingNextWeek);

  const startsAt = editing?.starts_at ?? initial?.startsAt ?? new Date().toISOString();
  const [clientId, setClientId] = useState(editing?.client_id ?? initial?.clientId ?? "");
  const [packId, setPackId] = useState<string>(editing?.pack_id ?? initial?.packId ?? "");
  const [date, setDate] = useState(startsAt.slice(0, 10));
  const [time, setTime] = useState(startsAt.slice(11, 16));
  const [duration, setDuration] = useState(editing?.duration_min ?? 60);
  const [sessionType, setSessionType] = useState<"in_person" | "online">(editing?.session_type ?? "in_person");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(false);
  const [candidateWeekCount, setCandidateWeekCount] = useState(0);
  const [inlinePackOpen, setInlinePackOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const setColor = useServerFn(setClientColor);
  const currentClient = clients.find((c) => c.id === clientId);
  const currentColor = clientColor(currentClient);

  useEffect(() => {
    if (!open) return;
    const ts = editing?.starts_at ?? initial?.startsAt ?? new Date().toISOString();
    setClientId(editing?.client_id ?? initial?.clientId ?? "");
    setPackId(editing?.pack_id ?? initial?.packId ?? "");
    setDate(ts.slice(0, 10));
    setTime(ts.slice(11, 16));
    setDuration(editing?.duration_min ?? 60);
    setSessionType(editing?.session_type ?? "in_person");
    setNotes(editing?.notes ?? "");
    setOverride(false);
  }, [open, editing, initial]);

  const clientPacks = packs.filter((p) => p.client_id === clientId && !p.archived);

  // Weekly frequency guard against the candidate booking date's ISO week,
  // not the displayed week. Re-counts client+pack bookings whenever the
  // user changes client/pack/date in the dialog.
  const agreedFreq = packId ? (packs.find((p) => p.id === packId)?.weekly_frequency ?? 0) : 0;
  useEffect(() => {
    if (!open || !clientId) {
      setCandidateWeekCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const candidate = new Date(`${date}T${time || "09:00"}:00`);
      if (Number.isNaN(candidate.getTime())) return;
      const wkStart = startOfIsoWeek(candidate);
      const wkEnd = addDays(wkStart, 7);
      let q = supabase
        .from("client_bookings")
        .select("id, status, pack_id")
        .eq("client_id", clientId)
        .gte("starts_at", wkStart.toISOString())
        .lt("starts_at", wkEnd.toISOString());
      if (packId) q = q.eq("pack_id", packId);
      const { data } = await q;
      if (cancelled) return;
      const rows = (data as any[]) ?? [];
      const count = rows.filter(
        (r) => r.status !== "cancelled" && (!editing || r.id !== editing.id),
      ).length;
      setCandidateWeekCount(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clientId, packId, date, time, editing]);
  const usedThisWeek = candidateWeekCount;
  const overFrequency = agreedFreq > 0 && usedThisWeek >= agreedFreq;

  const save = async () => {
    if (!clientId) return toast.error(t("form.select_client"));
    if (overFrequency && !override) return;
    setBusy(true);
    const iso = new Date(`${date}T${time}:00`).toISOString();
    const r: any = editing
      ? await upd({
          data: {
            id: editing.id,
            startsAt: iso,
            durationMin: duration,
            sessionType,
            notes: notes || null,
            packId: packId || null,
          },
        })
      : await create({
          data: {
            clientId,
            packId: packId || null,
            startsAt: iso,
            durationMin: duration,
            sessionType,
            notes,
          },
        });
    setBusy(false);
    if (r?.ok) {
      await onSaved(iso);
    } else {
      toast.error(r?.error ?? "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("form.edit_session") : t("form.new_session")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("form.client")}</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={!!editing}>
              <SelectTrigger><SelectValue placeholder={t("form.select_client")} /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {clientId && (
            <div>
              <Label>{t("form.pack")}</Label>
              <Select
                value={packId || "__none__"}
                onValueChange={(v) => {
                  if (v === "__new__") {
                    setInlinePackOpen(true);
                    return;
                  }
                  setPackId(v === "__none__" ? "" : v);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("form.no_pack")}</SelectItem>
                  {clientPacks.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} · {Math.max(0, p.pack_size - p.sessions_used)}/{p.pack_size}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">
                    + {t("pack.new")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {overFrequency && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <p>{tc("dashboard.schedule.frequency_warn", { used: usedThisWeek, agreed: agreedFreq })}</p>
              <label className="mt-1.5 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                {tc("dashboard.schedule.extra_session")}
              </label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("form.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>{t("form.time")}</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <Label>{t("form.duration")}</Label>
              <Input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 60)} />
            </div>
            <div>
              <Label>{t("form.type")}</Label>
              <Select value={sessionType} onValueChange={(v) => setSessionType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">{t("form.in_person")}</SelectItem>
                  <SelectItem value="online">{t("form.online")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t("form.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          {clientId && (
            <div>
              <Label>{t("form.client_color")}</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {PACK_COLORS.map((col) => {
                  const cls = packBlockClasses(col);
                  const active = currentColor === col;
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={async () => {
                        const r: any = await setColor({ data: { clientId, color: col as any } });
                        if (r?.ok) {
                          await onClientsRefresh?.();
                        }
                      }}
                      className={`h-5 w-5 rounded-full ${cls.dot} ${active ? "ring-2 ring-offset-2 ring-foreground ring-offset-background" : ""}`}
                      aria-label={col}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {editing && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const r: any = await upd({ data: { id: editing.id, status: editing.status === "done" ? "scheduled" : "done" } });
                  if (r?.ok) await onSaved(editing.starts_at);
                }}
              >
                <Check className="mr-2 h-4 w-4" />
                {editing.status === "done" ? t("form.mark_scheduled") : t("form.mark_done")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const r: any = await dup({ data: { id: editing.id } });
                  if (r?.ok) {
                    toast.success("✓");
                    const next = new Date(editing.starts_at);
                    next.setDate(next.getDate() + 7);
                    await onSaved(next.toISOString());
                  }
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t("form.duplicate_next_week")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("form.delete")}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("form.cancel")}</Button>
          <Button onClick={save} disabled={busy || (overFrequency && !override)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("form.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
      <PackFormDialog
        open={inlinePackOpen}
        onOpenChange={setInlinePackOpen}
        clients={clients}
        initialClientId={clientId}
        lockClient
        onSaved={async (newId) => {
          setInlinePackOpen(false);
          await onPacksRefresh?.();
          if (newId) setPackId(newId);
        }}
      />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("form.delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("form.delete_confirm_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("form.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!editing) return;
                const r: any = await del({ data: { id: editing.id } });
                setConfirmDelete(false);
                if (r?.ok) await onSaved(editing.starts_at);
              }}
            >
              {t("form.delete_confirm_yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}