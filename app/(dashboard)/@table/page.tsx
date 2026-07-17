import { fetchCampaigns } from "@/features/campaign/services/api";
import { fetchDailyStats } from "@/features/dashboard/services/api";
import CampaignTableWrapper from "@/features/campaign/components/CampaignTableWrapper";

export default async function TableSlot() {
  const [campaigns, dailyStats] = await Promise.all([
    fetchCampaigns(),
    fetchDailyStats(),
  ]);

  return <CampaignTableWrapper campaigns={campaigns} dailyStats={dailyStats} />;
}
