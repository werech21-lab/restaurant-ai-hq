import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { prisma } from "@/lib/db";
import { cleanText } from "@/lib/documents";
import { formatMoney, formatQty } from "@/lib/format";
import { fail, type ActionResult } from "@/lib/types";
import { invoiceText, phoneDigits } from "@/lib/whatsapp";

const MODES = ["CLICK", "BRIDGE", "META"] as const;
const TOKEN_PATTERN = /^\d{6,}:[A-Za-z0-9_-]{20,}$/;

export type NotificationView = {
  telegramConfigured: boolean;
  telegramChatId: string;
  telegramChatName: string;
  maskedToken: string;
  whatsappMode: string;
  whatsappBridgeUrl: string;
  bridgeSecretSet: boolean;
  metaPhoneNumberId: string;
  metaTokenSet: boolean;
  publicBaseUrl: string;
};

async function ensureSettings() {
  return prisma.notificationSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

function mask(value: string) {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

async function editor() {
  const saas = await checkPermission("saas", "edit");
  if (saas.allowed && saas.user) return saas.user;
  const payments = await checkPermission("payments", "edit");
  if (payments.allowed && payments.user) return payments.user;
  return null;
}

export async function getNotificationSettings(): Promise<NotificationView | null> {
  const saas = await checkPermission("saas", "view");
  const payments = await checkPermission("payments", "view");
  if ((!saas.allowed || !saas.user) && (!payments.allowed || !payments.user)) return null;
  const row = await ensureSettings();
  return {
    telegramConfigured: Boolean(row.telegramBotToken),
    telegramChatId: row.telegramChatId,
    telegramChatName: row.telegramChatName,
    maskedToken: mask(row.telegramBotToken),
    whatsappMode: row.whatsappMode,
    whatsappBridgeUrl: row.whatsappBridgeUrl,
    bridgeSecretSet: Boolean(row.whatsappBridgeSecret),
    metaPhoneNumberId: row.metaPhoneNumberId,
    metaTokenSet: Boolean(row.metaAccessToken),
    publicBaseUrl: row.publicBaseUrl,
  };
}

async function telegramCall(token: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: Array<{ message?: { chat?: { id?: number; title?: string; username?: string; first_name?: string } } }>;
  };
  return payload;
}

export async function detectTelegramChat(rawToken: string): Promise<ActionResult> {
  const user = await editor();
  if (!user) return fail("ليست لديك صلاحية ربط تليجرام");
  const current = await ensureSettings();
  const token = rawToken.trim() || current.telegramBotToken;
  if (!TOKEN_PATTERN.test(token)) return fail("صيغة توكن البوت غير صالحة. انسخه من BotFather كما هو");
  let payload: Awaited<ReturnType<typeof telegramCall>>;
  try {
    payload = await telegramCall(token, "getUpdates");
  } catch {
    return fail("تعذر الاتصال بتليجرام. تحقق من الشبكة ثم أعد المحاولة");
  }
  if (!payload.ok) return fail(payload.description || "رفض تليجرام التوكن");
  const updates = payload.result ?? [];
  const chat = [...updates].reverse().find((item) => item.message?.chat?.id)?.message?.chat;
  if (!chat?.id) {
    await prisma.notificationSetting.update({ where: { id: "default" }, data: { telegramBotToken: token } });
    return fail("حُفظ التوكن، لكن لا توجد رسالة بعد. أرسل أي كلمة للبوت ثم اضغط الجلب مرة أخرى");
  }
  const chatId = String(chat.id);
  const chatName = chat.title || chat.username || chat.first_name || "حساب تليجرام";
  let welcome = "";
  try {
    const sent = await telegramCall(token, "sendMessage", {
      chat_id: chatId,
      text: `تم ربط نظام AetherBI ERP مع ${chatName}. ستصلك تنبيهات الفواتير من هنا.`,
    });
    welcome = sent.ok ? " ووصلت رسالة الترحيب" : "";
  } catch {
    welcome = "";
  }
  await prisma.$transaction(async (tx) => {
    await tx.notificationSetting.update({
      where: { id: "default" },
      data: { telegramBotToken: token, telegramChatId: chatId, telegramChatName: chatName },
    });
    await writeActivity(tx, {
      userId: user.id,
      action: "EDIT",
      module: "saas",
      details: `ربط تليجرام مع ${chatName}`,
    });
  });
  return { ok: true, id: chatId, message: `تم جلب المحادثة ${chatName}${welcome}` };
}

export async function saveNotificationSettings(input: {
  whatsappMode: string;
  whatsappBridgeUrl: string;
  whatsappBridgeSecret: string;
  metaPhoneNumberId: string;
  metaAccessToken: string;
}): Promise<ActionResult> {
  const user = await editor();
  if (!user) return fail("ليست لديك صلاحية حفظ الإشعارات");
  if (!MODES.includes(input.whatsappMode as (typeof MODES)[number])) return fail("وضع واتساب غير معروف");
  const bridgeUrl = cleanText(input.whatsappBridgeUrl, 300);
  if (bridgeUrl && !/^https?:\/\//.test(bridgeUrl)) return fail("رابط جسر واتساب يجب أن يبدأ بـ http أو https");
  if (bridgeUrl.includes("/api/webhooks/whatsapp")) return fail("لا توجّه الجسر إلى نقطة الاتصال الداخلية نفسها");
  const current = await ensureSettings();
  const secret = input.whatsappBridgeSecret.trim() || current.whatsappBridgeSecret;
  const metaToken = input.metaAccessToken.trim() || current.metaAccessToken;
  await prisma.$transaction(async (tx) => {
    await tx.notificationSetting.update({
      where: { id: "default" },
      data: {
        whatsappMode: input.whatsappMode,
        whatsappBridgeUrl: bridgeUrl,
        whatsappBridgeSecret: secret,
        metaPhoneNumberId: cleanText(input.metaPhoneNumberId, 40),
        metaAccessToken: metaToken,
        publicBaseUrl: "https://erp.aetherbi.com",
      },
    });
    await writeActivity(tx, {
      userId: user.id,
      action: "EDIT",
      module: "saas",
      details: `تحديث وضع واتساب إلى ${input.whatsappMode}`,
    });
  });
  return { ok: true, message: "تم حفظ إعدادات الإشعارات" };
}

async function sendTelegramText(text: string) {
  const row = await prisma.notificationSetting.findUnique({ where: { id: "default" } });
  if (!row?.telegramBotToken || !row.telegramChatId) return;
  await telegramCall(row.telegramBotToken, "sendMessage", { chat_id: row.telegramChatId, text });
}

async function sendMeta(phone: string, text: string, phoneNumberId: string, accessToken: string) {
  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("meta");
}

async function sendBridge(url: string, secret: string, phone: string, text: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
      "x-bridge-secret": secret,
    },
    body: JSON.stringify({ phone, text }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("bridge");
}

export async function deliverWhatsApp(phone: string, text: string): Promise<ActionResult> {
  const row = await ensureSettings();
  const digits = phoneDigits(phone);
  if (digits.length < 8) return fail("رقم واتساب غير صالح");
  if (row.whatsappMode === "CLICK") return { ok: true, message: "وضع النقر يفتح واتساب من المتصفح" };
  try {
    if (row.whatsappMode === "META") {
      if (!row.metaPhoneNumberId || !row.metaAccessToken) return fail("أكمل Phone Number ID و Access Token");
      await sendMeta(digits, text, row.metaPhoneNumberId, row.metaAccessToken);
      return { ok: true, message: "أُرسلت الرسالة عبر واتساب الرسمي" };
    }
    if (!row.whatsappBridgeUrl || !row.whatsappBridgeSecret) return fail("أكمل رابط الجسر وسر الربط");
    await sendBridge(row.whatsappBridgeUrl, row.whatsappBridgeSecret, digits, text);
    return { ok: true, message: "أُرسلت الرسالة إلى جسر واتساب المحلي" };
  } catch {
    return fail("تعذر الإرسال التلقائي. رابط النقر ما زال متاحاً بجانب الفاتورة");
  }
}

export async function receiveWhatsAppWebhook(secret: string, phone: string, text: string): Promise<ActionResult> {
  const row = await ensureSettings();
  if (!row.whatsappBridgeSecret || secret !== row.whatsappBridgeSecret) return fail("سر جسر واتساب غير مطابق");
  return deliverWhatsApp(phone, text);
}

export async function notifyInvoiceIssued(invoiceId: string) {
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      items: { include: { product: true } },
      paymentLinks: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!invoice) return;
  const pay = invoice.paymentLinks[0] ? `https://erp.aetherbi.com/pay/${invoice.paymentLinks[0].token}` : "";
  const text = invoiceText({
    customerName: invoice.customer.name,
    number: invoice.invoiceNumber,
    lines: invoice.items.map((item) => ({
      name: item.product.name,
      quantity: formatQty(item.quantity),
      total: formatMoney(item.totalPrice),
    })),
    total: formatMoney(invoice.totalAmount),
    payUrl: pay,
  });
  try {
    await sendTelegramText(`فاتورة جديدة ${invoice.invoiceNumber}\n${invoice.customer.name}\n${formatMoney(invoice.totalAmount)}${pay ? `\n${pay}` : ""}`);
  } catch {
    return;
  }
  if (!invoice.customer.phone) return;
  const row = await prisma.notificationSetting.findUnique({ where: { id: "default" } });
  if (!row || row.whatsappMode === "CLICK") return;
  await deliverWhatsApp(invoice.customer.phone, text);
}

export async function notifyWebsiteLead(input: { name: string; phone: string; title: string }) {
  const text = `طلب من aetherbi.com\n${input.name}\n${input.phone}\n${input.title}`;
  try {
    await sendTelegramText(text);
  } catch {
    return;
  }
  if (!input.phone) return;
  const row = await prisma.notificationSetting.findUnique({ where: { id: "default" } });
  if (!row || row.whatsappMode === "CLICK") return;
  await deliverWhatsApp(input.phone, text);
}
