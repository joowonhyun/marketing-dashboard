import { Platform } from "@/shared/types";

export interface ChartDataEntry {
  name: Platform;
  value: number;
  fill: string;
  percentage: string;
}

export interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  name?: string;
  percentage?: string;
  [key: string]: any;
}

// 대시보드 지표(Metric) 타입 정의
export type PlatformMetric =
  | "totalCost"
  | "impressions"
  | "clicks"
  | "conversions";
export type RankingMetric = "roas" | "ctr" | "cpc";
