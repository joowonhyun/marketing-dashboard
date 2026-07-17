import { Platform as PlatformType } from "@/shared/constants/platforms";

export type Platform = PlatformType;
export type CampaignStatus = "active" | "paused" | "ended";

export interface Campaign {
  id: string;
  name: string | null;
  status: CampaignStatus;
  platform: Platform;
  budget: number | null | string;
  startDate: string | null;
  endDate: string | null;
}

export interface NormalizedCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  platform: Platform;
  budget: number;
  startDate: string;
  endDate: string;
  // Computed metrics
  totalCost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionsValue: number;
  ctr: number;
  cpc: number;
  roas: number;
}

export interface DailyStat {
  campaignId: string;
  date: string;
  id: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  conversionsValue: number;
}

export interface FilterState {
  startDate: string;
  endDate: string;
  statuses: CampaignStatus[];
  platforms: Platform[];
}
