"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Alert, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";

const demos = [
  { email: "admin@erp.com", name: "أحمد المدير", role: "مدير النظام", desc: "كل الصلاحيات" },
  { email: "accountant@erp.com", name: "سارة المحاسبة", role: "محاسب", desc: "مشتريات ومبيعات وتقارير ورقابة" },
  { email: "store@erp.com", name: "خالد أمين المخزن", role: "أمين مخزن", desc: "المخزون فقط" },
  { email: "sales@erp.com", name: "ليلى المبيعات", role: "مندوب مبيعات", desc: "المبيعات فقط" },
];

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">تسجيل الدخول</h2>
      <p className="mt-1 text-sm text-slate-600">لا يوجد تسجيل عام. استخدم حساباً مخوّلاً أو الدخول التجريبي.</p>
      <form action={action} className="mt-5 space-y-4">
        {state?.error ? <Alert kind="error">{state.error}</Alert> : null}
        <div>
          <label className={labelClass} htmlFor="email">
            البريد الإلكتروني
          </label>
          <input id="email" name="email" type="email" required dir="ltr" className={`${fieldClass} text-left`} />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            كلمة المرور
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            dir="ltr"
            className={`${fieldClass} text-left`}
          />
        </div>
        <button className={`${btnPrimary} w-full`} disabled={pending}>
          {pending ? "جارٍ التحقق..." : "دخول"}
        </button>
      </form>
      <div className="mt-6">
        <p className="text-sm font-bold text-slate-900">دخول سريع تجريبي</p>
        <p className="mt-1 text-xs text-slate-500">كلمة المرور لكل الحسابات: 123456</p>
        <div className="mt-3 grid gap-2">
          {demos.map((demo) => (
            <button
              key={demo.email}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-right hover:border-blue-600"
              onClick={() => {
                const email = document.getElementById("email") as HTMLInputElement | null;
                const password = document.getElementById("password") as HTMLInputElement | null;
                if (!email || !password) return;
                email.value = demo.email;
                password.value = "123456";
                email.form?.requestSubmit();
              }}
            >
              <span>
                <span className="block text-sm font-bold text-slate-900">{demo.name}</span>
                <span className="block text-xs text-slate-500">{demo.desc}</span>
              </span>
              <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">{demo.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
