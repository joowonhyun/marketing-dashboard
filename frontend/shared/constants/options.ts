import { CampaignStatus } from "@/shared/types";
import { PLATFORM_OPTIONS as PLATFORM_LIST } from "./platforms";

export const STATUS_OPTIONS: { label: string; value: CampaignStatus }[] = [
  { label: "진행중", value: "active" },
  { label: "일시중지", value: "paused" },
  { label: "종료", value: "ended" },
];

export const PLATFORM_OPTIONS = PLATFORM_LIST;
