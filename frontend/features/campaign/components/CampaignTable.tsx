"use client";

import { Campaign, DailyStat } from "@/shared/types";
import { Table } from "@/shared/components/ui/Table";
import Pagination from "@/shared/components/ui/Pagination";
import { UI_DIMENSIONS } from "@/shared/constants/ui";
import { useCampaignTable } from "@/features/campaign/hooks/useCampaignTable";
import { useFilteredData } from "@/features/filter/hooks/useFilteredData";
import CampaignTableToolbar from "./CampaignTableToolbar";
import CampaignTableHeader from "./CampaignTableHeader";
import CampaignTableRow from "./CampaignTableRow";

interface Props {
  allCampaigns: Campaign[];
  allDailyStats: DailyStat[];
}

export default function CampaignTable({ allCampaigns, allDailyStats }: Props) {
  const { campaigns } = useFilteredData(allCampaigns, allDailyStats);
  const {
    searchTerm,
    sortCol,
    sortDesc,
    currentPage,
    totalPages,
    totalItems,
    checkedIds,
    bulkStatus,
    setBulkStatus,
    handlePageChange,
    pageData,
    totalCampaignsLength,
    handleSearch,
    handleSort,
    toggleCheck,
    toggleCheckAll,
    handleBulkUpdate,
    handleBulkDelete,
  } = useCampaignTable(campaigns);

  return (
    <div className="flex flex-col gap-4">
      <CampaignTableToolbar
        searchTerm={searchTerm}
        totalItems={totalItems}
        totalCampaignsLength={totalCampaignsLength}
        bulkStatus={bulkStatus}
        checkedCount={checkedIds.size}
        onSearch={handleSearch}
        onBulkStatusChange={setBulkStatus}
        onBulkUpdate={handleBulkUpdate}
        onBulkDelete={handleBulkDelete}
      />

      <Table className="min-h-[490px]">
        <CampaignTableHeader
          pageData={pageData}
          checkedIds={checkedIds}
          sortCol={sortCol}
          sortDesc={sortDesc}
          onToggleCheckAll={toggleCheckAll}
          onSort={handleSort}
        />
        <Table.Body>
          {pageData.length > 0 ? (
            pageData.map((c) => (
              <CampaignTableRow
                key={c.id}
                campaign={c}
                checked={checkedIds.has(c.id)}
                onToggle={toggleCheck}
              />
            ))
          ) : (
            <Table.Row>
              <Table.Cell
                colSpan={UI_DIMENSIONS.CAMPAIGN_TABLE.COLUMN_COUNT}
                className="text-center py-20 text-slate-500"
              >
                현재 필터나 검색 조건에 일치하는 캠페인이 없습니다.
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
