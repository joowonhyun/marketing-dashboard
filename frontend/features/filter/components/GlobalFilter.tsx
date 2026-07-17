"use client";

import { STATUS_OPTIONS, PLATFORM_OPTIONS } from "@/shared/constants/options";
import { useGlobalFilter } from "@/features/filter/hooks/useGlobalFilter";
import DateRangePicker from "./DateRangePicker";
import FilterToggleGroup from "./FilterToggleGroup";
import ResetButton from "./ResetButton";
import Divider from "./Divider";

export default function GlobalFilter() {
  const {
    startDate,
    endDate,
    statuses,
    platforms,
    setStartDate,
    setEndDate,
    toggleStatus,
    togglePlatform,
    reset,
  } = useGlobalFilter();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm text-slate-900 dark:text-slate-100">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />

        <Divider />

        <FilterToggleGroup
          label="상태"
          options={STATUS_OPTIONS}
          selected={statuses}
          onToggle={toggleStatus}
          activeClassName="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50"
        />

        <Divider />

        <FilterToggleGroup
          label="매체"
          options={PLATFORM_OPTIONS}
          selected={platforms}
          onToggle={togglePlatform}
          activeClassName="bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50"
        />

        <ResetButton onClick={reset} />
      </div>
    </div>
  );
}
