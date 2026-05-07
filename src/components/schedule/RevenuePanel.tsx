import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PriceTag } from "@/components/PriceTag";
import { AlertCircle, CalendarCheck, Coins, Eye, EyeOff, Hourglass } from "lucide-react";

type Props = {
  expectedIncomeEur: number;
  sessionsThisWeek: number;
  sessionsRemaining: number;
  packsEndingSoon: number;
};

export function RevenuePanel({
  expectedIncomeEur,
  sessionsThisWeek,
  sessionsRemaining,
  packsEndingSoon,
}: Props) {
  const { t } = useTranslation("schedule");
  const { t: tc } = useTranslation("common");
  const [reveal, setReveal] = useState<boolean>(false);
  useEffect(() => {
    try {
      setReveal(localStorage.getItem("schedule:revealRevenue") === "1");
    } catch {}
  }, []);
  const toggle = () => {
    setReveal((v) => {
      const n = !v;
      try { localStorage.setItem("schedule:revealRevenue", n ? "1" : "0"); } catch {}
      return n;
    });
  };
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat
        icon={<Coins className="h-4 w-4" />}
        label={t("panel.expected_income")}
        action={
          <button
            type="button"
            onClick={toggle}
            aria-label={reveal ? t("revenue.hide") : t("revenue.show")}
            title={reveal ? t("revenue.hide") : t("revenue.show")}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            {reveal ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        }
        value={
          <div>
            {!reveal ? (
              <span className="font-mono text-base tracking-widest text-muted-foreground">•••€</span>
            ) : expectedIncomeEur > 0 || sessionsThisWeek === 0 ? (
              <>
                <PriceTag eur={expectedIncomeEur} interactive={false} />
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {tc("dashboard.revenue_caption")}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                {t("panel.expected_income_unavailable")}
              </p>
            )}
          </div>
        }
      />
      <Stat
        icon={<CalendarCheck className="h-4 w-4" />}
        label={t("panel.sessions_this_week")}
        value={<span className="font-mono text-base">{sessionsThisWeek}</span>}
      />
      <Stat
        icon={<Hourglass className="h-4 w-4" />}
        label={t("panel.sessions_remaining")}
        value={<span className="font-mono text-base">{sessionsRemaining}</span>}
      />
      <Stat
        icon={<AlertCircle className="h-4 w-4" />}
        label={t("panel.ending_soon")}
        value={
          packsEndingSoon > 0 ? (
            <span className="font-mono text-base text-amber-600 dark:text-amber-400">
              {packsEndingSoon}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("panel.no_alerts")}</span>
          )
        }
      />
    </div>
  );
}

function Stat({ icon, label, value, action }: { icon: React.ReactNode; label: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        <span className="truncate flex-1">{label}</span>
        {action}
      </div>
      <div className="mt-1.5 text-foreground">{value}</div>
    </div>
  );
}