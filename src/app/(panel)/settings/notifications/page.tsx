import { Suspense } from "react";
import { connection } from "next/server";
import { NotificationWizard } from "@/app/(panel)/settings/notifications/notification-wizard";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { StateBlock } from "@/components/ui";
import { requireUser } from "@/lib/erp-auth";
import { getLocale, tx } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getNotificationSettings } from "@/services/notification.service";

export const metadata = { title: "الإشعارات | نظام ERP" };

async function NotificationsContent() {
  await connection();
  const locale = await getLocale();
  const resolvedLocale = locale === "en" ? "en" : "ar";
  const dir = resolvedLocale === "en" ? "ltr" : "rtl";
  const user = await requireUser();
  if (!can(user, "saas", "view") && !can(user, "payments", "view")) {
    return <Forbidden href={firstAllowedHref(user)} />;
  }

  let settings: Awaited<ReturnType<typeof getNotificationSettings>> = null;
  let hasError = false;
  try {
    settings = await getNotificationSettings();
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <div dir={dir} className="space-y-4">
        <PageHeader
          title={tx(resolvedLocale, "إشعارات تليجرام وواتساب", "Telegram & WhatsApp Notifications")}
          description={tx(
            resolvedLocale,
            "اربط بوت تليجرام دون نسخ معرف المحادثة، واختر طريقة واتساب المعتمدة.",
            "Connect Telegram bot alerts and configure WhatsApp delivery modes.",
          )}
        />
        <StateBlock
          state="error"
          locale={resolvedLocale}
          title={tx(resolvedLocale, "تعذّر تحميل إعدادات الإشعارات", "Unable to load notification settings")}
        />
      </div>
    );
  }

  if (!settings) return <Forbidden href={firstAllowedHref(user)} />;

  return (
    <div dir={dir} className="w-full max-w-none space-y-5">
      <PageHeader
        title={tx(resolvedLocale, "إشعارات تليجرام وواتساب", "Telegram & WhatsApp Notifications")}
        description={tx(
          resolvedLocale,
          "اربط بوت تليجرام دون نسخ معرف المحادثة، واختر طريقة واتساب المجانية أو الحصة الرسمية.",
          "Connect your Telegram alert bot and choose direct, local bridge, or Meta Cloud WhatsApp delivery.",
        )}
      />
      <NotificationWizard
        locale={resolvedLocale}
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
    <Suspense fallback={<PageSkeleton title="Notifications" />}>
      <NotificationsContent />
    </Suspense>
  );
}
