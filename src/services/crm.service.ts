import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { cleanEmail, cleanText } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/format";
import { isModuleEnabled } from "@/lib/modules-db";
import { runTx, txError } from "@/lib/tx";
import { fail, ok } from "@/lib/types";
import { notifyInvoiceIssued } from "@/services/notification.service";
import { issueInvoiceWithin } from "@/services/sales.service";

const STAGES = ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;

export async function listLeads() {
  return prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { assignedTo: { select: { name: true } } },
  });
}

export async function listQuotations(skip: number, take: number, q: string) {
  const where = q
    ? {
        OR: [
          { quoteNumber: { contains: q } },
          { customer: { name: { contains: q } } },
          { lead: { title: { contains: q } } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        lead: { select: { title: true } },
        items: { include: { product: { select: { name: true, code: true } } } },
      },
    }),
    prisma.quotation.count({ where }),
  ]);
  return { rows, total };
}

export async function saveLead(input: {
  id?: string;
  title: string;
  contactName: string;
  phone: string;
  email: string;
  expectedValue: number;
  stage: string;
  notes: string;
}) {
  const gate = await checkPermission("crm", input.id ? "edit" : "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (!(await isModuleEnabled("crm"))) return fail("وحدة علاقات العملاء معطلة");
  const title = cleanText(input.title, 160);
  const contactName = cleanText(input.contactName, 120);
  if (title.length < 2 || contactName.length < 2) return fail("عنوان الفرصة واسم جهة الاتصال مطلوبان");
  const stage = (STAGES as readonly string[]).includes(input.stage) ? input.stage : "NEW";
  const email = cleanEmail(input.email);
  const data = {
    title,
    contactName,
    phone: cleanText(input.phone, 30),
    email,
    expectedValue: round2(Number(input.expectedValue) || 0),
    stage,
    notes: cleanText(input.notes, 500),
    assignedToId: gate.user.id,
  };
  if (input.id) await prisma.lead.update({ where: { id: input.id }, data });
  else await prisma.lead.create({ data });
  await prisma.activityLog.create({
    data: {
      userId: gate.user.id,
      action: input.id ? "EDIT" : "CREATE",
      module: "crm",
      details: `${input.id ? "تعديل" : "إنشاء"} فرصة: ${title}`,
    },
  });
  return ok("تم حفظ الفرصة البيعية");
}

export async function moveLead(id: string, stage: string) {
  const gate = await checkPermission("crm", "edit");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (!(STAGES as readonly string[]).includes(stage)) return fail("مرحلة غير معروفة");
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return fail("الفرصة غير موجودة");
  await prisma.lead.update({ where: { id }, data: { stage } });
  await prisma.activityLog.create({
    data: { userId: gate.user.id, action: "EDIT", module: "crm", details: `نقل الفرصة ${lead.title} إلى ${stage}` },
  });
  return ok("تم تحديث المرحلة");
}

export async function saveQuotation(input: {
  customerId?: string;
  leadId?: string;
  validUntil?: string;
  notes: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
}) {
  const gate = await checkPermission("crm", "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (input.items.length === 0) return fail("أضف صنفاً واحداً على الأقل");
  const lines = input.items.map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity),
    price: Number(item.price),
  }));
  if (lines.some((line) => !line.productId || !(line.quantity > 0) || !(line.price >= 0))) return fail("بنود العرض غير صالحة");
  const total = round2(lines.reduce((sum, line) => sum + line.quantity * line.price, 0));
  const userId = gate.user.id;
  return runTx(async (tx) => {
    const count = await tx.quotation.count();
    const quoteNumber = `QT-${String(count + 1).padStart(5, "0")}`;
    await tx.quotation.create({
      data: {
        quoteNumber,
        customerId: input.customerId || null,
        leadId: input.leadId || null,
        totalAmount: total,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        status: "DRAFT",
        notes: cleanText(input.notes, 400),
        createdById: userId,
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.price,
            totalPrice: round2(line.quantity * line.price),
          })),
        },
      },
    });
    await writeActivity(tx, { userId, action: "CREATE", module: "crm", details: `عرض سعر ${quoteNumber} بإجمالي ${total}` });
  });
}

export async function markQuotationSent(id: string) {
  const gate = await checkPermission("crm", "edit");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const quote = await prisma.quotation.findUnique({ where: { id } });
  if (!quote) return fail("العرض غير موجود");
  if (quote.status === "CONVERTED") return fail("العرض محوّل إلى فاتورة");
  await prisma.quotation.update({ where: { id }, data: { status: "SENT" } });
  return ok("تم تعليم العرض كمُرسل");
}

export async function convertQuotation(id: string) {
  const gate = await checkPermission("crm", "create");
  const salesGate = gate.allowed ? gate : await checkPermission("sales", "create");
  if (!salesGate.allowed || !salesGate.user) return fail(salesGate.message || "ممنوع");
  const userId = salesGate.user.id;
  let invoiceId = "";
  const result = await runTx(async (tx) => {
    const quote = await tx.quotation.findUnique({
      where: { id },
      include: { items: true, lead: true, customer: true },
    });
    if (!quote) txError("عرض السعر غير موجود");
    if (quote.status === "CONVERTED") txError("تم تحويل هذا العرض مسبقاً");
    if (quote.items.length === 0) txError("العرض لا يحتوي أصنافاً");
    let customerId = quote.customerId;
    if (!customerId) {
      if (!quote.lead) txError("اربط العرض بعميل أو بفرصة بيعية قبل التحويل");
      const created = await tx.customer.create({
        data: {
          name: quote.lead.contactName,
          phone: quote.lead.phone,
          email: quote.lead.email,
          balance: 0,
        },
      });
      customerId = created.id;
      await writeActivity(tx, {
        userId,
        action: "CREATE",
        module: "crm",
        details: `تحويل العميل المحتمل ${quote.lead.contactName} إلى عميل فعلي`,
      });
    }
    const invoice = await issueInvoiceWithin(tx, {
      customerId,
      userId,
      lines: quote.items.map((item) => ({ productId: item.productId, quantity: item.quantity, price: item.unitPrice })),
      discount: 0,
      paid: 0,
      method: "CREDIT",
      source: "sales",
    });
    invoiceId = invoice.id;
    await tx.quotation.update({
      where: { id: quote.id },
      data: { status: "CONVERTED", customerId },
    });
    if (quote.leadId) await tx.lead.update({ where: { id: quote.leadId }, data: { stage: "WON" } });
    await writeActivity(tx, {
      userId,
      action: "CREATE",
      module: "crm",
      details: `تحويل عرض ${quote.quoteNumber} إلى فاتورة ${invoice.invoiceNumber}`,
    });
  });
  if (!result.ok) return result;
  await notifyInvoiceIssued(invoiceId).catch(() => undefined);
  return { ok: true as const, id: invoiceId, message: "تم تحويل العرض إلى فاتورة وخصم المخزون وترحيل القيد" };
}
