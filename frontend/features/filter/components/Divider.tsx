import { UI_DIMENSIONS } from "@/shared/constants/ui";

export default function Divider() {
  return (
    <div
      className={`hidden lg:block w-px ${UI_DIMENSIONS.FILTER.DIVIDER_HEIGHT} bg-slate-200 dark:bg-slate-700`}
    />
  );
}
