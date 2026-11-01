import type { Prisma } from "@prisma/client";
import { round2, round3 } from "@/lib/format";

type Tx = Prisma.TransactionClient;

export async function runLowStockRules(tx: Tx, productId: string, userId: string) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product || product.currentStock > product.reorderLevel + 0.0001) return;
  const rules = await tx.automationRule.findMany({
    where: { isActive: true, trigger: "STOCK_BELOW_REORDER", action: "DRAFT_PURCHASE" },
  });
  for (const rule of rules) {
    if (!rule.supplierId) continue;
    const existing = await tx.purchaseOrderItem.findFirst({
      where: { productId: product.id, purchaseOrder: { status: "DRAFT" } },
    });
    if (existing) {
      await tx.systemNotification.create({
        data: {
          title: "مخزون تحت حد الطلب",
          body: `${product.name} تحت حد الطلب، وتوجد مسودة شراء مسبقاً.`,
          href: "/purchases?status=DRAFT",
        },
      });
      continue;
    }
    const supplier = await tx.supplier.findUnique({ where: { id: rule.supplierId } });
    if (!supplier) continue;
    const quantity = round3(Math.max(product.reorderLevel * 2 - product.currentStock, 1));
    const count = await tx.purchaseOrder.count();
    const orderNumber = `PO-${String(count + 1).padStart(5, "0")}`;
    const total = round2(quantity * product.costPrice);
    await tx.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: supplier.id,
        totalAmount: total,
        paidAmount: 0,
        status: "DRAFT",
        items: {
          create: [{ productId: product.id, quantity, unitCost: product.costPrice, totalCost: total }],
        },
      },
    });
    await tx.activityLog.create({
      data: {
        userId,
        action: "AUTO",
        module: "automations",
        details: `قاعدة ${rule.name}: مسودة ${orderNumber} للصنف ${product.name} بكمية ${quantity}`,
      },
    });
    await tx.systemNotification.create({
      data: {
        title: "مسودة شراء تلقائية",
        body: `أُنشئت ${orderNumber} لأن ${product.name} نزل تحت حد الطلب.`,
        href: "/purchases?status=DRAFT",
      },
    });
  }
}
