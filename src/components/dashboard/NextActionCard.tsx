import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Cake, Inbox, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientAvatar } from "@/components/ClientAvatar";
import { daysUntilBirthday, turningAge } from "@/lib/birthdays";

type ClientLite = {
  id: string;
  full_name: string;
  photo_url: string | null;
  date_of_birth: string | null;
  intake_status: string;
};

type Props = {
  clients: ClientLite[];
  onInvite: () => void;
};

/**
 * NextActionCard — the single "loud moment" of /dashboard.
 * Deterministic priority: submitted assessment → birthday ≤7d → invite first
 * client → quick plan. One amber under-glow card; nothing else on the page
 * should compete.
 */
export function NextActionCard({ clients, onInvite }: Props) {
  const { t } = useTranslation("common");

  const action = useMemo(() => {
    // 1. Submitted assessment awaiting review.
    const submitted = clients.find((c) => c.intake_status === "submitted");
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
    // 2. Birthday ≤ 7 days.
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
    // 3. No clients yet.
    if (clients.length === 0) {
      return {
        kind: "invite" as const,
        client: null,
        icon: Sparkles,
        title: t("dashboard.next_action.invite_title"),
        sub: t("dashboard.next_action.invite_sub"),
        cta: t("dashboard.next_action.invite_cta"),
        onClick: onInvite,
      };
    }
    // 4. Default: nudge to quick plan.
    return {
      kind: "quick" as const,
      client: null,
      icon: Sparkles,
      title: t("dashboard.next_action.quick_title"),
      sub: t("dashboard.next_action.quick_sub"),
      cta: t("dashboard.next_action.quick_cta"),
      to: "/plans/quick" as const,
    };
  }, [clients, t, onInvite]);

  const Icon = action.icon;

  const inner = (
    <div className="flex items-center gap-4 sm:gap-5">
      {action.client ? (
        <ClientAvatar name={action.client.full_name} photoUrl={action.client.photo_url} size={56} />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-500">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-500/80">
          {t("dashboard.next_action.eyebrow")}
        </p>
        <p className="mt-1 truncate text-base font-medium sm:text-lg">{action.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.sub}</p>
      </div>
      <Button
        size="sm"
        className="shrink-0 bg-amber-500 text-amber-950 hover:bg-amber-400"
      >
        {action.cta}
      </Button>
    </div>
  );

  const wrapClass =
    "block rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.10] via-card to-card p-5 shadow-[0_30px_80px_-50px_rgba(245,158,11,0.55)] transition hover:border-amber-500/50 sm:p-6";

  if ("onClick" in action && action.onClick) {
    return (
      <button type="button" onClick={action.onClick} className={`${wrapClass} w-full text-left`}>
        {inner}
      </button>
    );
  }
  if ("to" in action && action.to === "/plans/quick") {
    return (
      <Link to="/plans/quick" className={wrapClass}>
        {inner}
      </Link>
    );
  }
  if ("to" in action && action.to === "/clients/$clientId" && (action as any).params) {
    return (
      <Link to="/clients/$clientId" params={(action as any).params} className={wrapClass}>
        {inner}
      </Link>
    );
  }
  return <div className={wrapClass}>{inner}</div>;
}