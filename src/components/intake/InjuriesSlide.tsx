import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BodyMap, getZone } from "@/components/BodyMap";
import { findLabel } from "@/lib/injury-labels";
import { InjuryEditor } from "@/components/InjuryEditor";
import {
  intakeAddInjury,
  intakeListInjuries,
  intakeRemoveInjury,
  intakeUpdateInjury,
  type InjuryRow,
} from "@/server/injuries.functions";

/**
 * Round F1 — public intake injury slider page.
 * Self-contained: loads/saves via token-bearing server functions.
 */
export function InjuriesSlide({ token }: { token: string }) {
  const { t } = useTranslation("common");
  const list = useServerFn(intakeListInjuries);
  const add = useServerFn(intakeAddInjury);
  const update = useServerFn(intakeUpdateInjury);
  const remove = useServerFn(intakeRemoveInjury);

  const [view, setView] = useState<"front" | "back">("front");
  const [rows, setRows] = useState<InjuryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ row?: InjuryRow; zoneId: string; view: "front" | "back" } | null>(null);

  useEffect(() => {
    let on = true;
    setLoading(true);
    list({ data: { token } })
      .then((r) => {
        if (on) setRows(r);
      })
      .catch((e) => toast.error(e?.message ?? "Failed to load injuries"))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, [list, token]);

  const selectedZones = useMemo(() => (rows ?? []).map((r) => r.body_zone), [rows]);
  const badges = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows ?? []) map[r.body_zone] = r.severity;
    return map;
  }, [rows]);

  const handleZoneTap = (zoneId: string, v: "front" | "back") => {
    const existing = (rows ?? []).find((r) => r.body_zone === zoneId);
    setEditing({ row: existing, zoneId, view: v });
  };

  return (
    <div className="space-y-5">
      <p className="body-prose text-sm text-muted-foreground">{t("injuries.page_subtitle")}</p>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <BodyMap
          view={view}
          onViewChange={setView}
          selectedZones={selectedZones}
          badges={badges}
          onZoneTap={handleZoneTap}
        />
      )}

      <section className="space-y-2">
        <p className="eyebrow text-[10px] uppercase tracking-widest text-muted-foreground">
          {t("injuries.registered_title")}
        </p>
        {(rows?.length ?? 0) === 0 ? (
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("injuries.empty_state")}</p>
            <p className="text-xs text-muted-foreground">{t("injuries.empty_hint")}</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rows!.map((r) => {
              const zone = getZone(r.body_zone);
              const lbl = findLabel(r.injury_label);
              return (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-3 rounded-lg bg-card/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {zone ? t(zone.label_key) : r.body_zone}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                      · {t("injuries.severity_label").toLowerCase()} {r.severity}/5
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lbl ? t(lbl.name_key) : t("injuries.no_label")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing({ row: r, zoneId: r.body_zone, view: r.body_view })}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                      aria-label={t("injuries.edit_cta")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(t("injuries.remove_confirm_body"))) return;
                        try {
                          await remove({ data: { token, injuryId: r.id } });
                          setRows((cur) => (cur ?? []).filter((x) => x.id !== r.id));
                        } catch (e: any) {
                          toast.error(e?.message ?? "Failed");
                        }
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                      aria-label={t("injuries.remove_cta")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2 border-t border-border/40 pt-4">
        <p className="text-xs text-muted-foreground">{t("injuries.medical_doc_question")}</p>
        <Button type="button" variant="outline" size="sm" disabled title={t("injuries.medical_doc_disabled_tooltip")}>
          {t("injuries.medical_doc_cta")}
        </Button>
      </section>

      {editing ? (
        <InjuryEditor
          zoneId={editing.zoneId}
          row={editing.row}
          onCancel={() => setEditing(null)}
          onSave={async (payload) => {
            const saved = editing.row
              ? await update({
                  data: {
                    token,
                    injuryId: editing.row.id,
                    severity: payload.severity,
                    injuryLabel: payload.injuryLabel,
                    note: payload.note,
                  },
                })
              : await add({
                  data: {
                    token,
                    bodyZone: editing.zoneId,
                    bodyView: editing.view,
                    severity: payload.severity,
                    injuryLabel: payload.injuryLabel,
                    note: payload.note,
                    source: "self_reported",
                  },
                });
            setRows((cur) => {
              const list = cur ?? [];
              const idx = list.findIndex((r) => r.id === saved.id);
              if (idx >= 0) {
                const next = list.slice();
                next[idx] = saved;
                return next;
              }
              return [...list, saved];
            });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}