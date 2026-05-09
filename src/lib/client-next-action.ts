import { daysUntilBirthday } from "@/lib/birthdays";

/**
 * Per-client "next action" inference. Same priority order as the old
 * dashboard-level NextActionCard, but scoped to a single row so the CTA
 * lives inside the client's card on hover, not as a separate strip above.
 *
 * Returns `null` when the client has no actionable next step right now —
 * the card simply shows nothing on hover instead of a synthetic prompt.
 */
export type ClientActionInput = {
  intake_status: string;
  assessment_completion: number | null | undefined;
  date_of_birth: string | null | undefined;
  has_plan: boolean;
};

export type ClientActionKind = "review" | "complete" | "generate" | "birthday";

export type ClientAction = {
  kind: ClientActionKind;
  /** i18n key under common.dashboard.next_action.*_cta */
  ctaKey: string;
  /** Where the CTA navigates. "plan-new" carries clientId in search. */
  target:
    | { type: "client"; clientId: string }
    | { type: "plan-new"; clientId: string };
};

export function clientNextAction(
  client: { id: string } & ClientActionInput,
): ClientAction | null {
  const pct = client.assessment_completion ?? 0;

  // 1. Submitted, fully complete → review.
  if (client.intake_status === "submitted" && pct >= 100) {
    return {
      kind: "review",
      ctaKey: "dashboard.next_action.review_cta",
      target: { type: "client", clientId: client.id },
    };
  }
  // 2. Incomplete assessment → finish missions.
  if (pct < 100 && client.intake_status !== "not_sent") {
    return {
      kind: "complete",
      ctaKey: "dashboard.next_action.complete_cta",
      target: { type: "client", clientId: client.id },
    };
  }
  // 3. 100% complete + no plan → generate.
  if (pct >= 100 && !client.has_plan) {
    return {
      kind: "generate",
      ctaKey: "dashboard.next_action.generate_cta",
      target: { type: "plan-new", clientId: client.id },
    };
  }
  // 4. Birthday ≤ 7 days.
  const d = daysUntilBirthday(client.date_of_birth ?? null);
  if (d !== null && d <= 7) {
    return {
      kind: "birthday",
      ctaKey: "dashboard.next_action.bday_cta",
      target: { type: "client", clientId: client.id },
    };
  }
  return null;
}