import { Suspense } from "react";
import { connection } from "next/server";
import { AutomationsPanel } from "@/app/(panel)/automations/automations-panel";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { isModuleEnabled } from "@/lib/modules-db";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listRules } from "@/services/automation.service";

export const metadata = { title: "الأتمتة | نظام ERP" };

async function AutomationsContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "automations", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("automations"))) return <DisabledModule title="الأتمتة" />;
  const [rules, suppliers] = await Promise.all([
    listRules(),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader title="محرك الأتمتة" description="قواعد تعمل في الخلفية عند البيع وحركات المخزون: محفز ثم إجراء." />
      <AutomationsPanel
        canCreate={can(user, "automations", "create")}
        suppliers={suppliers}
        rules={rules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          trigger: rule.trigger,
          action: rule.action,
          supplierName: rule.supplierName,
          isActive: rule.isActive,
        }))}
      />
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <Suspense fallback={<PageSkeleton title="الأتمتة" />}>
      <AutomationsContent />
    </Suspense>
  );
}
