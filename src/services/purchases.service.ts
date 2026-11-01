import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { cleanEmail, cleanText, normalizeLines } from "@/lib/documents";
import { paymentStatus, round2 } from "@/lib/format";
import { isModuleEnabled } from "@/lib/modules-db";
import { prisma } from "@/lib/db";
import { runTx, txError } from "@/lib/tx";
import { fail, ok, type ActionResult, type DocumentInput, type PartyInput } from "@/lib/types";
import { postPaymentJournal, postPurchaseJournal } from "@/services/accounting.engine";
import { adjustWarehouseStock, resolveWarehouse } from "@/services/warehouse.engine";

export async function saveSupplier(input: PartyInput): Promise<ActionResult> {
  const gate = await checkPermission("purchases", input.id ? "edit" : "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const name = cleanText(input.name, 120);
  const phone = cleanText(input.phone, 30);
  const email = cleanEmail(input.email);
  if (name.length < 2) return fail("اسم المورد مطلوب");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("البريد الإلكتروني غير صالح");
  const data = {
    name,
    phone,
    email,
    ...(input.customData ? { customData: JSON.stringify(input.customData) } : {}),
  };
  const userId = gate.user.id;
  await prisma.$transaction(async (tx) => {
    if (input.id) await tx.supplier.update({ where: { id: input.id }, data });
    else await tx.supplier.create({ data });
    await writeActivity(tx, {
      userId,
      action: input.id ? "EDIT" : "CREATE",
      module: "purchases",
      details: `${input.id ? "تعديل" : "إنشاء"} مورد: ${name}`,
    });
  });
  return ok(input.id ? "تم تحديث المورد" : "تم إنشاء المورد");
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const gate = await checkPermission("purchases", "delete");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) return fail("المورد غير موجود");
  const orders = await prisma.purchaseOrder.count({ where: { supplierId: id } });
  if (orders > 0) return fail("لا يمكن حذف مورد لديه أوامر شراء");
  const userId = gate.user.id;
  await prisma.$transaction(async (tx) => {
    await tx.supplier.delete({ where: { id } });
    await writeActivity(tx, {
      userId,
      action: "DELETE",
      module: "purchases",
      details: `حذف مورد: ${supplier.name}`,
    });
  });
  return ok("تم حذف المورد");
}

export async function recordSupplierPayment(supplierId: string, amount: number): Promise<ActionResult> {
  const gate = await checkPermission("purchases", "edit");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (!Number.isFinite(amount) || amount <= 0) return fail("أدخل مبلغ دفعة أكبر من صفر");
  const pay = round2(amount);
  const userId = gate.user.id;

  return runTx(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) txError("المورد غير موجود");
    if (pay - supplier.balance > 0.001) txError("المبلغ أكبر من الرصيد المستحق للمورد");
    await tx.supplier.update({
      where: { id: supplierId },
      data: { balance: { decrement: pay } },
    });

    let remaining = pay;
    const orders = await tx.purchaseOrder.findMany({
      where: { supplierId, status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { createdAt: "asc" },
    });
    for (const order of orders) {
      if (remaining <= 0.001) break;
      const due = round2(order.totalAmount - order.paidAmount);
      if (due <= 0) continue;
      const portion = round2(Math.min(due, remaining));
      const paidAmount = round2(order.paidAmount + portion);
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { paidAmount, status: paymentStatus(order.totalAmount, paidAmount) },
      });
      remaining = round2(remaining - portion);
    }

    const payment = await tx.paymentTransaction.create({
      data: {
        type: "PAYMENT",
        partyType: "SUPPLIER",
        partyId: supplier.id,
        amount: pay,
        reference: `PAY-${supplier.id.slice(-6)}`,
        note: `سند صرف للمورد ${supplier.name}`,
        createdById: userId,
      },
    });
    await postPaymentJournal(tx, {
      amount: pay,
      reference: payment.reference || supplier.name,
      referenceId: payment.id,
      createdById: userId,
    });
    await writeActivity(tx, {
      userId,
      action: "PAYMENT",
      module: "purchases",
      details: `صرف ${pay} للمورد ${supplier.name}`,
    });
  });
}

