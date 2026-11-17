import { Suspense } from "react";
import { connection } from "next/server";
import { ProfileView } from "@/app/(panel)/profile/profile-view";
import { PageSkeleton } from "@/components/erp-ui";
import { requireUser } from "@/lib/erp-auth";
import { getLocale } from "@/lib/i18n/server";
import { MODULES } from "@/lib/modules";
import { can } from "@/lib/permissions";

export const metadata = { title: "الملف الشخصي | نظام ERP" };

async function ProfileContent() {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();

  const permissionsMatrix = MODULES.map((module) => ({
    key: module.key,
    labelAr: module.label,
    labelKey: module.labelKey,
    view: can(user, module.key, "view"),
    create: can(user, module.key, "create"),
    edit: can(user, module.key, "edit"),
    delete: can(user, module.key, "delete"),
  }));

  return (
    <ProfileView
      locale={locale === "en" ? "en" : "ar"}
      userName={user.name}
      userEmail={user.email}
      roleName={user.role.name}
      permissionsMatrix={permissionsMatrix}
    />
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton title="Profile" />}>
      <ProfileContent />
    </Suspense>
  );
}
