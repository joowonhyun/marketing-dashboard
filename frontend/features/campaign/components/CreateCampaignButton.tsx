"use client";

import { useModalStore } from "@/features/campaign/store/useModalStore";

export default function CreateCampaignButton() {
  const { openModal } = useModalStore();

  return (
    <button
      onClick={openModal}
      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
    >
      + 캠페인 등록
    </button>
  );
}
