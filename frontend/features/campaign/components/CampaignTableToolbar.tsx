import { CampaignStatus } from "@/shared/types";
import { UI_DIMENSIONS } from "@/shared/constants/ui";

interface Props {
  searchTerm: string;
  totalItems: number;
  totalCampaignsLength: number;
  bulkStatus: CampaignStatus | "";
  checkedCount: number;
  onSearch: (val: string) => void;
  onBulkStatusChange: (status: CampaignStatus) => void;
  onBulkUpdate: () => void;
  onBulkDelete: () => void;
}

export default function CampaignTableToolbar({
  searchTerm,
  totalItems,
  totalCampaignsLength,
  bulkStatus,
  checkedCount,
  onSearch,
  onBulkStatusChange,
  onBulkUpdate,
  onBulkDelete,
}: Props) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <h3 className="font-semibold text-lg">캠페인 관리</h3>

      <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
        {/* Search */}
        <div
          className={`relative w-full md:${UI_DIMENSIONS.TOOLBAR.SEARCH_INPUT_WIDTH}`}
        >
          <input
            type="text"
            placeholder="캠페인명 검색"
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full px-3 py-2 pl-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
          <span className="text-slate-500">검색 결과</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">{totalItems}</span>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="text-slate-500">전체</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{totalCampaignsLength}건</span>
        </div>

        <div
          className={`hidden md:block w-px ${UI_DIMENSIONS.TOOLBAR.DIVIDER_HEIGHT} bg-slate-200 dark:bg-slate-700`}
        />

        {/* Bulk Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={bulkStatus}
            onChange={(e) =>
              onBulkStatusChange(e.target.value as CampaignStatus)
            }
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md outline-none cursor-pointer"
          >
            <option value="">상태 변경</option>
            <option value="active">진행중</option>
            <option value="paused">일시중지</option>
            <option value="ended">종료</option>
          </select>
          <button
            disabled={checkedCount === 0 || !bulkStatus}
            onClick={onBulkUpdate}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            일괄 적용
          </button>
          <button
            disabled={checkedCount === 0}
            onClick={onBulkDelete}
            className="px-3 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            선택 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
