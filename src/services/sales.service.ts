import type { Prisma } from "@prisma/client";
import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { cleanEmail, cleanText, normalizeLines } from "@/lib/documents";
import { formatQty, paymentStatus, round2 } from "@/lib/format";
import { isModuleEnabled } from "@/lib/modules-db";
import { prisma } from "@/lib/db";
import { runTx, txError } from "@/lib/tx";
import { fail, ok, type ActionResult, type DocumentInput, type PartyInput } from "@/lib/types";
import { runLowStockRules } from "@/services/automation.engine";
import { notifyInvoiceIssued } from "@/services/notification.service";
import { postReceiptJournal, postSaleJournals } from "@/services/accounting.engine";
import { platformFromOrderType, recordDeliverySale } from "@/services/delivery.service";
import { deductRecipeIngredients } from "@/services/recipe.service";
import { adjustWarehouseStock, resolveWarehouse, warehouseQuantity } from "@/services/warehouse.engine";

export async function saveCustomer(input: PartyInput): Promise<ActionResult> {
  const gate = await checkPermission("sales", input.id ? "edit" : "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const name = cleanText(input.name, 120);
  const phone = cleanText(input.phone, 30);
  const email = cleanEmail(input.email);
  if (name.length < 2) return fail("اسم العميل مطلوب");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("البريد الإلكتروني غير صالح");
  const data = {
    name,
    phone,
    email,
    ...(input.customData ? { customData: JSON.stringify(input.customData) } : {}),
  };
  const userId = gate.user.id;
  await prisma.$transaction(async (tx) => {
    if (input.id) await tx.customer.update({ where: { id: input.id }, data });
    else await tx.customer.create({ data });
    await writeActivity(tx, {
      userId,
      action: input.id ? "EDIT" : "CREATE",
      module: "sales",
      details: `${input.id ? "تعديل" : "إنشاء"} عميل: ${name}`,
    });
  });
  return ok(input.id ? "تم تحديث العميل" : "تم إنشاء العميل");
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const gate = await checkPermission("sales", "delete");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return fail("العميل غير موجود");
  const invoices = await prisma.salesInvoice.count({ where: { customerId: id } });
  if (invoices > 0) return fail("لا يمكن حذف عميل لديه فواتير");
  const userId = gate.user.id;
  await prisma.$transaction(async (tx) => {
    await tx.customer.delete({ where: { id } });
    await writeActivity(tx, {
      userId,
      action: "DELETE",
      module: "sales",
      details: `حذف عميل: ${customer.name}`,
    });
  });
  return ok("تم حذف العميل");
}

export async function recordCustomerPayment(customerId: string, amount: number): Promise<ActionResult> {
  const gate = await checkPermission("sales", "edit");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (!Number.isFinite(amount) || amount <= 0) return fail("أدخل مبلغ تحصيل أكبر من صفر");
  const pay = round2(amount);
  const userId = gate.user.id;

  return runTx(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) txError("العميل غير موجود");
    if (pay - customer.balance > 0.001) txError("المبلغ أكبر من رصيد مديونية العميل");
    await tx.customer.update({
      where: { id: customerId },
      data: { balance: { decrement: pay } },
    });

    let remaining = pay;
    const invoices = await tx.salesInvoice.findMany({
      where: { customerId, status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { createdAt: "asc" },
    });
    for (const invoice of invoices) {
      if (remaining <= 0.001) break;
      const due = round2(invoice.totalAmount - invoice.paidAmount);
      if (due <= 0) continue;
      const portion = round2(Math.min(due, remaining));
      const paidAmount = round2(invoice.paidAmount + portion);
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount, status: paymentStatus(invoice.totalAmount, paidAmount) },
      });
      remaining = round2(remaining - portion);
    }

    const receipt = await tx.paymentTransaction.create({
      data: {
        type: "RECEIPT",
        partyType: "CUSTOMER",
        partyId: customer.id,
        amount: pay,
        reference: `RCPT-${customer.id.slice(-6)}`,
        note: `سند قبض من العميل ${customer.name}`,
        createdById: userId,
      },
    });
    await postReceiptJournal(tx, {
      amount: pay,
      reference: receipt.reference || customer.name,
      referenceId: receipt.id,
      createdById: userId,
    });
    await writeActivity(tx, {
      userId,
      action: "RECEIPT",
      module: "sales",
      details: `تحصيل ${pay} من العميل ${customer.name}`,
    });
  });
}

