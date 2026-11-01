import type { Prisma } from "@prisma/client";
import { round3 } from "@/lib/format";
import { getActiveScope } from "@/lib/scope";
import { txError } from "@/lib/tx";

type Tx = Prisma.TransactionClient;

export async function resolveWarehouse(tx: Tx, warehouseId?: string) {
  if (warehouseId) {
    const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) txError("المستودع غير موجود");
    return warehouse;
  }
  try {
    const scope = await getActiveScope();
    if (scope.warehouseIds[0]) {
      const scoped = await tx.warehouse.findUnique({ where: { id: scope.warehouseIds[0] } });
      if (scoped) return scoped;
    }
  } catch {
    // Cookie store may be unavailable outside a request; fall through to default.
  }
  const warehouse = await tx.warehouse.findFirst({ where: { isDefault: true } });
  if (!warehouse) txError("عرّف مستودعاً افتراضياً قبل تنفيذ الحركة");
  return warehouse;
}

export async function warehouseQuantity(tx: Tx, warehouseId: string, productId: string) {
  const row = await tx.warehouseStock.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  });
  return row?.quantity ?? 0;
}

export async function adjustWarehouseStock(tx: Tx, warehouseId: string, productId: string, delta: number) {
  const row = await tx.warehouseStock.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  });
  const next = round3((row?.quantity ?? 0) + delta);
  if (next < -0.0001) txError("الكمية غير متوفرة في المستودع المحدد");
  if (row) await tx.warehouseStock.update({ where: { id: row.id }, data: { quantity: next } });
  else await tx.warehouseStock.create({ data: { warehouseId, productId, quantity: next } });
  return next;
}
