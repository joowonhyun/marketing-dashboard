import { Campaign, DailyStat } from "@/shared/types";
import CampaignTable from "./CampaignTable";

interface Props {
  campaigns: Campaign[];
  dailyStats: DailyStat[];
}

export default function CampaignTableWrapper({
  campaigns: allCampaigns,
  dailyStats: allDailyStats,
}: Props) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 text-slate-900 dark:text-slate-100 mt-8">
      <CampaignTable
        allCampaigns={allCampaigns}
        allDailyStats={allDailyStats}
      />
    </div>
  );
}
