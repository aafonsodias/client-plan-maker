import { useState } from "react";
import PlanEditorSurface from "@/components/PlanEditorSurface";
import { PlanCommandDeck, type DeckMode } from "@/components/PlanCommandDeck";

/**
 * Bridges the new mobile-first PlanCommandDeck with the existing
 * PlanEditorSurface. Owns selectedWeek + mode so both stay in sync.
 */
export function PlanWithDeck({
  plan,
  currentWeek,
  onRegister,
  registerBusy,
  onAssessmentPdf,
}: {
  plan: {
    id: string;
    title: string;
    duration_weeks?: number | null;
    block_number?: number | null;
  };
  currentWeek?: number | null;
  onRegister?: () => void | Promise<void>;
  registerBusy?: boolean;
  onAssessmentPdf?: () => void | Promise<void>;
}) {
  const totalWeeks = Math.max(1, plan.duration_weeks ?? 1);
  const initialWeek = Math.min(totalWeeks, currentWeek ?? 1);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(initialWeek);
  const [mode, setMode] = useState<DeckMode>("view");

  return (
    <div className="space-y-3">
      <PlanCommandDeck
        plan={plan}
        selectedWeek={selectedWeek}
        onSelectWeek={setSelectedWeek}
        currentWeek={currentWeek ?? undefined}
        mode={mode}
        onModeChange={setMode}
        registerLabel="Registar treino"
        onRegister={onRegister}
        registerBusy={registerBusy}
        onAssessmentPdf={onAssessmentPdf}
      />
      <PlanEditorSurface
        planId={plan.id}
        embedded
        mode={mode}
        onModeChange={setMode}
        selectedWeek={selectedWeek}
        hideOwnChrome
      />
    </div>
  );
}
