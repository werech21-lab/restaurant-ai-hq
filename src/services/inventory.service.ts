import { Prisma } from "@prisma/client";
import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { cleanText } from "@/lib/documents";
import { round2, round3 } from "@/lib/format";
import { prisma } from "@/lib/db";
import { runTx, txError } from "@/lib/tx";
import { fail, ok, type ActionResult } from "@/lib/types";
import { adjustWarehouseStock, resolveWarehouse } from "@/services/warehouse.engine";

export type CategoryInput = { id?: string; name: string; description: string };
export type ProductInput = {
  id?: string;
  code: string;
  name: string;
  categoryId: string;
  costPrice: number;
  sellingPrice: number;
  openingStock?: number;
  reorderLevel: number;
  customData?: Record<string, string>;
};

export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  const gate = await checkPermission("inventory", input.id ? "edit" : "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const name = cleanText(input.name, 80);
  const description = cleanText(input.description, 240);
  if (name.length < 2) return fail("اسم القسم يجب أن يكون حرفين على الأقل");
  const userId = gate.user.id;

  await prisma.$transaction(async (tx) => {
    if (input.id) await tx.category.update({ where: { id: input.id }, data: { name, description } });
    else await tx.category.create({ data: { name, description } });
    await writeActivity(tx, {
      userId,
      action: input.id ? "EDIT" : "CREATE",
      module: "inventory",
      details: `${input.id ? "تعديل" : "إنشاء"} قسم: ${name}`,
    });
  });
  return ok(input.id ? "تم تحديث القسم" : "تم إنشاء القسم");
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const gate = await checkPermission("inventory", "delete");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return fail("القسم غير موجود");
  const products = await prisma.product.count({ where: { categoryId: id } });
  if (products > 0) return fail("لا يمكن حذف قسم يحتوي على أصناف");
  const userId = gate.user.id;
  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id } });
    await writeActivity(tx, {
      userId,
      action: "DELETE",
      module: "inventory",
      details: `حذف قسم: ${category.name}`,
    });
  });
  return ok("تم حذف القسم");
}

export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  const gate = await checkPermission("inventory", input.id ? "edit" : "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");

  const code = cleanText(input.code, 40).toUpperCase();
  const name = cleanText(input.name, 120);
  if (code.length < 2) return fail("رمز الصنف مطلوب");
  if (name.length < 2) return fail("اسم الصنف مطلوب");
  if (!input.categoryId) return fail("اختر القسم");
  if (!Number.isFinite(input.costPrice) || input.costPrice < 0) return fail("سعر التكلفة غير صالح");
  if (!Number.isFinite(input.sellingPrice) || input.sellingPrice < 0) return fail("سعر البيع غير صالح");
  if (!Number.isFinite(input.reorderLevel) || input.reorderLevel < 0) return fail("حد الطلب غير صالح");

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) return fail("القسم غير موجود");

  const costPrice = round2(input.costPrice);
  const sellingPrice = round2(input.sellingPrice);
  const reorderLevel = round3(input.reorderLevel);
  const userId = gate.user.id;

  try {
    if (input.id) {
      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: input.id },
          data: {
            code,
            name,
            categoryId: category.id,
            costPrice,
            sellingPrice,
            reorderLevel,
            ...(input.customData ? { customData: JSON.stringify(input.customData) } : {}),
          },
        });
        await writeActivity(tx, {
          userId,
          action: "EDIT",
          module: "inventory",
          details: `تعديل صنف ${code} - ${name}`,
        });
      });
      return ok("تم تحديث الصنف");
    }

    const openingStock = round3(input.openingStock ?? 0);
    if (!Number.isFinite(openingStock) || openingStock < 0) return fail("الرصيد الافتتاحي غير صالح");
    const result = await runTx(async (tx) => {
      const warehouse = await resolveWarehouse(tx);
      const product = await tx.product.create({
        data: {
          code,
          name,
          categoryId: category.id,
          costPrice,
          sellingPrice,
          openingStock,
          currentStock: openingStock,
          reorderLevel,
          customData: JSON.stringify(input.customData ?? {}),
        },
      });
      if (openingStock > 0) await adjustWarehouseStock(tx, warehouse.id, product.id, openingStock);
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: "OPENING",
          quantity: openingStock,
          balanceAfter: openingStock,
          reference: "OPENING",
          note: "رصيد افتتاحي",
          warehouseId: warehouse.id,
          createdById: userId,
        },
      });
      await writeActivity(tx, {
        userId,
        action: "CREATE",
        module: "inventory",
        details: `صنف جديد ${code} برصيد افتتاحي ${openingStock}`,
      });
    });
    if (!result.ok) return result;
    return ok("تم إنشاء الصنف وتسجيل الرصيد الافتتاحي");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("رمز الصنف مستخدم مسبقاً");
    }
    throw error;
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const gate = await checkPermission("inventory", "delete");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const [otherMoves, purchaseItems, salesItems] = await Promise.all([
    prisma.stockMovement.count({ where: { productId: id, type: { not: "OPENING" } } }),
    prisma.purchaseOrderItem.count({ where: { productId: id } }),
    prisma.salesInvoiceItem.count({ where: { productId: id } }),
  ]);
  if (otherMoves || purchaseItems || salesItems) {
    return fail("لا يمكن حذف صنف مرتبط بفواتير أو حركات مخزون");
  }
  const userId = gate.user.id;
  return runTx(async (tx) => {
    const product = await tx.product.findUnique({ where: { id } });
    if (!product) txError("الصنف غير موجود");
    await tx.stockMovement.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
    await writeActivity(tx, {
      userId,
      action: "DELETE",
      module: "inventory",
      details: `حذف صنف ${product.code} - ${product.name}`,
    });
  });
}
