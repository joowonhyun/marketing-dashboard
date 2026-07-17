"use client";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

/**
 * 집행 기간 날짜 범위 입력 UI 컴포넌트입니다.
 * 스토어와 직접 연결되지 않으며, props를 통해 외부에서 값을 주입받습니다.
 */
export default function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        집행 기간
      </label>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
        <span className="text-slate-400">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
      </div>
    </div>
  );
}