export async function issueInvoiceWithin(
  tx: Prisma.TransactionClient,
  input: {
    customerId: string;
    userId: string;
    lines: Array<{ productId: string; quantity: number; price: number }>;
    discount: number;
    paid: number;
    method: string;
    source?: string;
    warehouseId?: string;
    customData?: Record<string, string>;
  },
) {
  const warehouse = await resolveWarehouse(tx, input.warehouseId);
  const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) txError("العميل غير موجود");
  const subtotal = round2(input.lines.reduce((sum, line) => sum + line.quantity * line.price, 0));
  const discount = round2(input.discount);
  const total = round2(subtotal - discount);
  const paid = round2(input.paid);
  const due = round2(total - paid);
  let cogs = 0;
  for (const line of input.lines) {
    const product = await tx.product.findUnique({
      where: { id: line.productId },
      include: { menuRecipe: { select: { id: true, active: true } } },
    });
    if (!product) txError("أحد الأصناف لم يعد موجوداً");
    const hasBom = Boolean(product.menuRecipe?.active);
    if (!hasBom) {
      if (product.currentStock + 0.0001 < line.quantity) {
        txError(`الكمية غير متوفرة للصنف ${product.name}. المتاح ${formatQty(product.currentStock)}`);
      }
      const onHand = await warehouseQuantity(tx, warehouse.id, product.id);
      if (onHand + 0.0001 < line.quantity) {
        txError(`الكمية غير متوفرة في ${warehouse.name} للصنف ${product.name}. المتاح ${formatQty(onHand)}`);
      }
      cogs = round2(cogs + line.quantity * product.costPrice);
    }
  }
  const count = await tx.salesInvoice.count();
  const invoiceNumber = `INV-${String(count + 1).padStart(5, "0")}`;
  const invoice = await tx.salesInvoice.create({
    data: {
      invoiceNumber,
      customerId: customer.id,
      subtotal,
      discount,
      totalAmount: total,
      paidAmount: paid,
      status: paymentStatus(total, paid),
      paymentMethod: input.method,
      customData: JSON.stringify(input.customData ?? {}),
      warehouseId: warehouse.id,
      items: {
        create: input.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.price,
          totalPrice: round2(line.quantity * line.price),
        })),
      },
    },
  });
  for (const line of input.lines) {
    const bom = await deductRecipeIngredients(tx, {
      menuProductId: line.productId,
      soldQty: line.quantity,
      warehouseId: warehouse.id,
      userId: input.userId,
      reference: invoiceNumber,
    });
    if (bom.usedRecipe) {
      cogs = round2(cogs + bom.ingredientCost);
      await tx.product.update({
        where: { id: line.productId },
        data: { currentStock: { decrement: line.quantity } },
      });
      continue;
    }
    const updated = await tx.product.update({
      where: { id: line.productId },
      data: { currentStock: { decrement: line.quantity } },
    });
    await adjustWarehouseStock(tx, warehouse.id, line.productId, -line.quantity);
    await tx.stockMovement.create({
      data: {
        productId: line.productId,
        type: "OUT",
        quantity: line.quantity,
        balanceAfter: updated.currentStock,
        reference: invoiceNumber,
        note: `فاتورة مبيعات ${invoiceNumber}`,
        warehouseId: warehouse.id,
        createdById: input.userId,
      },
    });
  }
  const orderType = input.customData?.orderType;
  const platformCode = platformFromOrderType(orderType);
  if (platformCode) {
    await recordDeliverySale(tx, {
      platformCode,
      invoiceId: invoice.id,
      invoiceNumber,
      grossAmount: total,
      brandCode: input.customData?.brandCode,
      branchCode: input.customData?.branchId,
      warehouseId: warehouse.id,
    });
  }
  if (due > 0) {
    await tx.customer.update({ where: { id: customer.id }, data: { balance: { increment: due } } });
  }
  if (paid > 0) {
    await tx.paymentTransaction.create({
      data: {
        type: "RECEIPT",
        partyType: "CUSTOMER",
        partyId: customer.id,
        amount: paid,
        reference: invoiceNumber,
        note: `سند قبض على فاتورة ${invoiceNumber}`,
        createdById: input.userId,
      },
    });
  }
  if (total > 0.001) {
    await postSaleJournals(tx, {
      invoiceId: invoice.id,
      invoiceNumber,
      total,
      paid,
      due,
      cogs,
      paymentMethod: input.method,
      createdById: input.userId,
    });
  }
  await writeActivity(tx, {
    userId: input.userId,
    action: "CREATE",
    module: input.source === "pos" ? "pos" : "sales",
    details: `فاتورة ${invoiceNumber} للعميل ${customer.name} بصافي ${total}`,
  });
  for (const line of input.lines) await runLowStockRules(tx, line.productId, input.userId);
  return invoice;
}

export async function createSalesInvoice(input: DocumentInput): Promise<ActionResult> {
  const salesGate = await checkPermission("sales", "create");
  const gate = salesGate.allowed ? salesGate : await checkPermission("pos", "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const moduleKey = input.source === "pos" ? "pos" : "sales";
  if (!(await isModuleEnabled(moduleKey))) return fail("هذه الوحدة معطلة من مدير التطبيقات");
  if (!input.partyId) return fail("اختر العميل");
  const normalized = normalizeLines(input.items);
  if (!normalized.ok) return fail(normalized.error);
  const discount = round2(input.discount ?? 0);
  if (!Number.isFinite(discount) || discount < 0) return fail("الخصم غير صالح");
  if (discount - normalized.total > 0.001) return fail("الخصم أكبر من إجمالي الأصناف");
  if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0) return fail("المبلغ المحصّل غير صالح");
  const subtotal = normalized.total;
  const total = round2(subtotal - discount);
  const paid = round2(input.paidAmount);
  if (paid - total > 0.001) return fail("المبلغ المحصّل أكبر من صافي الفاتورة");
  const due = round2(total - paid);
  const method = input.paymentMethod ?? (paid <= 0.001 ? "CREDIT" : due <= 0.001 ? "CASH" : "MIXED");
  if (method === "CREDIT" && paid > 0.001) return fail("البيع الآجل لا يحصّل مبلغاً فورياً");
  if ((method === "CASH" || method === "CARD") && due > 0.001) return fail("الدفع النقدي أو بالبطاقة يجب أن يغطي صافي الفاتورة");
  const userId = gate.user.id;
  let invoiceId = "";

  const result = await runTx(async (tx) => {
    const invoice = await issueInvoiceWithin(tx, {
      customerId: input.partyId,
      userId,
      lines: normalized.lines.map((line) => ({ productId: line.productId, quantity: line.quantity, price: line.price })),
      discount,
      paid,
      method,
      source: input.source,
      warehouseId: input.warehouseId,
      customData: input.customData,
    });
    invoiceId = invoice.id;
  });
  if (!result.ok) return result;
  await notifyInvoiceIssued(invoiceId).catch(() => undefined);
  return { ok: true, id: invoiceId, message: "تم إصدار الفاتورة وخصم المخزون وإنشاء القيد المحاسبي" };
}
