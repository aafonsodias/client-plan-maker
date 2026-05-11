import { useState } from "react";
import PlanEditorSurface from "@/components/PlanEditorSurface";
import { PlanCommandDeck, type DeckMode } from "@/components/PlanCommandDeck";

export function PlanWithDeck({
  plan,
  currentWeek,
  primaryAction,
  onAssessmentPdf,
}: {
  plan: {
    id: string;
    title: string;
    duration_weeks?: number | null;
    block_number?: number | null;
  };
  currentWeek?: number | null;
  primaryAction?: {
    label: string;
    onClick?: () => void | Promise<void>;
    busy?: boolean;
  };
  onAssessmentPdf?: () => void | Promise<void>;
}) {
  const totalWeeks = Math.max(1, plan.duration_weeks ?? 1);
  const initialWeek = Math.min(totalWeeks, currentWeek ?? 1);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(initialWeek);
  const [mode, setMode] = useState<DeckMode>("view");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <PlanCommandDeck
        plan={plan}
        selectedWeek={selectedWeek}
        onSelectWeek={setSelectedWeek}
        currentWeek={currentWeek ?? undefined}
        mode={mode}
        onModeChange={setMode}
        registerLabel={primaryAction?.label ?? "Registar treino"}
        onRegister={primaryAction?.onClick}
        registerBusy={primaryAction?.busy}
        onAssessmentPdf={onAssessmentPdf}
      />
      <div className="px-2.5 pb-3 pt-2 sm:px-3">
        <PlanEditorSurface
          planId={plan.id}
          embedded
          mode={mode}
          onModeChange={setMode}
          selectedWeek={selectedWeek}
          hideOwnChrome
        />
      </div>
    </div>
  );
}
