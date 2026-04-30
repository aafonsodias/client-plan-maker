import { useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number };

export function AutoTextarea({ className, minRows = 1, value, onChange, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  useEffect(resize, [value]);
  useEffect(() => {
    resize();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      className={cn(
        "flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}