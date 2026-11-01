import { Suspense } from "react";
import { connection } from "next/server";
import { NotificationWizard } from "@/app/(panel)/settings/notifications/notification-wizard";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getNotificationSettings } from "@/services/notification.service";

export const metadata = { title: "الإشعارات | نظام ERP" };

async function NotificationsContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "saas", "view") && !can(user, "payments", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const settings = await getNotificationSettings();
  if (!settings) return <Forbidden href={firstAllowedHref(user)} />;
  return (
    <div>
      <PageHeader
        title="إشعارات تليجرام وواتساب"
        description="اربط بوت تليجرام دون نسخ معرف المحادثة، واختر طريقة واتساب المجانية أو الحصة الرسمية."
      />
      <NotificationWizard
        canEdit={can(user, "saas", "edit") || can(user, "payments", "edit")}
        chatId={settings.telegramChatId}
        chatName={settings.telegramChatName}
        maskedToken={settings.maskedToken}
        whatsappMode={settings.whatsappMode}
        bridgeUrl={settings.whatsappBridgeUrl}
        bridgeSecretSet={settings.bridgeSecretSet}
        metaPhoneNumberId={settings.metaPhoneNumberId}
        metaTokenSet={settings.metaTokenSet}
      />
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageSkeleton title="الإشعارات" />}>
      <NotificationsContent />
    </Suspense>
  );
}
