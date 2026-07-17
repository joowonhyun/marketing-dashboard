interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * 이전 / 현재 페이지 / 다음 버튼으로 구성된 범용 페이지네이션 컴포넌트입니다.
 * totalPages가 1 이하이면 렌더링하지 않습니다.
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center gap-2 mt-4">
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        className={`px-3 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 ${
          currentPage === 1 ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        이전
      </button>

      <span className="text-sm font-medium">
        {currentPage}{" "}
        <span className="text-slate-400 font-normal">/ {totalPages}</span>
      </span>

      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        className={`px-3 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 ${
          currentPage === totalPages ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        다음
      </button>
    </div>
  );
}
