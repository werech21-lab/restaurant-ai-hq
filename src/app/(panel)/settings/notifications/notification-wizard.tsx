"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Link2, MessageSquare } from "lucide-react";
import { detectTelegramAction, saveNotificationsAction } from "@/app/actions/notifications";
import { Alert, btnPrimary } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import { UNAVAILABLE_DASH, getUnavailableTooltip, type FormatLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export interface NotificationWizardProps {
  chatId: string;
  chatName: string;
  maskedToken: string;
  whatsappMode: string;
  bridgeUrl: string;
  bridgeSecretSet: boolean;
  metaPhoneNumberId: string;
  metaTokenSet: boolean;
  canEdit: boolean;
  locale?: FormatLocale;
  loading?: boolean;
  hasError?: boolean;
}

const INPUT_CLASS =
  "ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] disabled:cursor-not-allowed disabled:opacity-60";

const LABEL_CLASS = "block text-xs font-semibold text-[var(--ds-text-secondary)]";

function sanitizeNotificationMsg(raw: string | undefined, isAr: boolean): string {
  const fallback = isAr
    ? "تعذّر حفظ إعدادات الإشعارات حالياً. يرجى المحاولة مجدداً."
    : "Unable to save notification settings right now. Please try again.";
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (
    !trimmed ||
    /https?:\/\/|Error:|at\s+\S+\s*\(|TELEGRAM|BOT_TOKEN|Bearer|DATABASE_URL|AUTH_SECRET/i.test(
      trimmed,
    )
  ) {
    return fallback;
  }
  return trimmed;
}

function NotificationWizardBody({
  chatId,
  chatName,
  maskedToken,
  whatsappMode,
  bridgeUrl,
  bridgeSecretSet,
  metaPhoneNumberId,
  metaTokenSet,
  canEdit,
  locale,
  loading = false,
  hasError = false,
}: Omit<NotificationWizardProps, "locale"> & { locale: FormatLocale }) {
  const router = useRouter();
  const isAr = locale !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const label = (ar: string, en: string) => (isAr ? ar : en);
  const unavailableTooltip = getUnavailableTooltip(locale);

  const [mode, setMode] = useState(whatsappMode || "CLICK");
  const [detectedId, setDetectedId] = useState(chatId);
  const [detectedName] = useState(chatName);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");

  if (loading) {
    return <StateBlock state="loading" locale={locale} skeletonRows={5} />;
  }

  if (hasError) {
    return (
      <StateBlock
        state="error"
        locale={locale}
        title={label("تعذّر تحميل معالج الإشعارات", "Unable to load notification settings")}
        onRetry={() => router.refresh()}
      />
    );
  }

  async function detect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const token = String(new FormData(event.currentTarget).get("token") ?? "");
    setPending("telegram");
    setError("");
    setMessage("");
    try {
      const result = await detectTelegramAction(token);
      if (!result.ok) {
        setError(sanitizeNotificationMsg(result.message, isAr));
        return;
      }
      setDetectedId(result.id || "");
      setMessage(
        isAr
          ? result.message || "تم ربط تليجرام بنجاح"
          : "Telegram chat connected successfully",
      );
      router.refresh();
    } catch {
      setError(sanitizeNotificationMsg(undefined, isAr));
    } finally {
      setPending("");
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const form = new FormData(event.currentTarget);
    setPending("save");
    setError("");
    setMessage("");
    try {
      const result = await saveNotificationsAction({
        whatsappMode: String(form.get("whatsappMode") ?? "CLICK"),
        whatsappBridgeUrl: String(form.get("whatsappBridgeUrl") ?? ""),
        whatsappBridgeSecret: String(form.get("whatsappBridgeSecret") ?? ""),
        metaPhoneNumberId: String(form.get("metaPhoneNumberId") ?? ""),
        metaAccessToken: String(form.get("metaAccessToken") ?? ""),
      });
      if (!result.ok) {
        setError(sanitizeNotificationMsg(result.message, isAr));
        return;
      }
      setMessage(
        isAr
          ? result.message || "تم حفظ إعدادات الإشعارات"
          : "Notification settings saved successfully",
      );
      router.refresh();
    } catch {
      setError(sanitizeNotificationMsg(undefined, isAr));
    } finally {
      setPending("");
    }
  }

  return (
    <div dir={dir} className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}

      <SectionCard
        title={label("ربط تليجرام بنقرة واحدة", "One-Click Telegram Bot Integration")}
        subtitle={label(
          "افتح @BotFather في تليجرام وأرسل /newbot، ثم الصق التوكن هنا وأرسل أي رسالة للبوت واضغط الجلب التلقائي.",
          "Create a bot with @BotFather (/newbot), paste the bot token below, message your bot, and run Auto-Detect.",
        )}
        icon={<Bot className="h-4 w-4" aria-hidden />}
        actions={
          <span
            dir="ltr"
            className="rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ds-text-secondary)]"
          >
            {maskedToken || (
              <span
                title={unavailableTooltip}
                aria-label={unavailableTooltip}
                data-unavailable="true"
              >
                {UNAVAILABLE_DASH}
              </span>
            )}
          </span>
        }
        locale={locale}
        headerDivider
      >
        <form onSubmit={detect} className="space-y-3.5">
          <div>
            <label htmlFor="notif-tg-token" className={LABEL_CLASS}>
              {label("توكن بوت تليجرام (Telegram Bot Token)", "Telegram Bot Token")}
            </label>
            <input
              id="notif-tg-token"
              type="password"
              name="token"
              aria-label={label("توكن بوت تليجرام", "Telegram Bot Token")}
              className={INPUT_CLASS}
              dir="ltr"
              placeholder={maskedToken || "••••"}
              autoComplete="off"
              disabled={!canEdit}
            />
          </div>

          <div>
            <label htmlFor="notif-tg-chat" className={LABEL_CLASS}>
              {label("معرف المحادثة (Chat ID)", "Detected Chat ID")}
            </label>
            <input
              id="notif-tg-chat"
              type="text"
              className={INPUT_CLASS}
              dir="ltr"
              aria-label={label("معرف المحادثة", "Detected Chat ID")}
              value={detectedId}
              readOnly
              placeholder={label("يُملأ تلقائياً", "Populated automatically")}
            />
          </div>

          <p className="text-xs font-semibold text-[var(--ds-text-secondary)]">
            {detectedName
              ? label(`الحساب المرتبط: ${detectedName}`, `Connected account: ${detectedName}`)
              : label("لم يُجلب حساب بعد", "No chat connected yet")}
          </p>

          {canEdit ? (
            <button
              className={`${btnPrimary} ds-focus-ring`}
              disabled={pending !== ""}
              type="submit"
            >
              {pending === "telegram"
                ? label("جارٍ الجلب...", "Detecting...")
                : label("جلب معرف المحادثة تلقائياً", "Auto-Detect Chat ID")}
            </button>
          ) : null}
        </form>
      </SectionCard>

      <form onSubmit={save} className="space-y-4">
        <SectionCard
          title={label("وضع إرسال واتساب", "WhatsApp Delivery Mode")}
          icon={<MessageSquare className="h-4 w-4" aria-hidden />}
          locale={locale}
          headerDivider
        >
          <div className="space-y-3 text-sm text-[var(--ds-text-primary)]">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3 font-semibold">
              <input
                type="radio"
                name="whatsappMode"
                value="CLICK"
                aria-label={label("الوضع الفوري عبر wa.me", "Direct Click via wa.me")}
                className="ds-focus-ring mt-1 h-4 w-4 accent-emerald-600"
                checked={mode === "CLICK"}
                onChange={() => setMode("CLICK")}
                disabled={!canEdit}
              />
              <span>
                {label(
                  "الوضع الفوري: زر يفتح محادثة العميل عبر wa.me دون اشتراك.",
                  "Direct Click Mode: opens customer chat via wa.me without external API setup.",
                )}
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3 font-semibold">
              <input
                type="radio"
                name="whatsappMode"
                value="BRIDGE"
                aria-label={label("جسر محلي عبر QR", "Local Bridge via QR")}
                className="ds-focus-ring mt-1 h-4 w-4 accent-emerald-600"
                checked={mode === "BRIDGE"}
                onChange={() => setMode("BRIDGE")}
                disabled={!canEdit}
              />
              <span>
                {label(
                  "جسر محلي: whatsapp-web.js أو Evolution API للإرسال التلقائي عند صدور الفاتورة.",
                  "Local Bridge: whatsapp-web.js or Evolution API for automated invoice dispatch.",
                )}
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3 font-semibold">
              <input
                type="radio"
                name="whatsappMode"
                value="META"
                aria-label={label("واتساب الرسمي من Meta", "Official Meta Cloud API")}
                className="ds-focus-ring mt-1 h-4 w-4 accent-emerald-600"
                checked={mode === "META"}
                onChange={() => setMode("META")}
                disabled={!canEdit}
              />
              <span>
                {label(
                  "واتساب الرسمي من Meta: الحصة المجانية حتى 1,000 محادثة شهرياً.",
                  "Official Meta WhatsApp Cloud API: free tier up to 1,000 conversations/month.",
                )}
              </span>
            </label>
          </div>
        </SectionCard>

        <SectionCard
          title={label("ربط الجسر المحلي (Webhook / Local Bridge)", "Local Bridge Configuration")}
          subtitle={label(
            "وجّه الجسر إلى POST /api/webhooks/whatsapp مع الترويسة x-bridge-secret، أو أدخل رابط الإرسال الخاص بالجسر.",
            "Point your bridge to POST /api/webhooks/whatsapp with header x-bridge-secret, or configure outbound endpoint below.",
          )}
          icon={<Link2 className="h-4 w-4" aria-hidden />}
          locale={locale}
          headerDivider
        >
          <div className="space-y-3.5">
            <div>
              <label htmlFor="notif-bridge-url" className={LABEL_CLASS}>
                {label("رابط الجسر", "Bridge Endpoint URL")}
              </label>
              <input
                id="notif-bridge-url"
                type="url"
                name="whatsappBridgeUrl"
                aria-label={label("رابط الجسر", "Bridge Endpoint URL")}
                className={INPUT_CLASS}
                dir="ltr"
                defaultValue={bridgeUrl}
                placeholder="https://bridge.internal/message/sendText"
                disabled={!canEdit}
              />
            </div>
            <div>
              <label htmlFor="notif-bridge-secret" className={LABEL_CLASS}>
                {label("سر الربط (Bridge Secret)", "Bridge Shared Secret")}
              </label>
              <input
                id="notif-bridge-secret"
                type="password"
                name="whatsappBridgeSecret"
                aria-label={label("سر الربط", "Bridge Shared Secret")}
                className={INPUT_CLASS}
                dir="ltr"
                placeholder={
                  bridgeSecretSet
                    ? label("•••• محفوظ", "•••• Configured")
                    : label("سر مشترك", "Shared secret")
                }
                autoComplete="off"
                disabled={!canEdit}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="WhatsApp Cloud API (Meta)"
          locale={locale}
          headerDivider
        >
          <div className="space-y-3.5">
            <div>
              <label htmlFor="notif-meta-phone" className={LABEL_CLASS}>
                {label("معرّف رقم الهاتف (Phone Number ID)", "Phone Number ID")}
              </label>
              <input
                id="notif-meta-phone"
                type="text"
                name="metaPhoneNumberId"
                aria-label={label("معرّف رقم الهاتف", "Phone Number ID")}
                className={INPUT_CLASS}
                dir="ltr"
                defaultValue={metaPhoneNumberId}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label htmlFor="notif-meta-token" className={LABEL_CLASS}>
                {label("رمز الوصول (Access Token)", "Access Token")}
              </label>
              <input
                id="notif-meta-token"
                type="password"
                name="metaAccessToken"
                aria-label={label("رمز الوصول", "Access Token")}
                className={INPUT_CLASS}
                dir="ltr"
                placeholder={
                  metaTokenSet
                    ? label("•••• محفوظ", "•••• Configured")
                    : label("رمز Meta", "Meta access token")
                }
                autoComplete="off"
                disabled={!canEdit}
              />
            </div>
          </div>
        </SectionCard>

        {canEdit ? (
          <button
            className={`${btnPrimary} ds-focus-ring`}
            disabled={pending !== ""}
            type="submit"
          >
            {pending === "save"
              ? label("جارٍ الحفظ...", "Saving...")
              : label("حفظ أوضاع واتساب", "Save Notification Settings")}
          </button>
        ) : null}
      </form>
    </div>
  );
}

function NotificationWizardI18n(props: Omit<NotificationWizardProps, "locale">) {
  const { locale } = useI18n();
  return <NotificationWizardBody {...props} locale={locale === "en" ? "en" : "ar"} />;
}

export function NotificationWizard({ locale, ...rest }: NotificationWizardProps) {
  if (locale !== undefined) {
    return <NotificationWizardBody {...rest} locale={locale} />;
  }
  return <NotificationWizardI18n {...rest} />;
}
