import { Campaign, DailyStat } from "@/shared/types";
import DailyTrendChart from "./DailyTrendChart";
import PlatformDonutChart from "./PlatformDonutChart";
import Top3RankingChart from "./Top3RankingChart";

interface Props {
  campaigns: Campaign[];
  dailyStats: DailyStat[];
}

export default function DashboardChartsWrapper({
  campaigns: allCampaigns,
  dailyStats: allStats,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm text-slate-900 dark:text-slate-100">
        <DailyTrendChart allCampaigns={allCampaigns} allDailyStats={allStats} />
      </div>
      <div className="flex flex-col gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm h-full max-h-[300px] text-slate-900 dark:text-slate-100">
          <PlatformDonutChart
            allCampaigns={allCampaigns}
            allDailyStats={allStats}
          />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm h-full max-h-[300px] text-slate-900 dark:text-slate-100">
          <Top3RankingChart
            allCampaigns={allCampaigns}
            allDailyStats={allStats}
          />
        </div>
      </div>
    </div>
  );
}
