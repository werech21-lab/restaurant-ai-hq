import { Suspense } from "react";
import { connection } from "next/server";
import { AutomationsPanel } from "@/app/(panel)/automations/automations-panel";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { getLocale, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listRules } from "@/services/automation.service";

export const metadata = { title: "Automations | AetherBI ERP" };

async function AutomationsContent() {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "automations", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("automations"))) {
    return <DisabledModule title={tx(locale, "الأتمتة", "Automations")} />;
  }
  const [rules, suppliers] = await Promise.all([
    listRules(),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, take: 25, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader
        title={tx(locale, "محرك الأتمتة", "Automation engine")}
        description={tx(
          locale,
          "قواعد تعمل في الخلفية عند البيع وحركات المخزون: محفز ثم إجراء.",
          "Background rules on sales and stock movements: trigger then action.",
        )}
      />
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
    <Suspense fallback={<PageSkeleton title="Automations" />}>
      <AutomationsContent />
    </Suspense>
  );
}
