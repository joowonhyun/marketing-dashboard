import { z } from "zod";
import { PLATFORM_NAMES } from "@/shared/constants/platforms";
import { CAMPAIGN_LIMITS } from "@/shared/constants/campaign";

export const campaignFormSchema = z
  .object({
    name: z
      .string()
      .min(
        CAMPAIGN_LIMITS.NAME_MIN_LENGTH,
        `캠페인명은 ${CAMPAIGN_LIMITS.NAME_MIN_LENGTH}자 이상 입력해주세요.`,
      )
      .max(
        CAMPAIGN_LIMITS.NAME_MAX_LENGTH,
        `캠페인명은 ${CAMPAIGN_LIMITS.NAME_MAX_LENGTH}자 이하로 입력해주세요.`,
      ),
    platform: z.enum(PLATFORM_NAMES as [string, ...string[]], {
      error: "플랫폼을 선택해주세요.",
    }),
    budget: z
      .string()
      .min(1, "예산을 입력해주세요.")
      .refine(
        (v) => {
          const n = Number(v);
          return !isNaN(n) && n >= CAMPAIGN_LIMITS.BUDGET_MIN && n <= CAMPAIGN_LIMITS.BUDGET_MAX;
        },
        `예산은 ${CAMPAIGN_LIMITS.BUDGET_MIN.toLocaleString()}원에서 ${CAMPAIGN_LIMITS.BUDGET_MAX.toLocaleString()}원 사이의 정수여야 합니다.`,
      ),
    cost: z
      .string()
      .min(1, "집행 금액을 입력해주세요.")
      .refine(
        (v) => {
          const n = Number(v);
          return !isNaN(n) && n >= CAMPAIGN_LIMITS.COST_MIN && n <= CAMPAIGN_LIMITS.COST_MAX;
        },
        `집행 금액은 ${CAMPAIGN_LIMITS.COST_MIN.toLocaleString()}원에서 ${CAMPAIGN_LIMITS.COST_MAX.toLocaleString()}원 사이여야 합니다.`,
      ),
    startDate: z.string().min(1, "시작일을 선택해주세요."),
    endDate: z.string().min(1, "종료일을 선택해주세요."),
  })
  .refine(
    (data) => {
      const budget = Number(data.budget);
      const cost = Number(data.cost);
      return isNaN(budget) || isNaN(cost) || cost <= budget;
    },
    {
      message: "집행 금액은 예산을 초과할 수 없습니다.",
      path: ["cost"],
    },
  )
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.endDate) > new Date(data.startDate);
    },
    {
      message: "종료일은 시작일 이후여야 합니다.",
      path: ["endDate"],
    },
  );

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
