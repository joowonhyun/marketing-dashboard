import { useFilterStore } from "@/features/filter/store/useFilterStore";
import { CampaignStatus, Platform } from "@/shared/types";

/**
 * GlobalFilter의 상태 및 토글 로직을 캡슐화한 커스텀 훅입니다.
 * UI 컴포넌트는 이 훅을 통해 필터 스토어와 간접적으로 통신합니다.
 */
export const useGlobalFilter = () => {
  const {
    startDate,
    endDate,
    statuses,
    platforms,
    setStartDate,
    setEndDate,
    setStatuses,
    setPlatforms,
    reset,
  } = useFilterStore();

  const toggleStatus = (status: CampaignStatus) => {
    if (statuses.includes(status)) {
      setStatuses(statuses.filter((s) => s !== status));
    } else {
      setStatuses([...statuses, status]);
    }
  };

  const togglePlatform = (platform: Platform) => {
    if (platforms.includes(platform)) {
      setPlatforms(platforms.filter((p) => p !== platform));
    } else {
      setPlatforms([...platforms, platform]);
    }
  };

  return {
    startDate,
    endDate,
    statuses,
    platforms,
    setStartDate,
    setEndDate,
    toggleStatus,
    togglePlatform,
    reset,
  };
};
