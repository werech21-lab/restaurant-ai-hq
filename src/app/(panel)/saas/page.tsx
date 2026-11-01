import { Suspense } from "react";
import { connection } from "next/server";
import { SaasPanel } from "@/app/(panel)/saas/saas-panel";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { MODULES } from "@/lib/modules";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { parseModules } from "@/lib/plans";
import { formatDate } from "@/lib/format";
import { listOrganizations } from "@/services/saas.service";

export const metadata = { title: "المنصة والاشتراكات | نظام ERP" };

async function SaasContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const user = await requireUser();
  if (!can(user, "saas", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("saas"))) return <DisabledModule title="المنصة" />;
  const query = await readQuery(searchParams);
  const orgs = await listOrganizations((query.page - 1) * PAGE_SIZE, PAGE_SIZE, query.q);
  return (
    <div>
      <PageHeader
        title="المنصة متعددة الشركات"
        description="باقات البداية والاحترافية والمؤسسات، مع عملة وضريبة ووحدات مستقلة لكل شركة."
        actions={
          <a href="/deploy" className="text-sm font-semibold text-blue-700">
            النشر السحابي
          </a>
        }
      />
      <SaasPanel
        canEdit={can(user, "saas", "edit") || can(user, "saas", "create")}
        moduleOptions={MODULES.map((item) => ({ key: item.key, label: item.label }))}
        organizations={orgs.rows.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          currency: org.currency,
          taxRate: org.taxRate,
          taxNumber: org.taxNumber ?? "",
          isDefault: org.isDefault,
          isActive: org.isActive,
          ends: org.subscriptionEndsAt ? formatDate(org.subscriptionEndsAt) : "",
          modules: parseModules(org.enabledModules, org.plan),
        }))}
      />
      <PaginationBar path="/saas" params={{ q: query.q }} page={query.page} total={orgs.total} />
    </div>
  );
}

export default function SaasPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="المنصة" />}>
      <SaasContent searchParams={searchParams} />
    </Suspense>
  );
}
