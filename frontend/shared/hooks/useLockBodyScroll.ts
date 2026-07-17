import { useEffect } from "react";

/**
 * 모달이나 오버레이가 렌더링될 때 body의 스크롤을 잠금/해제하는 커스텀 훅입니다.
 * @param {boolean} isLocked - 모달의 열림 상태 등 스크롤 잠금 여부
 */
export const useLockBodyScroll = (isLocked: boolean) => {
  useEffect(() => {
    if (!isLocked) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isLocked]);
};
