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
      <p className="text-xs text-slate-500">كلمة المرور الحالية تبقى كما هي.</p>
      <button className={btnPrimary} disabled={pending}>
        {pending ? "جارٍ الحفظ..." : "حفظ الملف الشخصي"}
      </button>
    </form>
  );
}
