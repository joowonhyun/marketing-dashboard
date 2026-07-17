import { getStatusConfig } from "@/shared/utils/status";

interface Props {
  status: string;
}

/**
 * 캠페인 상태값을 한국어 배지 UI로 렌더링하는 전용 컴포넌트입니다.
 * @param {string} status - 'active' | 'paused' | 'ended'
 */
export const StatusBadge = ({ status }: Props) => {
  const config = getStatusConfig(status);

  if (!config) {
    return <span className="text-xs">{status}</span>;
  }

  return <span className={config.className}>{config.label}</span>;
};
