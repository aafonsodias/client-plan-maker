import { Check, ChevronDown, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AI_MODELS, findModel } from "@/lib/ai-models";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (id: string) => void;
  /** Optional remaining credits for the active workspace (display-only). */
  creditsRemaining?: number | null;
  size?: "sm" | "md";
  className?: string;
};

export function ModelPicker({ value, onChange, creditsRemaining, size = "md", className }: Props) {
  const active = findModel(value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-border bg-card/80 text-foreground/90 transition hover:border-accent/50",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            className,
          )}
        >
          <Sparkles className={cn("text-accent", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
          <span className="font-medium">{active.label}</span>
          <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
            {active.credits} cr
          </span>
          {typeof creditsRemaining === "number" && (
            <span className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
              {creditsRemaining} restantes
            </span>
          )}
          <ChevronDown className={cn("text-muted-foreground", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Modelo de IA
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {AI_MODELS.map((m) => {
          const isActive = m.id === value;
          return (
            <DropdownMenuItem
              key={m.id}
              onSelect={() => onChange(m.id)}
              className="flex cursor-pointer items-start gap-2 px-2 py-2"
            >
              <div className="mt-0.5 w-4 shrink-0 text-accent">
                {isActive ? <Check className="h-4 w-4" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{m.label}</span>
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
                    {m.credits} cr
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}