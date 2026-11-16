import { ShieldCheck, UserCircle2 } from "lucide-react";
import { ProfileForm } from "@/app/(panel)/profile/profile-form";
import { PageHeader } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import { UNAVAILABLE_DASH, formatInt, getUnavailableTooltip, type FormatLocale } from "@/lib/format";
import { moduleNavLabel } from "@/lib/i18n/auto-translate";
import { MODULES } from "@/lib/modules";

export type ProfilePermissionRow = {
  key: string;
  labelAr: string;
  labelKey: (typeof MODULES)[number]["labelKey"];
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
};

export interface ProfileViewProps {
  locale: FormatLocale;
  userName: string;
  userEmail: string;
  roleName: string;
  permissionsMatrix: ProfilePermissionRow[];
  loading?: boolean;
  hasError?: boolean;
}

export function ProfileView({
  locale,
  userName,
  userEmail,
  roleName,
  permissionsMatrix,
  loading = false,
  hasError = false,
}: ProfileViewProps) {
  const isAr = locale !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const label = (ar: string, en: string) => (isAr ? ar : en);
  const unavailableTooltip = getUnavailableTooltip(locale);

  if (loading) {
    return (
      <div dir={dir} className="space-y-4">
        <StateBlock state="loading" locale={locale} skeletonRows={4} />
      </div>
    );
  }

  if (hasError) {
    return (
      <div dir={dir} className="space-y-4">
        <StateBlock
          state="error"
          locale={locale}
          title={label("تعذّر تحميل الملف الشخصي", "Unable to load profile")}
        />
      </div>
    );
  }

  return (
    <div dir={dir} className="w-full max-w-none space-y-5">
      <PageHeader
        title={label("الملف الشخصي", "My Profile")}
        description={label(
          "بيانات حسابك والصلاحيات الممنوحة لدورك.",
          "Your account details and role permission matrix.",
        )}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={label("معلومات الحساب", "Account Details")}
          icon={<UserCircle2 className="h-4 w-4" aria-hidden />}
          locale={locale}
          headerDivider
        >
          <div className="space-y-1.5 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-4">
            <p className="text-xs font-semibold text-[var(--ds-text-muted)]">
              {label("الدور الحالي", "Assigned Role")}
            </p>
            <p className="text-lg font-bold text-[var(--ds-text-primary)]">
              {roleName || (
                <span
                  dir="ltr"
                  title={unavailableTooltip}
                  aria-label={unavailableTooltip}
                  data-unavailable="true"
                >
                  {UNAVAILABLE_DASH}
                </span>
              )}
            </p>
            <p className="text-sm text-[var(--ds-text-secondary)]" dir="ltr">
              {userEmail || (
                <span
                  title={unavailableTooltip}
                  aria-label={unavailableTooltip}
                  data-unavailable="true"
                >
                  {UNAVAILABLE_DASH}
                </span>
              )}
            </p>
          </div>

          <div className="mt-5">
            <ProfileForm name={userName} locale={locale} />
          </div>
        </SectionCard>

        <SectionCard
          title={label("صلاحيات الدور", "Role Permissions")}
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          actions={
            <span
              dir="ltr"
              className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
            >
              {formatInt(permissionsMatrix.length, locale)}
            </span>
          }
          locale={locale}
          padded={false}
          headerDivider
        >
          {permissionsMatrix.length === 0 ? (
            <div className="p-4">
              <StateBlock
                state="empty"
                locale={locale}
                title={label("لا توجد صلاحيات مسجلة", "No role permissions configured")}
                compact
              />
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {label("القسم", "Module")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {label("العرض", "View")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {label("الإضافة", "Create")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {label("التعديل", "Edit")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {label("الحذف", "Delete")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                  {permissionsMatrix.map((row) => {
                    const modTitle = isAr ? row.labelAr : moduleNavLabel("en", row.labelKey);
                    return (
                      <tr key={row.key} className="hover:bg-[var(--ds-bg-hover)]">
                        <td className="px-4 py-2.5 font-semibold text-[var(--ds-text-primary)]">
                          {modTitle}
                        </td>
                        {(["view", "create", "edit", "delete"] as const).map((action) => {
                          const allowed = row[action];
                          return (
                            <td key={action} className="px-4 py-2.5">
                              {allowed ? (
                                <span
                                  className="inline-flex rounded-full border px-2 py-0.5 text-xs font-bold"
                                  style={{
                                    backgroundColor: "var(--ds-positive-bg)",
                                    borderColor: "var(--ds-positive-border)",
                                    color: "var(--ds-positive)",
                                  }}
                                >
                                  {label("نعم", "Yes")}
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-[var(--ds-text-muted)]">
                                  {label("لا", "No")}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
