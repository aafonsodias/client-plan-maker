import { useTranslation } from "react-i18next";
import { PriceTag } from "@/components/PriceTag";
import { AlertCircle, CalendarCheck, Coins, Hourglass } from "lucide-react";

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
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat
        icon={<Coins className="h-4 w-4" />}
        label={t("panel.expected_income")}
        value={<PriceTag eur={expectedIncomeEur} interactive={false} />}
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 text-foreground">{value}</div>
    </div>
  );
}