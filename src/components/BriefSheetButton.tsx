import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BriefContextRail } from "@/components/BriefContextRail";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BriefSchema } from "@/server/phased/schemas";

/**
 * A header button that opens a right-side Sheet with the BriefContextRail.
 * Always visible — used at every viewport so the brief context is reachable
 * even when the desktop sticky rail is hidden.
 */
export function BriefSheetButton({ planId }: { planId: string }) {
  const [redFlagCount, setRedFlagCount] = useState(0);

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
          aria-label="Abrir contexto do Brief"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Brief
          {redFlagCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/90 px-1 text-[10px] font-bold text-white">
              {redFlagCount}
            </span>
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