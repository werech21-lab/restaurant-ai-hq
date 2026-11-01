"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { detectTelegramAction, saveNotificationsAction } from "@/app/actions/notifications";
import { Alert, btnPrimary, cardClass, fieldClass, labelClass } from "@/components/erp-ui";

export function NotificationWizard({
  chatId,
  chatName,
  maskedToken,
  whatsappMode,
  bridgeUrl,
  bridgeSecretSet,
  metaPhoneNumberId,
  metaTokenSet,
  canEdit,
}: {
  chatId: string;
  chatName: string;
  maskedToken: string;
  whatsappMode: string;
  bridgeUrl: string;
  bridgeSecretSet: boolean;
  metaPhoneNumberId: string;
  metaTokenSet: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(whatsappMode || "CLICK");
  const [detectedId, setDetectedId] = useState(chatId);
  const [detectedName, setDetectedName] = useState(chatName);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");

  async function detect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const token = String(new FormData(event.currentTarget).get("token") ?? "");
    setPending("telegram");
    setError("");
    setMessage("");
    const result = await detectTelegramAction(token);
    setPending("");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDetectedId(result.id || "");
    setMessage(result.message || "تم الربط");
    router.refresh();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const form = new FormData(event.currentTarget);
    setPending("save");
    setError("");
    setMessage("");
    const result = await saveNotificationsAction({
      whatsappMode: String(form.get("whatsappMode") ?? "CLICK"),
      whatsappBridgeUrl: String(form.get("whatsappBridgeUrl") ?? ""),
      whatsappBridgeSecret: String(form.get("whatsappBridgeSecret") ?? ""),
      metaPhoneNumberId: String(form.get("metaPhoneNumberId") ?? ""),
      metaAccessToken: String(form.get("metaAccessToken") ?? ""),
    });
    setPending("");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message || "تم الحفظ");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <section className={`${cardClass} space-y-3 p-5`}>
        <h2 className="font-bold">ربط تليجرام بنقرة واحدة</h2>
        <p className="text-sm text-slate-600">افتح @BotFather في تليجرام وأرسل /newbot، ثم انسخ التوكن والصقه هنا. أرسل أي كلمة للبوت واضغط زر الجلب التلقائي.</p>
        <form onSubmit={detect} className="space-y-3">
          <label className={labelClass}>
            Telegram Bot Token
            <input name="token" className={fieldClass} dir="ltr" placeholder={maskedToken || "123456:ABC..."} autoComplete="off" disabled={!canEdit} />
          </label>
          <label className={labelClass}>
            معرف المحادثة
            <input className={fieldClass} dir="ltr" value={detectedId} readOnly placeholder="يُملأ تلقائياً" />
          </label>
          <p className="text-sm font-semibold text-slate-700">{detectedName ? `الحساب: ${detectedName}` : "لم يُجلب حساب بعد"}</p>
          {canEdit ? (
            <button className={btnPrimary} disabled={pending !== ""} type="submit">
              {pending === "telegram" ? "جارٍ الجلب..." : "جلب معرف المحادثة تلقائياً (Auto-Detect Chat ID)"}
            </button>
          ) : null}
        </form>
      </section>
      <form onSubmit={save} className="space-y-4">
        <section className={`${cardClass} space-y-3 p-5`}>
          <h2 className="font-bold">واتساب المجاني</h2>
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input type="radio" name="whatsappMode" value="CLICK" checked={mode === "CLICK"} onChange={() => setMode("CLICK")} disabled={!canEdit} />
            <span>الوضع المجاني الفوري: زر يفتح محادثة العميل عبر wa.me دون اشتراك.</span>
          </label>
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input type="radio" name="whatsappMode" value="BRIDGE" checked={mode === "BRIDGE"} onChange={() => setMode("BRIDGE")} disabled={!canEdit} />
            <span>جسر محلي مجاني: whatsapp-web.js أو Evolution API يرسل تلقائياً عند صدور الفاتورة.</span>
          </label>
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input type="radio" name="whatsappMode" value="META" checked={mode === "META"} onChange={() => setMode("META")} disabled={!canEdit} />
            <span>واتساب الرسمي من Meta: الحصة المجانية حتى 1000 محادثة شهرياً.</span>
          </label>
        </section>
        <section className={`${cardClass} space-y-3 p-5`}>
          <h2 className="font-bold">ربط واتساب المجاني عبر QR (Webhook / Local Bridge)</h2>
          <p className="text-sm text-slate-600">
            وجّه الجسر إلى POST /api/webhooks/whatsapp مع الترويسة x-bridge-secret، أو ضع رابط الإرسال الخاص بالجسر ليرسل النظام إليه عند كل فاتورة.
          </p>
          <label className={labelClass}>
            رابط الجسر
            <input name="whatsappBridgeUrl" className={fieldClass} dir="ltr" defaultValue={bridgeUrl} placeholder="http://127.0.0.1:8080/message/sendText" disabled={!canEdit} />
          </label>
          <label className={labelClass}>
            سر الربط
            <input name="whatsappBridgeSecret" className={fieldClass} dir="ltr" placeholder={bridgeSecretSet ? "•••• محفوظ" : "سر مشترك"} autoComplete="off" disabled={!canEdit} />
          </label>
        </section>
        <section className={`${cardClass} space-y-3 p-5`}>
          <h2 className="font-bold">WhatsApp Cloud API</h2>
          <label className={labelClass}>
            Phone Number ID
            <input name="metaPhoneNumberId" className={fieldClass} dir="ltr" defaultValue={metaPhoneNumberId} disabled={!canEdit} />
          </label>
          <label className={labelClass}>
            Access Token
            <input name="metaAccessToken" className={fieldClass} dir="ltr" placeholder={metaTokenSet ? "•••• محفوظ" : "رمز Meta"} autoComplete="off" disabled={!canEdit} />
          </label>
        </section>
        {canEdit ? (
          <button className={btnPrimary} disabled={pending !== ""} type="submit">
            {pending === "save" ? "جارٍ الحفظ..." : "حفظ أوضاع واتساب"}
          </button>
        ) : null}
      </form>
    </div>
  );
}
