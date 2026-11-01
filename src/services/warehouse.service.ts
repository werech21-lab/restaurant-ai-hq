import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { cleanText } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { round3 } from "@/lib/format";
import { runTx, txError } from "@/lib/tx";
import { fail, ok } from "@/lib/types";
import { adjustWarehouseStock, warehouseQuantity } from "@/services/warehouse.engine";

export async function listWarehouses() {
  return prisma.warehouse.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }], take: 50 });
}

export async function warehouseStock(warehouseId: string) {
  return prisma.warehouseStock.findMany({
    where: { warehouseId },
    include: { product: { select: { name: true, code: true, currentStock: true } } },
    orderBy: { product: { name: "asc" } },
  });
}

export async function listTransfers(skip: number, take: number) {
  const [rows, total] = await Promise.all([
    prisma.stockTransfer.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        items: { include: { product: { select: { name: true, code: true } } } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.stockTransfer.count(),
  ]);
  return { rows, total };
}

export async function saveWarehouse(input: { id?: string; name: string; location: string; managerName: string; isDefault: boolean }) {
  const gate = await checkPermission("warehouses", input.id ? "edit" : "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const name = cleanText(input.name, 120);
  if (name.length < 2) return fail("اسم المستودع مطلوب");
  const userId = gate.user.id;
  await prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.warehouse.updateMany({ data: { isDefault: false } });
    if (input.id) {
      await tx.warehouse.update({
        where: { id: input.id },
        data: { name, location: cleanText(input.location, 160), managerName: cleanText(input.managerName, 120), isDefault: input.isDefault },
      });
    } else {
      const count = await tx.warehouse.count();
      await tx.warehouse.create({
        data: {
          name,
          location: cleanText(input.location, 160),
          managerName: cleanText(input.managerName, 120),
          isDefault: input.isDefault || count === 0,
        },
      });
    }
    await writeActivity(tx, {
      userId,
      action: input.id ? "EDIT" : "CREATE",
      module: "warehouses",
      details: `${input.id ? "تعديل" : "إنشاء"} مستودع ${name}`,
    });
  });
  return ok(input.id ? "تم تحديث المستودع" : "تم إنشاء المستودع");
}

export async function transferStock(input: { fromId: string; toId: string; productId: string; quantity: number; note: string }) {
  const gate = await checkPermission("warehouses", "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const quantity = round3(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return fail("أدخل كمية أكبر من صفر");
  if (!input.fromId || !input.toId || input.fromId === input.toId) return fail("اختر مستودعين مختلفين");
  const userId = gate.user.id;
  return runTx(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) txError("الصنف غير موجود");
    const available = await warehouseQuantity(tx, input.fromId, product.id);
    if (available + 0.0001 < quantity) txError("الكمية غير متوفرة في المستودع المصدر");
    const from = await tx.warehouse.findUnique({ where: { id: input.fromId } });
    const to = await tx.warehouse.findUnique({ where: { id: input.toId } });
    if (!from || !to) txError("المستودع غير موجود");
    const fromQty = await adjustWarehouseStock(tx, from.id, product.id, -quantity);
    const toQty = await adjustWarehouseStock(tx, to.id, product.id, quantity);
    const count = await tx.stockTransfer.count();
    const transferNumber = `TR-${String(count + 1).padStart(5, "0")}`;
    await tx.stockTransfer.create({
      data: {
        transferNumber,
        fromWarehouseId: from.id,
        toWarehouseId: to.id,
        note: cleanText(input.note, 200),
        createdById: userId,
        items: { create: [{ productId: product.id, quantity }] },
      },
    });
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: "TRANSFER_OUT",
        quantity,
        balanceAfter: product.currentStock,
        reference: transferNumber,
        note: `تحويل صادر إلى ${to.name}. رصيد المستودع ${fromQty}`,
        warehouseId: from.id,
        createdById: userId,
      },
    });
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: "TRANSFER_IN",
        quantity,
        balanceAfter: product.currentStock,
        reference: transferNumber,
        note: `تحويل وارد من ${from.name}. رصيد المستودع ${toQty}`,
        warehouseId: to.id,
        createdById: userId,
      },
    });
    await writeActivity(tx, {
      userId,
      action: "CREATE",
      module: "warehouses",
      details: `تحويل ${transferNumber}: ${quantity} من ${product.name} من ${from.name} إلى ${to.name}`,
    });
  });
}
