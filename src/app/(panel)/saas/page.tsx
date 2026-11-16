import { Suspense } from "react";
import { connection } from "next/server";
import { SaasView } from "@/app/(panel)/saas/saas-view";
import { PageSkeleton } from "@/components/erp-ui";
import { getCompany } from "@/lib/company";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/erp-auth";
import { getLocale } from "@/lib/i18n/server";
import { isExcludedOdooEntity } from "@/lib/odoo/excluded-entities";
import { VENTURE_BRANCHES, VENTURE_BRANDS } from "@/lib/venture-hierarchy";
import { listAppModules } from "@/services/apps.service";

export const metadata = {
  title: "الهيكل المؤسسي والترخيص | Venture Foods W.L.L.",
  description:
    "الهيكل المؤسسي الرسمي لشركة فنتشر فودز لإدارة المطاعم ذ.م.م. - 6 علامات تجارية • 7 فروع • 8 قنوات",
};

async function CorporateStructureContent() {
  await connection();
  const locale = await getLocale();
  await requireUser();

  let companyName = "شركة فنتشر فودز لإدارة المطاعم ذ.م.م.";
  let companyCurrency = "KWD";
  let companyTaxRate: number | null = null;
  let activeEmployeesCount: number | null = null;
  let enabledModulesCount: number | null = null;
  let warehouses: Array<{ code: string | null; name: string; location: string | null }> = [];
  let hasError = false;

  try {
    const [company, employees, modules, whRows] = await Promise.all([
      getCompany(),
      prisma.employee.findMany({
        where: { status: "ACTIVE" },
        select: { name: true, department: true },
      }),
      listAppModules(),
      prisma.warehouse.findMany({
        select: { code: true, name: true, location: true },
      }),
    ]);

    companyName = company.name;
    companyCurrency = company.currency;
    companyTaxRate = Number.isFinite(company.taxRate) ? company.taxRate : null;

    const cleanEmployees = employees.filter(
      (e) => !isExcludedOdooEntity(e.name) && !isExcludedOdooEntity(e.department),
    );
    activeEmployeesCount = cleanEmployees.length;
    enabledModulesCount = modules.filter((m) => m.isEnabled).length;
    warehouses = whRows.filter(
      (w) =>
        !isExcludedOdooEntity(w.name) &&
        !isExcludedOdooEntity(w.location ?? "") &&
        !isExcludedOdooEntity(w.code ?? ""),
    );
  } catch {
    hasError = true;
  }

  const branchItems = VENTURE_BRANCHES.map((br) => {
    const matchedWh = warehouses.find((wh) => {
      const haystack = `${wh.code ?? ""} ${wh.name} ${wh.location ?? ""}`.toLowerCase();
      return (
        haystack.includes(br.areaEn.toLowerCase()) ||
        haystack.includes(br.areaAr) ||
        haystack.includes(br.id.toLowerCase())
      );
    });
    return {
      ...br,
      linkedWarehouseName: matchedWh?.name ?? null,
    };
  });

  return (
    <SaasView
      locale={locale === "en" ? "en" : "ar"}
      companyName={companyName}
      companyCurrency={companyCurrency}
      companyTaxRate={companyTaxRate}
      activeEmployeesCount={activeEmployeesCount}
      enabledModulesCount={enabledModulesCount}
      brands={VENTURE_BRANDS}
      branches={branchItems}
      hasError={hasError}
    />
  );
}

export default function SaasPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Corporate Structure" />}>
      <CorporateStructureContent />
    </Suspense>
  );
}
