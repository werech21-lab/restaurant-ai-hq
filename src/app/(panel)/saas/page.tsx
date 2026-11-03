import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { PageHeader, PageSkeleton } from "@/components/erp-ui";
import { VENTURE_BRANDS, VENTURE_BRANCHES } from "@/lib/venture-hierarchy";
import { ShieldCheck, Building2, Store, Users, Database, Layers, CheckCircle2, Award } from "lucide-react";

export const metadata = {
  title: "الهيكل المؤسسي والترخيص | Venture Foods W.L.L.",
  description: "الهيكل المؤسسي الرسمي لشركة فنتشر فودز لإدارة المطاعم ذ.م.م. - 6 براندات، 10 فروع، والمطبخ المركزي",
};

async function CorporateStructureContent() {
  await connection();
  await requireUser();

  return (
    <div className="space-y-6 pb-12">
      {/* Official Enterprise Header */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                <ShieldCheck size={14} />
                رخصة مؤسسية دائمة مدى الحياة · Enterprise Lifetime License
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs text-blue-300">
                <CheckCircle2 size={12} />
                كافة الوحدات مفعلة 100%
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              شركة فنتشر فودز لإدارة المطاعم ذ.م.م.
            </h1>
            <p className="text-sm font-medium text-slate-300" dir="ltr">
              Venture Foods Restaurant Management Co. W.L.L. · CR 412891 · Kuwait
            </p>
          </div>
          <div className="flex flex-col items-start rounded-xl border border-white/10 bg-black/40 p-4 text-right md:items-end">
            <span className="text-xs text-slate-400">السجل التجاري والكيان</span>
            <span className="text-lg font-bold text-white">ذ.م.م. كويتية (W.L.L.)</span>
            <span className="text-xs text-emerald-400">رأس المال: 500,000 د.ك</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">العلامات التجارية</span>
            <Building2 size={18} className="text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">6 براندات</p>
          <p className="text-xs text-slate-400">مملوكة ومطورة داخلياً 100%</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">المواقع التشغيلية</span>
            <Store size={18} className="text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">10 فروع + مطبخ مركزي</p>
          <p className="text-xs text-slate-400">تغطية جغرافية كاملة في الكويت</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">القوى العاملة المسجلة</span>
            <Users size={18} className="text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">166 موظفاً</p>
          <p className="text-xs text-emerald-400">معتمد بنظام حماية الأجور WPS</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">بحيرة بيانات أودو</span>
            <Database size={18} className="text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">9,662 سجلاً</p>
          <p className="text-xs text-slate-400">مزامنة موثقة بكود SHA-256</p>
        </div>
      </div>

      {/* Brands Directory */}
      <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Layers className="text-amber-400" size={20} />
            العلامات التجارية لشركة فنتشر فودز (6 Brands)
          </h2>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
            جميع الحقوق والوصفات مسجلة ومملوكة
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {VENTURE_BRANDS.map((b) => (
            <div
              key={b.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 transition-all hover:border-slate-700"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-white">{b.nameAr}</h3>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-amber-300 font-mono" dir="ltr">
                    {b.id}
                  </span>
                </div>
                <p className="text-xs text-slate-400" dir="ltr">
                  {b.nameEn}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  تشغيل حي في فروع ومطابخ الكويت
                </div>
              </div>
              <div className="mt-4 border-t border-slate-800 pt-3">
                <a
                  href={`/sales?brand=${b.id}`}
                  className="inline-flex text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  استعراض مؤشرات أداء {b.nameAr} ←
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operating Branches & Central Kitchen */}
      <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Store className="text-blue-400" size={20} />
            شبكة الفروع التشغيلية والمطبخ المركزي (10 Locations + Commissary)
          </h2>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
            ربط سحابي فوري مع نقاط البيع و KDS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold uppercase text-slate-400">
                <th className="px-4 py-3 text-right">كود الفرع</th>
                <th className="px-4 py-3 text-right">اسم الفرع / المنشأة</th>
                <th className="px-4 py-3 text-right">المنطقة الجغرافية</th>
                <th className="px-4 py-3 text-right">البراند الرئيسي</th>
                <th className="px-4 py-3 text-right">طبيعة التشغيل</th>
                <th className="px-4 py-3 text-center">حالة الربط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {VENTURE_BRANCHES.map((br) => (
                <tr key={br.id} className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-300" dir="ltr">
                    {br.id}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">
                    {br.nameAr}
                    <span className="block text-xs text-slate-400 font-normal" dir="ltr">
                      {br.nameEn}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {br.areaAr}
                    <span className="block text-xs text-slate-500" dir="ltr">
                      {br.areaEn}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-amber-300 font-mono text-xs" dir="ltr">
                    {br.brandId}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {br.id.includes("CENTRAL") ? "تجهيز وتصنيع مركزي ولوجستيات" : "صالة، سفري، وتوصيل منصات"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      متصل ونشط
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enterprise Governance Certification */}
      <div className="rounded-xl border border-slate-800 bg-[#0f172a]/40 p-4 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-bold text-slate-300">
          <Award size={16} className="text-emerald-400" />
          بيان الملكية والترخيص الحصري:
        </div>
        <p className="mt-1 leading-relaxed">
          نظام AetherBI ERP مهيأ ومخصص حصرياً لعمليات شركة فنتشر فودز لإدارة المطاعم ذ.م.م. (سجل تجاري 412891). لا يتضمن
          هذا النظام أي خطط اشتراك تجارية خارجية، وتتمتع الشركة بصلاحية الوصول المؤسسي الكامل والدائم (Enterprise
          Lifetime License) دون أي قيود على عدد المستخدمين أو حجم الفواتير أو الفروع.
        </p>
      </div>
    </div>
  );
}

export default function SaasPage() {
  return (
    <Suspense fallback={<PageSkeleton title="الهيكل المؤسسي" />}>
      <CorporateStructureContent />
    </Suspense>
  );
}
