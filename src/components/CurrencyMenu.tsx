import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useState } from "react";

type Props = {
  children: ReactNode;
  align?: "start" | "center" | "end";
};

/**
 * Wraps any trigger element. Left-click opens a small popover with currency
 * choices; right-click opens the same popover (per-request "power-user"
 * affordance) instead of the browser context menu.
 */
export function CurrencyMenu({ children, align = "end" }: Props) {
  const { t } = useTranslation("common");
  const { code, setCode } = useCurrency();
  const [open, setOpen] = useState(false);

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span onContextMenu={onContext} className="inline-flex">{children}</span>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-56 p-2">
        <p className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          {t("currency.title", "Currency")}
        </p>
        <div className="flex flex-col">
          {CURRENCIES.map((c) => {
            const active = c.code === code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => { setCode(c.code as CurrencyCode); setOpen(false); }}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition",
                  active ? "bg-accent/10 text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="w-4 text-center">{c.symbol}</span>
                  <span>{c.label}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            );
          })}
        </div>
        <p className="mt-2 border-t border-border/60 px-2 pt-2 text-[10px] text-muted-foreground">
          {t("currency.billed_in_eur_note", "Billed in EUR. Other currencies shown for reference.")}
        </p>
      </PopoverContent>
    </Popover>
  );
}