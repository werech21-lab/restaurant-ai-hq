"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/profile";
import { Alert, btnPrimary } from "@/components/erp-ui";
import type { FormatLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export interface ProfileFormProps {
  name: string;
  locale?: FormatLocale;
}

const INPUT_CLASS =
  "ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]";

function sanitizeStatusMessage(raw: string | undefined, isAr: boolean, ok: boolean): string {
  if (!raw || typeof raw !== "string") {
    return ok
      ? isAr
        ? "تم حفظ بيانات الملف الشخصي"
        : "Profile saved successfully"
      : isAr
        ? "تعذّر حفظ بيانات الملف الشخصي"
        : "Unable to save profile";
  }
  const trimmed = raw.trim();
  if (/https?:\/\/|Error:|at\s+\S+\s*\(|DATABASE_URL|AUTH_SECRET/i.test(trimmed)) {
    return isAr ? "تعذّر حفظ بيانات الملف الشخصي" : "Unable to save profile";
  }
  if (!isAr && trimmed === "تم حفظ بيانات الملف الشخصي") {
    return "Profile saved successfully";
  }
  if (!isAr && trimmed === "الاسم يجب أن يكون حرفين على الأقل") {
    return "Name must be at least 2 characters";
  }
  return trimmed;
}

function ProfileFormBody({ name, locale }: { name: string; locale: FormatLocale }) {
  const isAr = locale !== "en";
  const label = (ar: string, en: string) => (isAr ? ar : en);
  const [state, action, pending] = useActionState(updateProfile, null);

  return (
    <form action={action} className="space-y-3">
      {state?.ok === false ? (
        <Alert kind="error">{sanitizeStatusMessage(state.message, isAr, false)}</Alert>
      ) : null}
      {state?.ok ? (
        <Alert kind="ok">{sanitizeStatusMessage(state.message, isAr, true)}</Alert>
      ) : null}
      <div>
        <label
          className="mb-1.5 block text-xs font-semibold text-[var(--ds-text-secondary)]"
          htmlFor="name"
        >
          {label("الاسم", "Display Name")}
        </label>
        <input
          id="name"
          name="name"
          aria-label={label("الاسم", "Display Name")}
          defaultValue={name}
          className={INPUT_CLASS}
          required
        />
      </div>
      <p className="text-xs text-[var(--ds-text-muted)]">
        {label(
          "كلمة المرور الحالية تبقى كما هي دون تغيير.",
          "Your current password remains unchanged.",
        )}
      </p>
      <button type="submit" className={`${btnPrimary} ds-focus-ring`} disabled={pending}>
        {pending
          ? label("جارٍ الحفظ...", "Saving...")
          : label("حفظ الملف الشخصي", "Save Profile")}
      </button>
    </form>
  );
}

function ProfileFormI18n({ name }: { name: string }) {
  const { locale } = useI18n();
  return <ProfileFormBody name={name} locale={locale === "en" ? "en" : "ar"} />;
}

export function ProfileForm({ name, locale }: ProfileFormProps) {
  if (locale !== undefined) {
    return <ProfileFormBody name={name} locale={locale} />;
  }
  return <ProfileFormI18n name={name} />;
}
