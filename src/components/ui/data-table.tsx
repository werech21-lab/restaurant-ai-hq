import { DataCard, PaginationBar } from "@/components/erp-ui";

export function DataTable({
  toolbar,
  children,
  path,
  params,
  page,
  total,
}: {
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  path: string;
  params: Record<string, string | number | undefined>;
  page: number;
  total: number;
}) {
  return (
    <DataCard>
      {toolbar}
      <div className="overflow-x-auto">{children}</div>
      <PaginationBar path={path} params={params} page={page} total={total} />
    </DataCard>
  );
}
