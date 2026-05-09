import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Cake, Inbox, ClipboardList, Sparkles, UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientAvatar } from "@/components/ClientAvatar";
import { daysUntilBirthday, turningAge } from "@/lib/birthdays";

type ClientLite = {
  id: string;
  full_name: string;
  photo_url: string | null;
  date_of_birth: string | null;
  intake_status: string;
  assessment_completion: number;
  has_plan: boolean;
};

type Props = {
  clients: ClientLite[];
  onInvite?: () => void;
};

/**
 * NextActionCard — compact "next thing to do" strip on /dashboard.
 * Always renders. Priority order, first match wins:
 *  1. Submitted (100%) → review
 *  2. Assessment incomplete (<100%) → finish missions FIRST
 *  3. 100% complete + no plan → generate plan
 *  4. Birthday ≤ 7 days
 *  5. Empty (no clients) → invite, otherwise idle "all caught up"
 * NEVER suggests generating a plan with assessment_completion < 100.
 */
export function NextActionCard({ clients, onInvite }: Props) {
  const { t } = useTranslation("common");

  const action = useMemo(() => {
    // 1. Submitted, fully complete → review.
    const submitted = clients.find(
      (c) => c.intake_status === "submitted" && (c.assessment_completion ?? 0) >= 100,
    );
    if (submitted) {
      return {
        kind: "review" as const,
        client: submitted,
        icon: Inbox,
        title: t("dashboard.next_action.review_title", { name: submitted.full_name }),
        sub: t("dashboard.next_action.review_sub"),
        cta: t("dashboard.next_action.review_cta"),
        to: "/clients/$clientId" as const,
        params: { clientId: submitted.id },
      };
    }
    // 2. Incomplete assessment — pick the closest-to-finished one.
    const incomplete = clients
      .filter((c) => {
        const pct = c.assessment_completion ?? 0;
        return pct < 100 && c.intake_status !== "not_sent";
      })
      .sort((a, b) => (b.assessment_completion ?? 0) - (a.assessment_completion ?? 0));
    if (incomplete[0]) {
      const c = incomplete[0];
      const pct = c.assessment_completion ?? 0;
      return {
        kind: "complete" as const,
        client: c,
        icon: ClipboardList,
        title: t("dashboard.next_action.complete_title", { name: c.full_name }),
        sub: t("dashboard.next_action.complete_sub", { pct }),
        cta: t("dashboard.next_action.complete_cta"),
        to: "/clients/$clientId" as const,
        params: { clientId: c.id },
      };
    }
    // 3. 100% complete + no plan → generate.
    const ready = clients.find(
      (c) => (c.assessment_completion ?? 0) >= 100 && !c.has_plan,
    );
    if (ready) {
      return {
        kind: "generate" as const,
        client: ready,
        icon: Sparkles,
        title: t("dashboard.next_action.generate_title", { name: ready.full_name }),
        sub: t("dashboard.next_action.generate_sub"),
        cta: t("dashboard.next_action.generate_cta"),
        to: "/plans/new" as const,
        search: { clientId: ready.id },
      };
    }
    // 4. Birthday ≤ 7 days.
    const withBday = clients
      .map((c) => ({ c, d: daysUntilBirthday(c.date_of_birth) }))
      .filter((x) => x.d !== null && (x.d as number) <= 7)
      .sort((a, b) => (a.d as number) - (b.d as number));
    if (withBday[0]) {
      const { c, d } = withBday[0];
      const age = turningAge(c.date_of_birth);
      return {
        kind: "birthday" as const,
        client: c,
        icon: Cake,
        title:
          d === 0
            ? t("dashboard.next_action.bday_today", { name: c.full_name, age: age ?? "" })
            : d === 1
              ? t("dashboard.next_action.bday_tomorrow", { name: c.full_name, age: age ?? "" })
              : t("dashboard.next_action.bday_in", { name: c.full_name, n: d as number }),
        sub: t("dashboard.next_action.bday_sub"),
        cta: t("dashboard.next_action.bday_cta"),
        to: "/clients/$clientId" as const,
        params: { clientId: c.id },
      };
    }
    // 5. Empty / idle.
    if (clients.length === 0) {
      return {
        kind: "invite" as const,
        client: null,
        icon: UserPlus,
        title: t("dashboard.next_action.empty_invite_title"),
        sub: t("dashboard.next_action.empty_invite_sub"),
        cta: t("dashboard.next_action.empty_invite_cta"),
        onClick: onInvite,
      };
    }
    return {
      kind: "idle" as const,
      client: null,
      icon: Check,
      title: t("dashboard.next_action.idle_title"),
      sub:
        clients.length === 1
          ? t("dashboard.next_action.idle_sub_one", { n: clients.length })
          : t("dashboard.next_action.idle_sub_other", { n: clients.length }),
      cta: null,
    };
  }, [clients, t, onInvite]);

  const Icon = action.icon;
  const isIdle = action.kind === "idle";
  const tone = isIdle ? "emerald" : "amber";

  const inner = (
    <div className="flex items-center gap-4">
      <span
        aria-hidden
        className={`h-10 w-px shrink-0 ${isIdle ? "bg-emerald-500/40" : "bg-amber-500/70"}`}
      />
      {action.client ? (
        <ClientAvatar name={action.client.full_name} photoUrl={action.client.photo_url} size={36} />
      ) : (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isIdle ? "text-emerald-500" : "text-amber-500"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <p
          className={`text-[10px] uppercase tracking-[0.18em] ${
            isIdle ? "text-emerald-600/80 dark:text-emerald-500/80" : "text-amber-600/80 dark:text-amber-500/80"
          }`}
        >
          {isIdle ? action.title : t("dashboard.next_action.eyebrow")}
        </p>
        {!isIdle && (
          <p className="mt-0.5 truncate font-display text-lg font-light tracking-tight text-foreground">
            {action.title}
          </p>
        )}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.sub}</p>
      </div>
      {action.cta ? (
        <Button
          size="sm"
          variant={isIdle ? "ghost" : "ghost"}
          className={
            isIdle
              ? "shrink-0"
              : "shrink-0 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          }
        >
          {action.cta} →
        </Button>
      ) : null}
    </div>
  );

  const wrapBase = "block py-2 transition";
  const wrapClass = isIdle
    ? `${wrapBase} opacity-90`
    : `${wrapBase} hover:opacity-90`;

  if ("to" in action && action.to === "/clients/$clientId") {
    return (
      <Link to="/clients/$clientId" params={(action as any).params} className={wrapClass}>
        {inner}
      </Link>
    );
  }
  if ("to" in action && action.to === "/plans/new") {
    return (
      <Link to="/plans/new" search={(action as any).search} className={wrapClass}>
        {inner}
      </Link>
    );
  }
  if ("onClick" in action && action.onClick) {
    return (
      <button type="button" onClick={action.onClick} className={`${wrapClass} w-full text-left`}>
        {inner}
      </button>
    );
  }
  return <div className={wrapClass}>{inner}</div>;
}