export async function createPurchaseOrder(input: DocumentInput): Promise<ActionResult> {
  const gate = await checkPermission("purchases", "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (!(await isModuleEnabled("purchases"))) return fail("وحدة المشتريات معطلة من مدير التطبيقات");
  if (!input.partyId) return fail("اختر المورد");
  const normalized = normalizeLines(input.items);
  if (!normalized.ok) return fail(normalized.error);
  if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0) return fail("المبلغ المدفوع غير صالح");
  const total = normalized.total;
  const paid = round2(input.paidAmount);
  if (paid - total > 0.001) return fail("المبلغ المدفوع أكبر من إجمالي أمر الشراء");
  const due = round2(total - paid);
  const userId = gate.user.id;

  return runTx(async (tx) => {
    const warehouse = await resolveWarehouse(tx);
    const supplier = await tx.supplier.findUnique({ where: { id: input.partyId } });
    if (!supplier) txError("المورد غير موجود");
    const count = await tx.purchaseOrder.count();
    const orderNumber = `PO-${String(count + 1).padStart(5, "0")}`;
    const order = await tx.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: supplier.id,
        totalAmount: total,
        paidAmount: paid,
        status: paymentStatus(total, paid),
        items: {
          create: normalized.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitCost: line.price,
            totalCost: round2(line.quantity * line.price),
          })),
        },
      },
    });
    for (const line of normalized.lines) {
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (!product) txError("أحد الأصناف لم يعد موجوداً");
      const updated = await tx.product.update({
        where: { id: line.productId },
        data: { currentStock: { increment: line.quantity } },
      });
      await adjustWarehouseStock(tx, warehouse.id, line.productId, line.quantity);
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          type: "IN",
          quantity: line.quantity,
          balanceAfter: updated.currentStock,
          reference: orderNumber,
          note: `أمر شراء ${orderNumber}`,
          warehouseId: warehouse.id,
          createdById: userId,
        },
      });
    }
    if (due > 0) {
      await tx.supplier.update({
        where: { id: supplier.id },
        data: { balance: { increment: due } },
      });
    }
    if (paid > 0) {
      await tx.paymentTransaction.create({
        data: {
          type: "PAYMENT",
          partyType: "SUPPLIER",
          partyId: supplier.id,
          amount: paid,
          reference: orderNumber,
          note: `سند صرف على أمر شراء ${orderNumber}`,
          createdById: userId,
        },
      });
    }
    await writeActivity(tx, {
      userId,
      action: "CREATE",
      module: "purchases",
      details: `أمر شراء ${orderNumber} من المورد ${supplier.name} بإجمالي ${total}`,
    });
    if (total > 0.001) {
      await postPurchaseJournal(tx, {
        orderId: order.id,
        orderNumber,
        total,
        paid,
        due,
        createdById: userId,
      });
    }
  });
}

export async function confirmDraftPurchase(id: string): Promise<ActionResult> {
  const gate = await checkPermission("purchases", "edit");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (!(await isModuleEnabled("purchases"))) return fail("وحدة المشتريات معطلة من مدير التطبيقات");
  const userId = gate.user.id;
  return runTx(async (tx) => {
    const warehouse = await resolveWarehouse(tx);
    const order = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true, supplier: true } });
    if (!order) txError("أمر الشراء غير موجود");
    if (order.status !== "DRAFT") txError("لا يمكن اعتماد أمر ليس مسودة");
    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: paymentStatus(order.totalAmount, order.paidAmount) },
    });
    for (const line of order.items) {
      const updated = await tx.product.update({
        where: { id: line.productId },
        data: { currentStock: { increment: line.quantity } },
      });
      await adjustWarehouseStock(tx, warehouse.id, line.productId, line.quantity);
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          type: "IN",
          quantity: line.quantity,
          balanceAfter: updated.currentStock,
          reference: order.orderNumber,
          note: `اعتماد مسودة ${order.orderNumber}`,
          warehouseId: warehouse.id,
          createdById: userId,
        },
      });
    }
    const due = round2(order.totalAmount - order.paidAmount);
    if (due > 0) {
      await tx.supplier.update({ where: { id: order.supplierId }, data: { balance: { increment: due } } });
    }
    if (order.totalAmount > 0.001) {
      await postPurchaseJournal(tx, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.totalAmount,
        paid: order.paidAmount,
        due,
        createdById: userId,
      });
    }
    await writeActivity(tx, {
      userId,
      action: "EDIT",
      module: "purchases",
      details: `اعتماد مسودة الشراء ${order.orderNumber}`,
    });
  });
}
