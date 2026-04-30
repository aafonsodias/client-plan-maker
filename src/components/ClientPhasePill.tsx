import { ClientPhase, phasePillClasses } from "@/lib/client-phase";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ClientPhasePill({ phase, size = "sm" }: { phase: ClientPhase; size?: "sm" | "md" }) {
  const cls = phasePillClasses(phase.kind);
  const sized = size === "md" ? cls.replace("text-[10px]", "text-[11px]").replace("px-3", "px-3.5 py-1") : cls;

  const dot =
    phase.kind === "active" ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> :
    phase.kind === "idle" ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> :
    null;

  const content = (
    <span className={sized}>
      {dot}
      {phase.label}
    </span>
  );

  if (phase.kind === "idle") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild><span>{content}</span></TooltipTrigger>
          <TooltipContent>No session logged in {phase.daysSince}+ days.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (phase.kind === "ended") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild><span>{content}</span></TooltipTrigger>
          <TooltipContent>Ready for next plan.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return content;
}