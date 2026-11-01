import { LoginForm } from "@/app/login/login-form";

export const metadata = { title: "تسجيل الدخول | نظام ERP" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <section className="flex items-center justify-center px-4 py-10">
        <LoginForm />
      </section>
      <section className="hidden flex-col justify-between bg-slate-900 px-12 py-12 text-white lg:flex">
        <div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold">BI</div>
          <h1 className="mt-8 text-4xl font-bold leading-snug">AetherBI Enterprise ERP</h1>
          <p className="mt-4 max-w-md text-slate-300">
            مخزون، مشتريات، مبيعات، وصلاحيات دقيقة. كل حركة تُسجَّل، وكل قائمة تُحمَّل على دفعات من الخادم.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-slate-300">المخزون</p>
            <p className="mt-1 font-bold">حد الطلب والتنبيه</p>
          </div>
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-slate-300">المالية</p>
            <p className="mt-1 font-bold">ديون وربحية</p>
          </div>
        </div>
      </section>
    </div>
  );
}
