"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/profile";
import { Alert, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-3">
      {state?.ok === false ? <Alert kind="error">{state.message}</Alert> : null}
      {state?.ok ? <Alert kind="ok">{state.message || "تم الحفظ"}</Alert> : null}
      <div>
        <label className={labelClass} htmlFor="name">
          الاسم
        </label>
        <input id="name" name="name" defaultValue={name} className={fieldClass} required />
      </div>
      <div>
        <label className={labelClass} htmlFor="currentPassword">
          كلمة المرور الحالية
        </label>
        <input id="currentPassword" name="currentPassword" type="password" dir="ltr" className={`${fieldClass} text-left`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="newPassword">
            كلمة المرور الجديدة
          </label>
          <input id="newPassword" name="newPassword" type="password" dir="ltr" className={`${fieldClass} text-left`} />
        </div>
        <div>
          <label className={labelClass} htmlFor="confirmPassword">
            تأكيد كلمة المرور
          </label>
          <input id="confirmPassword" name="confirmPassword" type="password" dir="ltr" className={`${fieldClass} text-left`} />
        </div>
      </div>
      <p className="text-xs text-slate-500">اترك حقول كلمة المرور فارغة إذا أردت تغيير الاسم فقط.</p>
      <button className={btnPrimary} disabled={pending}>
        {pending ? "جارٍ الحفظ..." : "حفظ الملف الشخصي"}
      </button>
    </form>
  );
}
