import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listClientCadences,
  upsertClientCadence,
} from "@/server/capacity.functions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RotateCcw } from "lucide-react";

type Row = {
  domain_slug: string;
  name_key: string;
  tier: string;
  default_days: number;
  override_days: number | null;
  effective_days: number;
};

/**
 * Per-client per-domain re-measurement cadence override sheet.
 * Reads listClientCadences, lets the trainer set or reset each domain.
 * On save, only changed rows are upserted (or cleared, if reverted to default).
 */
export function CadenceSheet({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: string;
  clientName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("common");
  const fetchRows = useServerFn(listClientCadences);
  const upsert = useServerFn(upsertClientCadence);

  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchRows({ data: { clientId } });
        if (cancelled) return;
        const initial = res.rows ?? [];
        setRows(initial);
        const d: Record<string, string> = {};
        for (const r of initial) d[r.domain_slug] = String(r.effective_days);
        setDraft(d);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clientId, fetchRows]);

  const setVal = (slug: string, v: string) =>
    setDraft((prev) => ({ ...prev, [slug]: v }));

  const resetRow = (r: Row) =>
    setDraft((prev) => ({ ...prev, [r.domain_slug]: String(r.default_days) }));

  const onSave = async () => {
    setSaving(true);
    try {
      const ops: Promise<unknown>[] = [];
      for (const r of rows) {
        const raw = draft[r.domain_slug] ?? "";
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 7 || n > 90) continue;
        // If matches default → clear override (only if there was one)
        if (n === r.default_days) {
          if (r.override_days !== null) {
            ops.push(
              upsert({
                data: { clientId, domainSlug: r.domain_slug, intervalDays: null },
              }),
            );
          }
          continue;
        }
        if (n !== r.effective_days) {
          ops.push(
            upsert({
              data: { clientId, domainSlug: r.domain_slug, intervalDays: n },
            }),
          );
        }
      }
      await Promise.all(ops);
      toast.success(t("cadence.toast_saved"));
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>{t("cadence.sheet_title")}</SheetTitle>
          {clientName && <SheetDescription>{clientName}</SheetDescription>}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("actions.loading")}
              </div>
            ) : (
              rows.map((r) => {
                const val = draft[r.domain_slug] ?? "";
                const isDefault = Number(val) === r.default_days;
                return (
                  <div
                    key={r.domain_slug}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {t(r.name_key, { defaultValue: r.domain_slug })}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t("cadence.default_label", { days: r.default_days })}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={7}
                      max={90}
                      step={1}
                      value={val}
                      onChange={(e) => setVal(r.domain_slug, e.target.value)}
                      className="h-8 w-20 text-right tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => resetRow(r)}
                      disabled={isDefault}
                      title={t("cadence.reset_default")}
                      aria-label={t("cadence.reset_default")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <SheetFooter className="border-t border-border bg-background/95 px-5 py-3 backdrop-blur sm:flex-row sm:justify-end sm:space-x-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t("cadence.cancel")}
            </Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={loading || saving}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("cadence.save")}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}