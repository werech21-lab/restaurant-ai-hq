import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { getCompany } from "@/lib/company";
import { prisma } from "@/lib/db";
import { paymentStatus, round2 } from "@/lib/format";
import { GATEWAY_PROVIDERS, PAYMENT_METHODS, parseMethods } from "@/lib/gateways";
import { txError } from "@/lib/tx";
import { fail, type ActionResult } from "@/lib/types";
import { ACCOUNTS, postEntry, postReceiptJournal } from "@/services/accounting.engine";

const LINK_MS = 7 * 24 * 60 * 60 * 1000;

function token() {
  return randomBytes(18).toString("base64url");
}

function sign(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function same(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function actorId(userId?: string) {
  if (userId) return userId;
  const payments = await checkPermission("payments", "create");
  if (payments.allowed && payments.user) return payments.user.id;
  const sales = await checkPermission("sales", "create");
  if (sales.allowed && sales.user) return sales.user.id;
  return null;
}

async function canManageGateways() {
  const payments = await checkPermission("payments", "edit");
  if (payments.allowed && payments.user) return payments.user;
  const saas = await checkPermission("saas", "edit");
  if (saas.allowed && saas.user) return saas.user;
  return null;
}

export async function listGatewayConfigs() {
  const payments = await checkPermission("payments", "view");
  const saas = await checkPermission("saas", "view");
  if ((!payments.allowed || !payments.user) && (!saas.allowed || !saas.user)) return [];
  return prisma.paymentGatewayConfig.findMany({ orderBy: { provider: "asc" } });
}

export async function saveGatewayConfig(input: {
  provider: string;
  apiKey: string;
  webhookSecret: string;
  isTestMode: boolean;
  isActive: boolean;
  supportedMethods: string[];
}): Promise<ActionResult> {
  const user = await canManageGateways();
  if (!user) return fail("ليست لديك صلاحية تعديل بوابات الدفع");
  if (!GATEWAY_PROVIDERS.includes(input.provider as (typeof GATEWAY_PROVIDERS)[number])) {
    return fail("مزود البوابة غير معروف");
  }
  const methods = input.supportedMethods.filter((item) =>
    PAYMENT_METHODS.includes(item as (typeof PAYMENT_METHODS)[number]),
  );
  if (methods.length === 0) return fail("اختر وسيلة دفع واحدة على الأقل");
  const existing = await prisma.paymentGatewayConfig.findUnique({ where: { provider: input.provider } });
  const apiKey = input.apiKey.trim() || existing?.apiKey || "";
  const webhookSecret = input.webhookSecret.trim() || existing?.webhookSecret || "";
  if (!apiKey || !webhookSecret) return fail("مفتاح البوابة وسر الويب هوك مطلوبان");
  await prisma.$transaction(async (tx) => {
    await tx.paymentGatewayConfig.upsert({
      where: { provider: input.provider },
      update: {
        apiKey,
        webhookSecret,
        isTestMode: input.isTestMode,
        isActive: input.isActive,
        supportedMethods: JSON.stringify(methods),
      },
      create: {
        provider: input.provider,
        apiKey,
        webhookSecret,
        isTestMode: input.isTestMode,
        isActive: input.isActive,
        supportedMethods: JSON.stringify(methods),
      },
    });
    await writeActivity(tx, {
      userId: user.id,
      action: "EDIT",
      module: "payments",
      details: `تحديث بوابة ${input.provider}`,
    });
  });
  return { ok: true, message: "تم حفظ إعدادات البوابة" };
}

export async function listPaymentLinks(skip: number, take: number, q: string) {
  const payments = await checkPermission("payments", "view");
  const sales = await checkPermission("sales", "view");
  if ((!payments.allowed || !payments.user) && (!sales.allowed || !sales.user)) {
    return { rows: [], total: 0 };
  }
  const where = q
    ? {
        OR: [
          { token: { contains: q } },
          { gatewayProvider: { contains: q } },
          { invoice: { invoiceNumber: { contains: q } } },
          { organization: { name: { contains: q } } },
        ],
      }
    : {};
  const [total, rows] = await Promise.all([
    prisma.paymentLink.count({ where }),
    prisma.paymentLink.findMany({
      where,
      include: {
        invoice: { select: { invoiceNumber: true, customer: { select: { name: true, phone: true } } } },
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);
  return { rows, total };
}

async function activeGateway(provider?: string) {
  if (provider) {
    return prisma.paymentGatewayConfig.findFirst({ where: { provider, isActive: true } });
  }
  return prisma.paymentGatewayConfig.findFirst({ where: { isActive: true }, orderBy: { provider: "asc" } });
}

export async function createInvoicePayLink(ref: { invoiceId?: string; invoiceNumber?: string }): Promise<ActionResult> {
  const userId = await actorId();
  if (!userId) return fail("ليست لديك صلاحية إنشاء رابط دفع");
  const invoice = await prisma.salesInvoice.findFirst({
    where: ref.invoiceId ? { id: ref.invoiceId } : { invoiceNumber: ref.invoiceNumber ?? "" },
    include: { customer: true },
  });
  if (!invoice) return fail("الفاتورة غير موجودة");
  const due = round2(invoice.totalAmount - invoice.paidAmount);
  if (due <= 0.001) return fail("الفاتورة مسددة ولا تحتاج رابط دفع");
  const existing = await prisma.paymentLink.findFirst({
    where: { invoiceId: invoice.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { ok: true, token: existing.token, id: existing.id, message: "رابط الدفع الحالي جاهز" };
  const gateway = await activeGateway();
  if (!gateway) return fail("فعّل بوابة دفع واحدة على الأقل");
  const company = await getCompany();
  const organization = await prisma.organization.findFirst({ where: { isDefault: true } });
  const created = await prisma.$transaction(async (tx) => {
    const link = await tx.paymentLink.create({
      data: {
        token: token(),
        invoiceId: invoice.id,
        organizationId: organization?.id,
        amount: due,
        currency: company.currency || "KWD",
        status: "PENDING",
        gatewayProvider: gateway.provider,
      },
    });
    await writeActivity(tx, {
      userId,
      action: "CREATE",
      module: "payments",
      details: `رابط دفع للفاتورة ${invoice.invoiceNumber}`,
    });
    return link;
  });
  return { ok: true, token: created.token, id: created.id, message: "تم إنشاء رابط الدفع" };
}

export async function createSubscriptionPayLink(organizationId: string, amount: number): Promise<ActionResult> {
  const userId = await actorId();
  if (!userId) return fail("ليست لديك صلاحية إنشاء رابط دفع");
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) return fail("الشركة غير موجودة");
  const value = round2(amount);
  if (value <= 0) return fail("أدخل مبلغ اشتراك أكبر من صفر");
  const gateway = await activeGateway();
  if (!gateway) return fail("فعّل بوابة دفع واحدة على الأقل");
  const existing = await prisma.paymentLink.findFirst({
    where: { organizationId: org.id, invoiceId: null, status: "PENDING", amount: value },
  });
  if (existing) return { ok: true, token: existing.token, id: existing.id, message: "رابط الاشتراك الحالي جاهز" };
  const created = await prisma.$transaction(async (tx) => {
    const link = await tx.paymentLink.create({
      data: {
        token: token(),
        organizationId: org.id,
        amount: value,
        currency: org.currency || "KWD",
        status: "PENDING",
        gatewayProvider: gateway.provider,
      },
    });
    await writeActivity(tx, {
      userId,
      action: "CREATE",
      module: "payments",
      details: `رابط اشتراك لـ ${org.name}`,
    });
    return link;
  });
  return { ok: true, token: created.token, id: created.id, message: "تم إنشاء رابط الاشتراك" };
}

export async function getPublicPayment(tokenValue: string) {
  const link = await prisma.paymentLink.findUnique({
    where: { token: tokenValue },
    include: {
      invoice: { include: { customer: true } },
      organization: true,
    },
  });
  if (!link) return null;
  if (link.status === "PENDING" && Date.now() - link.createdAt.getTime() > LINK_MS) {
    await prisma.paymentLink.update({ where: { id: link.id }, data: { status: "EXPIRED" } });
    link.status = "EXPIRED";
  }
  const gateway = await prisma.paymentGatewayConfig.findUnique({ where: { provider: link.gatewayProvider } });
  return {
    link,
    methods: parseMethods(gateway?.supportedMethods ?? "[]"),
    isTestMode: gateway?.isTestMode ?? true,
    providerActive: Boolean(gateway?.isActive),
  };
}

async function settleWithin(
  tokenValue: string,
  method: string,
  externalReference: string,
) {
  return prisma.$transaction(async (tx) => {
    const link = await tx.paymentLink.findUnique({ where: { token: tokenValue } });
    if (!link) txError("رابط الدفع غير موجود");
    if (link.status === "PAID") return link;
    if (link.status !== "PENDING") txError("رابط الدفع غير قابل للتحصيل");
    if (Date.now() - link.createdAt.getTime() > LINK_MS) {
      await tx.paymentLink.update({ where: { id: link.id }, data: { status: "EXPIRED" } });
      txError("انتهت صلاحية رابط الدفع");
    }
    const actor = await tx.user.findFirst({ where: { isActive: true, role: { isAdmin: true } } });
    if (!actor) txError("لا يوجد مدير نظام لتسجيل القيد");
    const pay = round2(link.amount);
    if (link.invoiceId) {
      const invoice = await tx.salesInvoice.findUnique({
        where: { id: link.invoiceId },
        include: { customer: true },
      });
      if (!invoice) txError("الفاتورة المرتبطة لم تعد موجودة");
      const due = round2(invoice.totalAmount - invoice.paidAmount);
      if (Math.abs(due - pay) > 0.02) txError("تغير المتبقي على الفاتورة. أنشئ رابطاً جديداً");
      if (invoice.customer.balance + 0.001 < pay) txError("رصيد العميل أقل من مبلغ الرابط");
      const paidAmount = round2(invoice.paidAmount + pay);
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount, status: paymentStatus(invoice.totalAmount, paidAmount) },
      });
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: { balance: { decrement: pay } },
      });
      const receipt = await tx.paymentTransaction.create({
        data: {
          type: "RECEIPT",
          partyType: "CUSTOMER",
          partyId: invoice.customerId,
          amount: pay,
          reference: invoice.invoiceNumber,
          note: `تحصيل إلكتروني ${method} عبر ${link.gatewayProvider}`,
          createdById: actor.id,
        },
      });
      await postReceiptJournal(tx, {
        amount: pay,
        reference: invoice.invoiceNumber,
        referenceId: receipt.id,
        createdById: actor.id,
        method: "BANK",
      });
    } else if (link.organizationId) {
      const org = await tx.organization.findUnique({ where: { id: link.organizationId } });
      if (!org) txError("شركة الاشتراك غير موجودة");
      const start = org.subscriptionEndsAt && org.subscriptionEndsAt.getTime() > Date.now() ? org.subscriptionEndsAt : new Date();
      const next = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
      await tx.organization.update({
        where: { id: org.id },
        data: { subscriptionEndsAt: next, isActive: true },
      });
      await postEntry(tx, {
        description: `اشتراك ${org.name}`,
        referenceType: "SUBSCRIPTION",
        referenceId: link.id,
        createdById: actor.id,
        lines: [
          { code: ACCOUNTS.bank, debit: pay, credit: 0 },
          { code: ACCOUNTS.sales, debit: 0, credit: pay },
        ],
      });
    } else {
      txError("الرابط غير مرتبط بفاتورة أو اشتراك");
    }
    const paid = await tx.paymentLink.update({
      where: { id: link.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        method,
        externalReference,
      },
    });
    await writeActivity(tx, {
      userId: actor.id,
      action: "RECEIPT",
      module: "payments",
      details: `تحصيل رابط ${link.token.slice(0, 8)} بمبلغ ${pay}`,
    });
    return paid;
  });
}

export async function checkoutPaymentLink(tokenValue: string, method: string): Promise<ActionResult> {
  if (!PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) return fail("وسيلة الدفع غير مدعومة");
  const link = await prisma.paymentLink.findUnique({ where: { token: tokenValue } });
  if (!link) return fail("رابط الدفع غير موجود");
  if (link.status === "PAID") return { ok: true, message: "تم تأكيد هذا الدفع سابقاً" };
  const gateway = await prisma.paymentGatewayConfig.findUnique({ where: { provider: link.gatewayProvider } });
  if (!gateway || !gateway.isActive) return fail("بوابة الدفع غير مفعّلة");
  if (!parseMethods(gateway.supportedMethods).includes(method)) return fail("هذه الوسيلة غير مفعّلة على البوابة");
  if (!gateway.isTestMode) {
    return fail("التشغيل الحي ينتظر تأكيد البوابة على مسار الويب هوك، ولا يُحصَّل المبلغ من هذه الشاشة");
  }
  try {
    const reference = `TEST-${gateway.provider}-${randomBytes(4).toString("hex")}`;
    await settleWithin(tokenValue, method, reference);
    return { ok: true, message: "تم تأكيد الدفع التجريبي وترحيل القيد على البنك" };
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    const marker = text.indexOf("ERR:");
    if (marker >= 0) return fail(text.slice(marker + 4).split("\n")[0] || "تعذر التحصيل");
    throw error;
  }
}

export async function applyWebhook(raw: string, signature: string): Promise<ActionResult> {
  let body: { token?: string; provider?: string; method?: string; externalReference?: string; status?: string };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return fail("جسم الويب هوك غير صالح");
  }
  if (!body.token || !body.provider) return fail("الرمز والمزود مطلوبان");
  if (body.status && body.status !== "PAID") return fail("الحالة الواردة ليست مدفوعة");
  const gateway = await prisma.paymentGatewayConfig.findUnique({ where: { provider: body.provider } });
  if (!gateway?.webhookSecret) return fail("سر الويب هوك غير مضبوط");
  if (!same(signature, sign(gateway.webhookSecret, raw))) return fail("توقيع الويب هوك غير مطابق");
  const link = await prisma.paymentLink.findUnique({ where: { token: body.token } });
  if (!link || link.gatewayProvider !== body.provider) return fail("الرابط لا يطابق البوابة");
  const method = body.method && PAYMENT_METHODS.includes(body.method as (typeof PAYMENT_METHODS)[number]) ? body.method : "VISA_MASTER";
  if (link.status === "PAID") return { ok: true, message: "تم تسجيل الدفع سابقاً" };
  try {
    await settleWithin(body.token, method, body.externalReference || `WH-${randomBytes(4).toString("hex")}`);
    return { ok: true, message: "تم تأكيد الدفع من الويب هوك" };
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    const marker = text.indexOf("ERR:");
    if (marker >= 0) return fail(text.slice(marker + 4).split("\n")[0] || "تعذر التحصيل");
    throw error;
  }
}
