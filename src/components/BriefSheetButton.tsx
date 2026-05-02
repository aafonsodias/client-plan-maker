import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BriefContextRail } from "@/components/BriefContextRail";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BriefSchema } from "@/server/phased/schemas";
import { InfoHint } from "@/components/InfoHint";
import { useTranslation } from "react-i18next";

/**
 * A header button that opens a right-side Sheet with the BriefContextRail.
 * Always visible — used at every viewport so the brief context is reachable
 * even when the desktop sticky rail is hidden.
 */
export function BriefSheetButton({ planId }: { planId: string }) {
  const [redFlagCount, setRedFlagCount] = useState(0);
  const { i18n } = useTranslation("plan");
  const isPt = i18n.language?.startsWith("pt");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("workout_plans")
        .select("brief")
        .eq("id", planId)
        .maybeSingle();
      if (cancelled || !data) return;
      const parsed = BriefSchema.safeParse((data as any).brief);
      if (parsed.success) setRedFlagCount(parsed.data.red_flags.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted xl:hidden"
          aria-label={
            redFlagCount > 0
              ? isPt
                ? `Brief — ${redFlagCount} sinais de alerta`
                : `Brief — ${redFlagCount} red flags`
              : isPt
              ? "Abrir contexto do Brief"
              : "Open brief context"
          }
        >
          <BookOpen className="h-3.5 w-3.5" />
          Brief
          {redFlagCount > 0 && (
            <>
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15 px-1 text-[10px] font-bold text-amber-300">
                {redFlagCount}
              </span>
              <span onClick={(e) => e.stopPropagation()} className="-ml-0.5">
                <InfoHint tone="warn" side="bottom" label={isPt ? "O que é este número?" : "What is this number?"}>
                  {isPt
                    ? "Sinais de alerta detetados no teu brief — toca em \"Brief\" para os rever."
                    : "Red flags found in your brief — tap \"Brief\" to review them."}
                </InfoHint>
              </span>
            </>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Brief — contexto do meso</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <BriefContextRail planId={planId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}