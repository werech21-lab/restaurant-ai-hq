import { Suspense } from "react";
import { connection } from "next/server";
import { RadarButton } from "@/app/(panel)/bi-analytics/radar-button";
import { requireUser } from "@/lib/erp-auth";
import { DataCard, Forbidden, PageHeader, PageSkeleton, cardClass } from "@/components/erp-ui";
import { formatMoney, formatQty } from "@/lib/format";
import { can, firstAllowedHref } from "@/lib/permissions";
import { executiveInsights } from "@/services/bi.service";

export const metadata = { title: "ذكاء الأعمال | AetherBI" };

async function InsightsContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "reports", "view") && !can(user, "dashboard", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const data = await executiveInsights();
  return (
    <div>
      <PageHeader
        title="ذكاء الأعمال والتحليلات التنبؤية"
        description="AetherBI Insights: نمو المبيعات، هامش الأقسام، وتدفق نقدي لثلاثين يوماً."
      />
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <section className={`${cardClass} p-4`}><p className="text-xs text-slate-500">مبيعات الشهر</p><p className="text-xl font-bold">{formatMoney(data.salesNow)}</p></section>
        <section className={`${cardClass} p-4`}><p className="text-xs text-slate-500">نمو المبيعات</p><p className="text-xl font-bold">{data.growth}%</p></section>
        <section className={`${cardClass} p-4`}><p className="text-xs text-slate-500">هامش الربح</p><p className="text-xl font-bold">{data.marginNow}%</p></section>
        <section className={`${cardClass} p-4`}><p className="text-xs text-slate-500">النقد الحالي</p><p className="text-xl font-bold">{formatMoney(data.cash)}</p></section>
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <DataCard>
          <h2 className="border-b border-slate-200 px-4 py-3 font-bold">هامش الربح حسب القسم</h2>
          <table className="w-full text-sm">
            <tbody>
              {data.margins.length === 0 ? <tr><td className="px-4 py-6 text-slate-500">لا توجد مبيعات هذا الشهر.</td></tr> : data.margins.map((row) => (
                <tr key={row.name} className="border-b border-slate-200"><td className="px-4 py-2 font-semibold">{row.name}</td><td className="px-4 py-2">{formatMoney(row.sales)}</td><td className="px-4 py-2">{row.margin}%</td></tr>
              ))}
            </tbody>
          </table>
        </DataCard>
        <DataCard>
          <h2 className="border-b border-slate-200 px-4 py-3 font-bold">تدفق نقدي متوقع لـ 30 يوماً</h2>
          <p className="px-4 py-2 text-sm text-slate-600">صافي آخر 30 يوماً {formatMoney(data.net30)}. التقدير يوزّعه على أربعة أسابيع فوق الرصيد الحالي.</p>
          <table className="w-full text-sm">
            <tbody>
              {data.weeks.map((week) => (
                <tr key={week.week} className="border-b border-slate-200"><td className="px-4 py-2">الأسبوع {week.week}</td><td className="px-4 py-2 font-bold">{formatMoney(week.cash)}</td></tr>
              ))}
            </tbody>
          </table>
        </DataCard>
      </div>
      <section className={`${cardClass} mb-4 p-5`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">رادار المخاطر</h2>
          {user.role.isAdmin || can(user, "reports", "edit") || can(user, "automations", "edit") ? <RadarButton /> : null}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-bold">أصناف راكدة</h3>
            {data.dead.length === 0 ? <p className="text-sm text-slate-500">لا توجد أصناف راكدة.</p> : data.dead.map((item) => <p key={item.id} className="text-sm">{item.name} · {formatQty(item.currentStock)}</p>)}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">عملاء متأخرون</h3>
            {data.late.length === 0 ? <p className="text-sm text-slate-500">لا توجد مديونيات متأخرة.</p> : data.late.map((item) => <p key={item.name} className="text-sm">{item.name} · {formatMoney(item.balance)}</p>)}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">قرب النفاد</h3>
            {data.soon.length === 0 ? <p className="text-sm text-slate-500">لا توجد أصناف قاربت على النفاد.</p> : data.soon.map((item) => <p key={item.id} className="text-sm">{item.name} · {item.label}</p>)}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<PageSkeleton title="ذكاء الأعمال" />}>
      <InsightsContent />
    </Suspense>
  );
}
