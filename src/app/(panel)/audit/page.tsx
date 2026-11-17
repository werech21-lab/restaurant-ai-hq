import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { getLocale } from "@/lib/i18n/server";
import { MODULES } from "@/lib/modules";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listAudit } from "@/services/report.service";
import { AuditLogView } from "./audit-view";

export const metadata = { title: "System Activity Log | AetherBI ERP" };

async function AuditContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "audit", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const moduleKey = MODULES.some((item) => item.key === query.filter) ? query.filter : "";
  const skip = (query.page - 1) * PAGE_SIZE;

  try {
    const data = await listAudit({ q: query.q, module: moduleKey, skip, take: PAGE_SIZE });
    return (
      <AuditLogView
        locale={locale}
        q={query.q}
        moduleKey={moduleKey}
        page={query.page}
        total={data.total}
        rows={data.rows}
      />
    );
  } catch {
    return (
      <AuditLogView
        locale={locale}
        q={query.q}
        moduleKey={moduleKey}
        page={query.page}
        total={0}
        rows={[]}
        hasError
      />
    );
  }
}

export default function AuditPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Activity Log" />}>
      <AuditContent searchParams={searchParams} />
    </Suspense>
  );
}
