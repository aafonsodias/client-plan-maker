import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  EQUIPMENT_CATALOG,
  CATEGORY_LABEL_PT,
  CATEGORY_LABEL_EN,
  searchEquipment,
  findEquipment,
  type EquipmentCategory,
  type EquipmentItem,
} from "@/lib/equipment-catalog";

type Props = {
  /** Selected EN canonical labels (back-compat with DB rows). */
  value: string[];
  onChange: (next: string[]) => void;
  locale?: "pt" | "en";
  placeholder?: string;
  className?: string;
};

/**
 * Searchable multi-select for equipment. Backed by EQUIPMENT_CATALOG.
 * Persists EN canonical labels for backward compatibility with DB.
 */
export function EquipmentMultiSelect({
  value,
  onChange,
  locale = "pt",
  placeholder,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const items = searchEquipment(query);
    const map = new Map<EquipmentCategory, EquipmentItem[]>();
    for (const i of items) {
      const arr = map.get(i.category) ?? [];
      arr.push(i);
      map.set(i.category, arr);
    }
    return Array.from(map.entries());
  }, [query]);

  const labels = locale === "pt" ? CATEGORY_LABEL_PT : CATEGORY_LABEL_EN;

  function toggle(item: EquipmentItem) {
    const has = value.includes(item.en);
    onChange(has ? value.filter((v) => v !== item.en) : [...value, item.en]);
  }

  function remove(en: string) {
    onChange(value.filter((v) => v !== en));
  }

  return (
    <div className={className}>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((v) => {
            const item = findEquipment(v);
            const label = item ? (locale === "pt" ? item.pt : item.en) : v;
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
              >
                {label}
                <button
                  type="button"
                  onClick={() => remove(v)}
                  className="rounded-full p-0.5 hover:bg-primary/20"
                  aria-label={`Remove ${label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground transition hover:bg-secondary"
          >
            <span>{placeholder ?? (locale === "pt" ? "Pesquisar equipamento…" : "Search equipment…")}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={locale === "pt" ? "Pesquisar…" : "Search…"}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-72">
              <CommandEmpty>{locale === "pt" ? "Sem resultados." : "No results."}</CommandEmpty>
              {grouped.map(([cat, items]) => (
                <CommandGroup key={cat} heading={labels[cat]}>
                  {items.map((item) => {
                    const selected = value.includes(item.en);
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => toggle(item)}
                        className="flex items-center justify-between gap-2"
                      >
                        <span>{locale === "pt" ? item.pt : item.en}</span>
                        {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Convenience: total count of catalog items, for "Pick from N items" labels. */
export const EQUIPMENT_COUNT = EQUIPMENT_CATALOG.length;