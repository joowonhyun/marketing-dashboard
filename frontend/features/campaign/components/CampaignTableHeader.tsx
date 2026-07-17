import { Table } from "@/shared/components/ui/Table";
import { NormalizedCampaign } from "@/shared/types";
import { SortCol } from "@/features/campaign/hooks/useCampaignTable";
import { SORTABLE_COLS } from "@/shared/constants/table";

interface Props {
  pageData: NormalizedCampaign[];
  checkedIds: Set<string>;
  sortCol: SortCol;
  sortDesc: boolean;
  onToggleCheckAll: () => void;
  onSort: (col: SortCol) => void;
}

export default function CampaignTableHeader({
  pageData,
  checkedIds,
  sortCol,
  sortDesc,
  onToggleCheckAll,
  onSort,
}: Props) {
  const sortIndicator = (col: SortCol) =>
    sortCol === col ? (sortDesc ? " ↓" : " ↑") : "";

  return (
    <Table.Header>
      <Table.Row>
        <Table.Head className="w-10">
          <input
            type="checkbox"
            className="rounded border-slate-300 cursor-pointer"
            checked={checkedIds.size > 0 && checkedIds.size === pageData.length}
            onChange={onToggleCheckAll}
          />
        </Table.Head>
        <Table.Head>캠페인명</Table.Head>
        <Table.Head>상태</Table.Head>
        <Table.Head>매체</Table.Head>
        {SORTABLE_COLS.map(({ key, label }) => (
          <Table.Head key={key} onClick={() => onSort(key)}>
            {label}
            {sortIndicator(key)}
          </Table.Head>
        ))}
      </Table.Row>
    </Table.Header>
  );
}
