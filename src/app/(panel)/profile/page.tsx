import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { PageHeader, PageSkeleton, cardClass } from "@/components/erp-ui";
import { MODULES } from "@/lib/modules";
import { can } from "@/lib/permissions";
import { ProfileForm } from "@/app/(panel)/profile/profile-form";

export const metadata = { title: "الملف الشخصي | نظام ERP" };

async function ProfileContent() {
  await connection();
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="الملف الشخصي" description="بيانات حسابك والصلاحيات الممنوحة لدورك." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${cardClass} p-5`}>
          <p className="text-sm text-slate-500">الدور الحالي</p>
          <p className="text-xl font-bold">{user.role.name}</p>
          <p className="mt-1 text-sm text-slate-600" dir="ltr">
            {user.email}
          </p>
          <div className="mt-5">
            <ProfileForm name={user.name} />
          </div>
        </section>
        <section className={`${cardClass} overflow-hidden`}>
          <h2 className="border-b border-slate-200 px-5 py-4 font-bold">صلاحيات الدور</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-2 text-right font-semibold">القسم</th>
                <th className="px-4 py-2 text-right font-semibold">العرض</th>
                <th className="px-4 py-2 text-right font-semibold">الإضافة</th>
                <th className="px-4 py-2 text-right font-semibold">التعديل</th>
                <th className="px-4 py-2 text-right font-semibold">الحذف</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((module) => (
                <tr key={module.key} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-2 font-semibold">{module.label}</td>
                  {(["view", "create", "edit", "delete"] as const).map((action) => (
                    <td key={action} className="px-4 py-2">
                      {can(user, module.key, action) ? (
                        <span className="font-bold text-emerald-700">نعم</span>
                      ) : (
                        <span className="text-slate-400">لا</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton title="الملف الشخصي" />}>
      <ProfileContent />
    </Suspense>
  );
}
