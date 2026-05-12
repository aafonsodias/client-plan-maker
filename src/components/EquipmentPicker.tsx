import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  EQUIPMENT_CATALOG,
  CATEGORY_LABEL_PT,
  CATEGORY_LABEL_EN,
  type EquipmentCategory,
  searchEquipment,
} from "@/lib/equipment-catalog";

export const EQUIPMENT_CAT_TONE: Record<
  EquipmentCategory,
  { off: string; on: string; dot: string }
> = {
  free_weights:         { off: "border-amber-500/40 text-amber-200/90",   on: "bg-amber-500/20 border-amber-400 text-amber-100",     dot: "bg-amber-400" },
  machines:             { off: "border-sky-500/40 text-sky-200/90",       on: "bg-sky-500/20 border-sky-400 text-sky-100",           dot: "bg-sky-400" },
  racks_benches:        { off: "border-violet-500/40 text-violet-200/90", on: "bg-violet-500/20 border-violet-400 text-violet-100",  dot: "bg-violet-400" },
  bodyweight_accessory: { off: "border-emerald-500/40 text-emerald-200/90", on: "bg-emerald-500/20 border-emerald-400 text-emerald-100", dot: "bg-emerald-400" },
  conditioning:         { off: "border-rose-500/40 text-rose-200/90",     on: "bg-rose-500/20 border-rose-400 text-rose-100",        dot: "bg-rose-400" },
  mobility:             { off: "border-teal-500/40 text-teal-200/90",     on: "bg-teal-500/20 border-teal-400 text-teal-100",        dot: "bg-teal-400" },
  misc:                 { off: "border-border text-muted-foreground",     on: "bg-secondary border-foreground/40 text-foreground",   dot: "bg-muted-foreground" },
};

const CATS: EquipmentCategory[] = [
  "free_weights",
  "machines",
  "racks_benches",
  "bodyweight_accessory",
  "conditioning",
  "mobility",
  "misc",
];

export function EquipmentPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { i18n, t } = useTranslation("intake");
  const locale = (i18n.language || "pt").startsWith("en") ? "en" : "pt";
  const [q, setQ] = useState("");
  const filtered = q.trim() ? searchEquipment(q) : EQUIPMENT_CATALOG;
  const labelFor = (cat: EquipmentCategory) =>
    locale === "en" ? CATEGORY_LABEL_EN[cat] : CATEGORY_LABEL_PT[cat];
  const toggle = (canonical: string) => {
    onChange(
      value.includes(canonical)
        ? value.filter((x) => x !== canonical)
        : [...value, canonical],
    );
  };
  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("equipment_search", { defaultValue: "Procurar equipamento…" })}
        className="h-9"
      />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        {CATS.map((cat) => (
          <span key={cat} className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${EQUIPMENT_CAT_TONE[cat].dot}`} />
            {labelFor(cat)}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filtered.map((it) => {
          const on = value.includes(it.en);
          const tone = EQUIPMENT_CAT_TONE[it.category];
          const label = locale === "en" ? it.en : it.pt;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => toggle(it.en)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? tone.on : `bg-transparent ${tone.off} hover:bg-card`}`}
            >
              {label}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {locale === "pt" ? "Sem resultados." : "No results."}
          </p>
        )}
      </div>
    </div>
  );
}
