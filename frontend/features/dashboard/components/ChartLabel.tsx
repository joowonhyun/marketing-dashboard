import { PieLabelProps } from "@/features/dashboard/types/chart";

/**
 * 차트 세그먼트 외부에 표시될 커스텀 라벨 컴포넌트입니다.
 * Recharts의 Pie 컴포넌트에서 전달받은 좌표와 각도를 계산하여 텍스트를 렌더링합니다.
 */
export const ChartLabel = (props: PieLabelProps) => {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    outerRadius = 0,
    percentage = "0.0",
    name = "",
  } = props;

  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#64748b"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={11}
      className="font-semibold"
    >
      {`${name} ${percentage}%`}
    </text>
  );
};
