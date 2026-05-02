import { useCurrency } from "@/contexts/CurrencyContext";
import { formatPrice } from "@/lib/currency";
import { CurrencyMenu } from "@/components/CurrencyMenu";
import { cn } from "@/lib/utils";

type Props = {
  /** Source-of-truth price in EUR. */
  eur: number;
  className?: string;
  /** When true, clicking the tag opens the currency switcher. */
  interactive?: boolean;
};

export function PriceTag({ eur, className, interactive = true }: Props) {
  const { code, rates } = useCurrency();
  const text = formatPrice(eur, code, rates);

  if (!interactive) {
    return <span className={className}>{text}</span>;
  }

  return (
    <CurrencyMenu>
      <button
        type="button"
        title="Change currency"
        className={cn(
          "cursor-pointer rounded-sm transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          className,
        )}
      >
        {text}
      </button>
    </CurrencyMenu>
  );
}