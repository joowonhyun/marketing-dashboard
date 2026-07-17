import { fetchCampaigns } from "@/features/campaign/services/api";
import { fetchDailyStats } from "@/features/dashboard/services/api";
import DashboardChartsWrapper from "@/features/dashboard/components/DashboardChartsWrapper";

export default async function ChartsSlot() {
  const [campaigns, dailyStats] = await Promise.all([
    fetchCampaigns(),
    fetchDailyStats(),
  ]);

  return (
    <DashboardChartsWrapper campaigns={campaigns} dailyStats={dailyStats} />
  );
}
