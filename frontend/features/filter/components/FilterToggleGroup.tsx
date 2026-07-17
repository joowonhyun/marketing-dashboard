"use client";

interface FilterToggleGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  activeClassName: string;
}

/**
 * 범용 토글 버튼 그룹 컴포넌트입니다.
 * 상태(Status)와 매체(Platform) 필터 모두에서 재사용됩니다.
 * 특정 도메인 타입에 독립적이며, 제네릭 타입으로 타입 안정성을 보장합니다.
 */
export default function FilterToggleGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  activeClassName,
}: FilterToggleGroupProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        {options.map((opt) => {
          const isActive = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border cursor-pointer ${
                isActive
                  ? activeClassName
                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
