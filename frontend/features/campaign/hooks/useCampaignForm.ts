import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Platform } from "@/shared/types";
import { createCampaignAction } from "@/features/campaign/services/actions";
import { useModalStore } from "@/features/campaign/store/useModalStore";
import { useRouter } from "next/navigation";
import { DEFAULT_RADIX } from "@/shared/constants/campaign";
import {
  campaignFormSchema,
  CampaignFormValues,
} from "@/features/campaign/schemas/campaignFormSchema";

const SESSION_KEY = "campaignDraft";

const defaultValues: CampaignFormValues = {
  name: "",
  platform: "",
  budget: "",
  cost: "",
  startDate: "",
  endDate: "",
};

export const useCampaignForm = () => {
  const router = useRouter();
  const { isOpen, closeModal } = useModalStore();

  const { register, handleSubmit, control, reset, watch, formState: { errors, isSubmitting } } =
    useForm<CampaignFormValues>({
      resolver: zodResolver(campaignFormSchema),
      defaultValues,
    });

  // 모달 열릴 때 임시 저장 데이터 복원
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      reset(saved ? JSON.parse(saved) : defaultValues);
    } catch {
      reset(defaultValues);
    }
  }, [isOpen, reset]);

  // 입력값 변경 시 세션 스토리지에 자동 저장
  useEffect(() => {
    // react-hook-form의 watch()는 매 렌더마다 새 함수를 반환하는 공식 구독
    // 패턴이라 React Compiler가 메모이제이션을 못 함 — 의도된 동작이므로 억제.
    // eslint-disable-next-line react-hooks/incompatible-library
    const { unsubscribe } = watch((values) => {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(values));
    });
    return unsubscribe;
  }, [watch]);

  const onSubmit = async (data: CampaignFormValues) => {
    const result = await createCampaignAction({
      name: data.name,
      platform: data.platform as Platform,
      budget: parseInt(data.budget, DEFAULT_RADIX),
      status: "active",
      startDate: data.startDate,
      endDate: data.endDate,
    });

    if (!result.success) {
      alert(`캠페인 등록 실패: ${result.message}`);
      return;
    }

    sessionStorage.removeItem(SESSION_KEY);
    reset(defaultValues);
    closeModal();
    router.refresh();
  };

  return {
    isOpen,
    register,
    control,
    errors,
    isSubmitting,
    handleSubmit: handleSubmit(onSubmit),
    closeModal,
  };
};
