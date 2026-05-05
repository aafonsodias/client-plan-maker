import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
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
import { ChevronLeft, ChevronRight, Plus, Settings2, Sparkles, Loader2, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  listWeekBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  duplicateBookingNextWeek,
  listPacks,
  seedScheduleDemo,
} from "@/server/schedule.functions";
import { RevenuePanel } from "@/components/schedule/RevenuePanel";
import { ClientAvatar } from "@/components/ClientAvatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PacksPanel } from "./schedule.packs";
import {
  type Booking,
  type Pack,
  addDays,
  fmtWeekRange,
  packBlockClasses,
  packStatus,
  startOfIsoWeek,
} from "@/lib/schedule";

export const Route = createFileRoute("/schedule")({
  validateSearch: (s: Record<string, unknown>): { tab?: "week" | "packs" } => ({
    tab: s.tab === "packs" ? "packs" : "week",
  }),
  component: () => (
    <AppShell back={{ to: "/dashboard" }}>
      <ScheduleShell />
    </AppShell>
  ),
});

function ScheduleShell() {
  const location = useLocation();
  if (location.pathname.startsWith("/schedule/")) {
    return <Outlet />;
  }
  const search = Route.useSearch();
  const navigate = useNavigate();
  const tab = (search.tab as "week" | "packs") ?? "week";
  return (
    <Tabs
      value={tab}
      onValueChange={(v) =>
        navigate({ to: "/schedule", search: { tab: v === "packs" ? "packs" : "week" } })
      }
    >
      <TabsList>
        <TabsTrigger value="week">Week</TabsTrigger>
        <TabsTrigger value="packs">Packs</TabsTrigger>
      </TabsList>
      <TabsContent value="week" className="mt-4">
        <ScheduleWeek />
      </TabsContent>
      <TabsContent value="packs" className="mt-4">
        <PacksPanel />
      </TabsContent>
    </Tabs>
  );
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06..22

type ClientLite = { id: string; full_name: string; photo_url: string | null };

function ScheduleWeek() {
  const { t, i18n } = useTranslation("schedule");
  const { t: tc } = useTranslation("common");
  const { user } = useAuth();
  const list = useServerFn(listWeekBookings);
  const seed = useServerFn(seedScheduleDemo);

  const [monday, setMonday] = useState<Date>(() => startOfIsoWeek(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creating, setCreating] = useState<{ startsAt: string } | null>(null);

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

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user, monday]);

  useEffect(() => {
    if (!user) return;
    void refreshPacks();
    void supabase
      .from("clients")
      .select("id, full_name, photo_url")
      .order("full_name")
      .then(({ data }) => setClients((data as any) ?? []));
  }, [user]);

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

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wide sm:text-2xl">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
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
          <Button asChild variant="outline" size="sm">
            <Link to="/schedule/packs">
              <Settings2 className="mr-2 h-4 w-4" />
              {t("manage_packs")}
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const d = new Date(monday);
              d.setHours(9, 0, 0, 0);
              setCreating({ startsAt: d.toISOString() });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("new_booking")}
          </Button>
        </div>
      </header>

      <RevenuePanel
        expectedIncomeEur={expectedIncome}
        sessionsThisWeek={sessionsThisWeek}
        sessionsRemaining={sessionsRemaining}
        packsEndingSoon={packsEndingSoon}
      />

      {/* Desktop weekly grid */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border">
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
              onSlotClick={(iso) => setCreating({ startsAt: iso })}
              onBookingClick={(b) => setEditing(b)}
            />
          ))}
        </div>
      </div>

      {/* Mobile day-strip */}
      <div className="md:hidden">
        <DayStrip
          days={days}
          bookings={bookings}
          packById={packById}
          clientById={clientById}
          onSlotClick={(iso) => setCreating({ startsAt: iso })}
          onBookingClick={(b) => setEditing(b)}
          locale={locale}
        />
      </div>

      {loading ? null : bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
          {t("empty_week")}
          <div className="mt-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
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
              <Sparkles className="mr-2 h-4 w-4" />
              {t("pack.demo_seed")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* New booking dialog */}
      <BookingDialog
        open={!!creating}
        onOpenChange={(v) => !v && setCreating(null)}
        initial={creating ? { startsAt: creating.startsAt } : undefined}
        clients={clients}
        packs={packs}
        onSaved={async () => {
          setCreating(null);
          await refresh();
          await refreshPacks();
        }}
      />

      {/* Edit booking dialog */}
      <BookingDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        editing={editing ?? undefined}
        clients={clients}
        packs={packs}
        onSaved={async () => {
          setEditing(null);
          await refresh();
          await refreshPacks();
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
}: {
  hour: number;
  days: Date[];
  bookings: Booking[];
  packById: Map<string, Pack>;
  clientById: Map<string, ClientLite>;
  onSlotClick: (iso: string) => void;
  onBookingClick: (b: Booking) => void;
}) {
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
            className="relative h-14 border-b border-l border-border hover:bg-secondary/40"
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
              const cls = packBlockClasses(pack?.color ?? "emerald");
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookingClick(b);
                  }}
                  className={`absolute left-1 right-1 top-1 bottom-1 rounded-md ring-1 px-2 py-1 text-left text-[11px] ${cls.bg} ${cls.ring} ${cls.text} ${b.status === "cancelled" ? "opacity-40 line-through" : ""}`}
                >
                  <div className="truncate font-medium">{c?.full_name ?? "—"}</div>
                  <div className="truncate font-mono text-[10px] opacity-80">
                    {new Date(b.starts_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · {b.duration_min}′
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function DayStrip({
  days,
  bookings,
  packById,
  clientById,
  onSlotClick,
  onBookingClick,
  locale,
}: {
  days: Date[];
  bookings: Booking[];
  packById: Map<string, Pack>;
  clientById: Map<string, ClientLite>;
  onSlotClick: (iso: string) => void;
  onBookingClick: (b: Booking) => void;
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
  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {days.map((d, i) => {
          const isActive = i === active;
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`flex min-w-[52px] flex-col items-center rounded-lg border px-2 py-1.5 text-center ${isActive ? "border-foreground bg-secondary" : "border-border text-muted-foreground"}`}
            >
              <span className="text-[10px] uppercase tracking-widest">
                {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d)}
              </span>
              <span className={`text-sm font-medium ${isToday ? "underline" : ""}`}>
                {new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(d)}
              </span>
            </button>
          );
        })}
      </div>
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
            const cls = packBlockClasses(pack?.color ?? "emerald");
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onBookingClick(b)}
                className={`flex w-full items-center gap-2 rounded-md ring-1 px-3 py-2 text-left text-sm ${cls.bg} ${cls.ring} ${cls.text}`}
              >
                <ClientAvatar name={c?.full_name ?? ""} photoUrl={c?.photo_url ?? null} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c?.full_name ?? "—"}</div>
                  <div className="truncate font-mono text-[11px] opacity-80">
                    {new Date(b.starts_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · {b.duration_min}′
                  </div>
                </div>
              </button>
            );
          })
        )}
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
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: { startsAt: string };
  editing?: Booking;
  clients: ClientLite[];
  packs: Pack[];
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation("schedule");
  const create = useServerFn(createBooking);
  const upd = useServerFn(updateBooking);
  const del = useServerFn(deleteBooking);
  const dup = useServerFn(duplicateBookingNextWeek);

  const startsAt = editing?.starts_at ?? initial?.startsAt ?? new Date().toISOString();
  const [clientId, setClientId] = useState(editing?.client_id ?? "");
  const [packId, setPackId] = useState<string>(editing?.pack_id ?? "");
  const [date, setDate] = useState(startsAt.slice(0, 10));
  const [time, setTime] = useState(startsAt.slice(11, 16));
  const [duration, setDuration] = useState(editing?.duration_min ?? 60);
  const [sessionType, setSessionType] = useState<"in_person" | "online">(editing?.session_type ?? "in_person");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ts = editing?.starts_at ?? initial?.startsAt ?? new Date().toISOString();
    setClientId(editing?.client_id ?? "");
    setPackId(editing?.pack_id ?? "");
    setDate(ts.slice(0, 10));
    setTime(ts.slice(11, 16));
    setDuration(editing?.duration_min ?? 60);
    setSessionType(editing?.session_type ?? "in_person");
    setNotes(editing?.notes ?? "");
  }, [open, editing, initial]);

  const clientPacks = packs.filter((p) => p.client_id === clientId && !p.archived);

  const save = async () => {
    if (!clientId) return toast.error(t("form.select_client"));
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
      await onSaved();
    } else {
      toast.error(r?.error ?? "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("form.save") : t("new_booking")}</DialogTitle>
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
              <Select value={packId || "__none__"} onValueChange={(v) => setPackId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("form.no_pack")}</SelectItem>
                  {clientPacks.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} · {Math.max(0, p.pack_size - p.sessions_used)}/{p.pack_size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          {editing && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const r: any = await upd({ data: { id: editing.id, status: editing.status === "done" ? "scheduled" : "done" } });
                  if (r?.ok) await onSaved();
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
                    await onSaved();
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
                onClick={async () => {
                  const r: any = await del({ data: { id: editing.id } });
                  if (r?.ok) await onSaved();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("form.delete")}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("form.cancel")}</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("form.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}