import { CampaignStatus } from "@/shared/types";

export const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; className: string }
> = {
  active: {
    label: "진행중",
    className:
      "whitespace-nowrap px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold",
  },
  paused: {
    label: "일시중지",
    className:
      "whitespace-nowrap px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs font-semibold",
  },
  ended: {
    label: "종료",
    className:
      "whitespace-nowrap px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold",
  },
};

/**
 * 상태값에 따른 레이블과 스타일 클래스를 반환합니다. (JSX 없음)
 */
export const getStatusConfig = (status: string) => {
  return STATUS_CONFIG[status as CampaignStatus] || null;
};
