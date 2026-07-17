import { DailyStat } from "@/shared/types";
import { serverFetch } from "@/shared/utils/api-client";

export const fetchDailyStats = async (): Promise<DailyStat[]> => {
  return serverFetch<DailyStat[]>("/daily-stats");
};
