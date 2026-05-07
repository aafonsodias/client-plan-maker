import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Archive, RotateCcw, Loader2, MoreVertical, CalendarPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listPacks, upsertPack, archivePack } from "@/server/schedule.functions";
import { type Pack, PACK_COLORS, packStatus, packBlockClasses } from "@/lib/schedule";
import { toneChip } from "@/lib/status-tone";
import { ClientAvatar } from "@/components/ClientAvatar";
import { startOfIsoWeek, addDays } from "@/lib/schedule";

export const Route = createFileRoute("/schedule/packs")({
  beforeLoad: () => {
    throw redirect({ to: "/schedule", search: { tab: "packs" } });
  },
});

type ClientLite = { id: string; full_name: string; photo_url: string | null };

export function PacksPanel({
  bookingTick = 0,
  onBookingsMutated,
}: { bookingTick?: number; onBookingsMutated?: () => void } = {}) {
  const { t } = useTranslation("schedule");
  const { user } = useAuth();
  const list = useServerFn(listPacks);
  const arch = useServerFn(archivePack);
  const navigate = useNavigate();

  const [packs, setPacks] = useState<Pack[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [editing, setEditing] = useState<Pack | null>(null);
  const [creating, setCreating] = useState(false);
  const [scheduledByPack, setScheduledByPack] = useState<Record<string, number>>({});

  const refresh = async () => {
    const r: any = await list({ data: { activeOnly: false } });
    setPacks(r?.ok ? r.rows : []);
  };

  useEffect(() => {
    if (!user) return;
    void refresh();
    void supabase
      .from("clients")
      .select("id, full_name, photo_url")
      .order("full_name")
      .then(({ data }) => setClients((data as any) ?? []));
  }, [user]);

  // One scoped read of this week's non-cancelled bookings → count per pack.
  useEffect(() => {
    if (!user) return;
    if (packs.length === 0) {
      setScheduledByPack({});
      return;
    }
    const monday = startOfIsoWeek(new Date());
    const sunday = addDays(monday, 7);
    const packIds = packs.map((p) => p.id);
    void supabase
      .from("client_bookings")
      .select("pack_id, status, starts_at")
      .gte("starts_at", monday.toISOString())
      .lt("starts_at", sunday.toISOString())
      .in("pack_id", packIds)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        for (const row of (data as any[]) ?? []) {
          if (!row.pack_id) continue;
          if (row.status === "cancelled") continue;
          counts[row.pack_id] = (counts[row.pack_id] ?? 0) + 1;
        }
        setScheduledByPack(counts);
      });
  }, [user, packs, bookingTick]);

  const clientById = useMemo(() => {
    const m = new Map<string, ClientLite>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-light tracking-wide sm:text-2xl">{t("pack.title")}</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("pack.new")}
        </Button>
      </header>

      {packs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
          {t("pack.empty")}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {packs.map((p) => {
            const c = clientById.get(p.client_id);
            const st = packStatus(p);
            const left = Math.max(0, p.pack_size - p.sessions_used);
            const cls = packBlockClasses(p.color);
            const scheduled = scheduledByPack[p.id] ?? 0;
            return (
              <li key={p.id} className="rounded-xl border border-border p-3">
                {/* Row 1: avatar · name · status */}
                <div className="flex items-center gap-2.5">
                  <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls.dot}`} aria-hidden />
                  <ClientAvatar name={c?.full_name ?? ""} photoUrl={c?.photo_url ?? null} size={32} />
                  <span className="min-w-0 flex-1 truncate font-medium">{c?.full_name ?? "—"}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${toneChip(st.tone)}`}>
                    {t(`pack.status_${st.key}`)}
                  </span>
                </div>
                {/* Row 2: operational meta */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-[calc(0.625rem+32px+0.625rem)] text-[11px] text-muted-foreground">
                  <span className="truncate">{p.label}</span>
                  <span aria-hidden>·</span>
                  <span className="font-mono">{t("pack.sessions_short", { used: p.sessions_used, total: p.pack_size })}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {Number(p.price_per_session_eur) > 0
                      ? t("pack.per_session_short", { price: Number(p.price_per_session_eur) })
                      : t("pack.price_unset")}
                  </span>
                  {p.weekly_frequency > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{t("pack.per_week_short", { count: p.weekly_frequency })}</span>
                    </>
                  )}
                  <span aria-hidden>·</span>
                  <span>{t("pack.scheduled_this_week", { count: scheduled })}</span>
                  <span aria-hidden>·</span>
                  <span>{p.session_type === "in_person" ? t("form.in_person") : t("form.online")}</span>
                  {p.archived && <span className="ml-1 italic">· {t("pack.archive")}</span>}
                </div>
                {/* Action row */}
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  {!p.archived && (
                    <Button
                      size="sm"
                      className="min-h-9"
                      onClick={() =>
                        navigate({
                          to: "/schedule",
                          search: { tab: "week", newBooking: 1, clientId: p.client_id, packId: p.id },
                        })
                      }
                    >
                      <CalendarPlus className="mr-1.5 h-4 w-4" />
                      {t("pack.book_session")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="min-h-9" onClick={() => setEditing(p)}>
                    {t("pack.manage")}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-9 w-9" aria-label={t("pack.more_actions")}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={async () => {
                          const r: any = await arch({ data: { id: p.id, archived: !p.archived } });
                          if (r?.ok) await refresh();
                        }}
                      >
                        {p.archived ? (
                          <>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {t("pack.unarchive")}
                          </>
                        ) : (
                          <>
                            <Archive className="mr-2 h-4 w-4" />
                            {t("pack.archive")}
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PackFormDialog
        open={!!editing || creating}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCreating(false);
          }
        }}
        editing={editing ?? undefined}
        clients={clients}
        onSaved={async () => {
          setEditing(null);
          setCreating(false);
          await refresh();
        }}
      />
    </div>
  );
}

function PackFormDialog({
  open,
  onOpenChange,
  editing,
  clients,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Pack;
  clients: ClientLite[];
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation("schedule");
  const save = useServerFn(upsertPack);

  const [clientId, setClientId] = useState(editing?.client_id ?? "");
  const [label, setLabel] = useState(editing?.label ?? t("pack.default_label"));
  const [sessionType, setSessionType] = useState<"in_person" | "online">(editing?.session_type ?? "in_person");
  const [price, setPrice] = useState<number | "">(editing ? Number(editing.price_per_session_eur ?? 0) : "");
  const [size, setSize] = useState<number>(editing?.pack_size ?? 10);
  const [freq, setFreq] = useState<number>(editing?.weekly_frequency ?? 2);
  const [start, setStart] = useState<string>(editing?.start_date ?? new Date().toISOString().slice(0, 10));
  const [color, setColor] = useState<string>(editing?.color ?? "emerald");
  const [busy, setBusy] = useState(false);
  const [sessionsUsed, setSessionsUsed] = useState<number>(editing?.sessions_used ?? 0);
  const priceRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setClientId(editing?.client_id ?? "");
    setLabel(editing?.label ?? t("pack.default_label"));
    setSessionType(editing?.session_type ?? "in_person");
    setPrice(editing ? Number(editing.price_per_session_eur ?? 0) : "");
    setSize(editing?.pack_size ?? 10);
    setFreq(editing?.weekly_frequency ?? 2);
    setStart(editing?.start_date ?? new Date().toISOString().slice(0, 10));
    setColor(editing?.color ?? "emerald");
    setSessionsUsed(editing?.sessions_used ?? 0);
  }, [open, editing]);

  const submit = async () => {
    if (!clientId) return toast.error(t("form.select_client"));
    const priceNum = typeof price === "number" ? price : parseFloat(String(price)) || 0;
    if (!priceNum || priceNum <= 0) {
      toast.error(t("pack.price_required"));
      priceRef.current?.focus();
      return;
    }
    if (sessionsUsed > size) {
      toast.error(t("pack.sessions_used_invalid"));
      return;
    }
    setBusy(true);
    const r: any = await save({
      data: {
        id: editing?.id,
        clientId,
        label,
        sessionType,
        pricePerSessionEur: priceNum,
        packSize: size,
        weeklyFrequency: freq,
        startDate: start,
        color: color as any,
        sessionsUsed,
      },
    });
    setBusy(false);
    if (r?.ok) await onSaved();
    else toast.error(r?.error ?? "error");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("pack.manage") : t("pack.new")}</DialogTitle>
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
          <div>
            <Label>{t("pack.label")}</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("pack.session_type")}</Label>
              <Select value={sessionType} onValueChange={(v) => setSessionType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">{t("form.in_person")}</SelectItem>
                  <SelectItem value="online">{t("form.online")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("pack.price")}</Label>
              <Input
                ref={priceRef}
                type="number"
                min={0}
                step="0.5"
                value={price}
                placeholder="—"
                onChange={(e) => setPrice(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">{t("pack.price_required_hint")}</p>
            </div>
            <div>
              <Label>{t("pack.size")}</Label>
              <Input type="number" min={1} max={500} value={size} onChange={(e) => setSize(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>{t("pack.sessions_used_label")}</Label>
              <Input
                type="number"
                min={0}
                max={size}
                value={sessionsUsed}
                onChange={(e) => setSessionsUsed(Math.max(0, Math.min(size, parseInt(e.target.value) || 0)))}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {t("pack.remaining_short", { remaining: Math.max(0, size - sessionsUsed), total: size })} · {t("pack.sessions_used_hint")}
              </p>
            </div>
            <div>
              <Label>{t("pack.weekly_frequency")}</Label>
              <Input type="number" min={0} max={14} value={freq} onChange={(e) => setFreq(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>{t("pack.start_date")}</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>{t("pack.color")}</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {PACK_COLORS.map((c) => {
                  const cls = packBlockClasses(c);
                  const active = color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full ${cls.dot} ${active ? "ring-2 ring-offset-2 ring-foreground ring-offset-background" : ""}`}
                      aria-label={c}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("form.cancel")}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("form.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}