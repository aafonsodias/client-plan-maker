import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getZone } from "@/components/BodyMap";
import { suggestLabelsForZone } from "@/lib/injury-labels";
import type { InjuryRow } from "@/server/injuries.functions";

/**
 * Round F1 — shared severity/label/note form used by both
 * the public intake slider and the trainer-side body map.
 */
export type InjuryEditorPayload = {
  severity: number;
  injuryLabel: string | null;
  note: string | null;
};

export function InjuryEditor({
  zoneId,
  row,
  onCancel,
  onSave,
}: {
  zoneId: string;
  row?: InjuryRow;
  onCancel: () => void;
  onSave: (payload: InjuryEditorPayload) => Promise<void>;
}) {
  const { t } = useTranslation("common");
  const zone = getZone(zoneId);
  const labels = useMemo(() => suggestLabelsForZone(zoneId), [zoneId]);
  const [severity, setSeverity] = useState<number>(row?.severity ?? 3);
  const [label, setLabel] = useState<string | null>(row?.injury_label ?? null);
  const [note, setNote] = useState<string>(row?.note ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ severity, injuryLabel: label, note: note.trim() || null });
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background/70 px-4 backdrop-blur-sm sm:flex sm:items-center sm:justify-center"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="injury-editor-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex w-full max-w-md flex-col rounded-2xl border border-border/60 bg-card shadow-xl"
        style={{ maxHeight: "calc(100dvh - 2rem)" }}
      >
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <header className="space-y-1">
          <p className="eyebrow text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("injuries.page_title")}
          </p>
          <h2 id="injury-editor-title" className="t-3">
            {zone ? t(zone.label_key) : zoneId}
          </h2>
        </header>

        <div>
          <p className="label-caps text-xs text-muted-foreground">{t("injuries.severity_label")}</p>
          <p className="text-[10px] text-muted-foreground">{t("injuries.severity_hint")}</p>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = severity === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeverity(n)}
                  className={`h-10 w-10 rounded-full border text-sm font-medium transition ${
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={on}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="label-caps text-xs text-muted-foreground">{t("injuries.label_label")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {labels.map((l) => {
              const on = label === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLabel(on ? null : l.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    on
                      ? "border-amber-500/60 bg-amber-500/15 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={on}
                >
                  {t(l.name_key)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="label-caps text-xs text-muted-foreground">{t("injuries.notes_label")}</p>
          <Textarea
            rows={2}
            className="mt-2"
            placeholder={t("injuries.notes_placeholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-border/60 bg-card/95 p-3 backdrop-blur">
          <Button type="button" onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : row ? (
              t("injuries.save_changes_cta", { defaultValue: t("injuries.save_cta") })
            ) : (
              t("injuries.save_cta")
            )}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("injuries.cancel_cta")}
          </Button>
        </div>
      </div>
    </div>
  );
}