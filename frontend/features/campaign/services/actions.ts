"use server";

import { updateCampaignStatus, createCampaign, deleteCampaign } from "./api";
import { Campaign } from "@/shared/types";

type ActionResult = { success: true } | { success: false; message: string };

export async function updateCampaignStatusesAction(
  ids: string[],
  status: string,
): Promise<ActionResult> {
  try {
    await Promise.all(ids.map((id) => updateCampaignStatus(id, status)));
    return { success: true };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "상태 변경 중 알 수 없는 오류가 발생했습니다.";
    console.error("[updateCampaignStatusesAction]", message);
    return { success: false, message };
  }
}

export async function createCampaignAction(
  campaign: Omit<Campaign, "id">,
): Promise<ActionResult> {
  try {
    await createCampaign(campaign);
    return { success: true };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "캠페인 등록 중 알 수 없는 오류가 발생했습니다.";
    console.error("[createCampaignAction]", message);
    return { success: false, message };
  }
}

export async function deleteCampaignsAction(
  ids: string[],
): Promise<ActionResult> {
  try {
    await Promise.all(ids.map((id) => deleteCampaign(id)));
    return { success: true };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "캠페인 삭제 중 알 수 없는 오류가 발생했습니다.";
    console.error("[deleteCampaignsAction]", message);
    return { success: false, message };
  }
}
