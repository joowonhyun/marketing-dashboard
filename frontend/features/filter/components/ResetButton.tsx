"use client";

interface ResetButtonProps {
  onClick: () => void;
}

/**
 * 필터 초기화 버튼 컴포넌트입니다.
 * 초기화 동작은 부모에서 주입되므로, 이 컴포넌트는 스토어를 알지 못합니다.
 */
export default function ResetButton({ onClick }: ResetButtonProps) {
  return (
    <div className="mt-4 lg:mt-0 lg:ml-auto">
      <button
        onClick={onClick}
        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-all focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
      >
        초기화
      </button>
    </div>
  );
}
