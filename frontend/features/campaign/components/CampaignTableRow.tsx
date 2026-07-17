import { Table } from "@/shared/components/ui/Table";
import { NormalizedCampaign } from "@/shared/types";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import { formatNumber } from "@/shared/utils/formatters";

interface Props {
  campaign: NormalizedCampaign;
  checked: boolean;
  onToggle: (id: string) => void;
}

export default function CampaignTableRow({
  campaign: c,
  checked,
  onToggle,
}: Props) {
  return (
    <Table.Row>
      <Table.Cell className="w-10 whitespace-nowrap">
        <input
          type="checkbox"
          className="rounded border-slate-300 cursor-pointer"
          checked={checked}
          onChange={() => onToggle(c.id)}
        />
      </Table.Cell>
      <Table.Cell className="font-medium min-w-[200px] break-keep">
        {c.name}
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap text-center">
        <StatusBadge status={c.status} />
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap text-center">
        {c.platform}
      </Table.Cell>
      <Table.Cell className="text-slate-500 text-xs whitespace-nowrap text-center">
        {`${c.startDate} ~ ${c.endDate}`}
      </Table.Cell>
      <Table.Cell className="text-right font-medium whitespace-nowrap">
        {formatNumber(c.totalCost, true)}
      </Table.Cell>
      <Table.Cell className="text-right whitespace-nowrap">
        {formatNumber(c.ctr, false, true)}
      </Table.Cell>
      <Table.Cell className="text-right whitespace-nowrap">
        {formatNumber(c.cpc, true)}
      </Table.Cell>
      <Table.Cell className="text-right whitespace-nowrap">
        {formatNumber(c.roas, false, true)}
      </Table.Cell>
    </Table.Row>
  );
}
