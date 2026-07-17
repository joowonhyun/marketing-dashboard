import { Campaign } from "@/shared/types";
import { serverFetch, actionFetch } from "@/shared/utils/api-client";

export const fetchCampaigns = async (): Promise<Campaign[]> => {
  return serverFetch<Campaign[]>("/campaigns");
};

export const updateCampaignStatus = async (
  id: string,
  status: string,
): Promise<void> => {
  await actionFetch(`/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
};

export const createCampaign = async (
  campaign: Omit<Campaign, "id">,
): Promise<Campaign> => {
  return actionFetch<Campaign>("/campaigns", {
    method: "POST",
    body: JSON.stringify(campaign),
  });
};

export const deleteCampaign = async (id: string): Promise<void> => {
  await actionFetch(`/campaigns/${id}`, { method: "DELETE" });
};
