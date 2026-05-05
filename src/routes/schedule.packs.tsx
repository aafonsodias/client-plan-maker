import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Archive, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listPacks, upsertPack, archivePack } from "@/server/schedule.functions";
import { type Pack, PACK_COLORS, packStatus, packBlockClasses } from "@/lib/schedule";
import { toneChip } from "@/lib/status-tone";
import { PriceTag } from "@/components/PriceTag";
import { ClientAvatar } from "@/components/ClientAvatar";

export const Route = createFileRoute("/schedule/packs")({
  beforeLoad: () => {
    throw redirect({ to: "/schedule", search: { tab: "packs" } });
  },
});

type ClientLite = { id: string; full_name: string; photo_url: string | null };

export function PacksPanel() {
  const { t } = useTranslation("schedule");
  const { user } = useAuth();
  const list = useServerFn(listPacks);
  const arch = useServerFn(archivePack);

  const [packs, setPacks] = useState<Pack[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [editing, setEditing] = useState<Pack | null>(null);
  const [creating, setCreating] = useState(false);

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

  const clientById = useMemo(() => {
    const m = new Map<string, ClientLite>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/schedule" className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("back_to_schedule")}
          </Link>
          <h1 className="text-xl font-light tracking-wide sm:text-2xl">{t("pack.title")}</h1>
        </div>
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
        <ul className="space-y-2">
          {packs.map((p) => {
            const c = clientById.get(p.client_id);
            const st = packStatus(p);
            const left = Math.max(0, p.pack_size - p.sessions_used);
            const cls = packBlockClasses(p.color);
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className={`inline-block h-3 w-3 rounded-full ${cls.dot}`} />
                <ClientAvatar name={c?.full_name ?? ""} photoUrl={c?.photo_url ?? null} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{c?.full_name ?? "—"}</span>
                    <span className="truncate text-xs text-muted-foreground">{p.label}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{t("pack.sessions_left", { left, total: p.pack_size })}</span>
                    <span>·</span>
                    <PriceTag eur={Number(p.price_per_session_eur)} interactive={false} />
                    <span>·</span>
                    <span>{p.session_type === "in_person" ? t("form.in_person") : t("form.online")}</span>
                    {p.archived && <span className="ml-2 italic">{t("pack.archive")}</span>}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${toneChip(st.tone)}`}>
                  {t(`pack.status_${st.key}`)}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title={p.archived ? t("pack.unarchive") : t("pack.archive")}
                  onClick={async () => {
                    const r: any = await arch({ data: { id: p.id, archived: !p.archived } });
                    if (r?.ok) await refresh();
                  }}
                >
                  {p.archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                </Button>
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
  const [label, setLabel] = useState(editing?.label ?? "Pack 10");
  const [sessionType, setSessionType] = useState<"in_person" | "online">(editing?.session_type ?? "in_person");
  const [price, setPrice] = useState<number>(Number(editing?.price_per_session_eur ?? 30));
  const [size, setSize] = useState<number>(editing?.pack_size ?? 10);
  const [freq, setFreq] = useState<number>(editing?.weekly_frequency ?? 2);
  const [start, setStart] = useState<string>(editing?.start_date ?? new Date().toISOString().slice(0, 10));
  const [color, setColor] = useState<string>(editing?.color ?? "emerald");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId(editing?.client_id ?? "");
    setLabel(editing?.label ?? "Pack 10");
    setSessionType(editing?.session_type ?? "in_person");
    setPrice(Number(editing?.price_per_session_eur ?? 30));
    setSize(editing?.pack_size ?? 10);
    setFreq(editing?.weekly_frequency ?? 2);
    setStart(editing?.start_date ?? new Date().toISOString().slice(0, 10));
    setColor(editing?.color ?? "emerald");
  }, [open, editing]);

  const submit = async () => {
    if (!clientId) return toast.error(t("form.select_client"));
    setBusy(true);
    const r: any = await save({
      data: {
        id: editing?.id,
        clientId,
        label,
        sessionType,
        pricePerSessionEur: price,
        packSize: size,
        weeklyFrequency: freq,
        startDate: start,
        color: color as any,
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
          <DialogTitle>{editing ? t("form.save") : t("pack.new")}</DialogTitle>
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
              <Input type="number" min={0} step="0.5" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>{t("pack.size")}</Label>
              <Input type="number" min={1} max={500} value={size} onChange={(e) => setSize(parseInt(e.target.value) || 1)} />
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