import { SortCol } from "@/features/campaign/hooks/useCampaignTable";

export const SORTABLE_COLS: { key: SortCol; label: string }[] = [
  { key: "period", label: "집행기간" },
  { key: "totalCost", label: "총 집행금액" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "roas", label: "ROAS" },
];
