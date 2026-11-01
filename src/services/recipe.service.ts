import { writeActivity } from '@/lib/activity'
import { checkPermission } from '@/lib/erp-auth'
import { cleanText } from '@/lib/documents'
import { prisma } from '@/lib/db'
import { formatQty, round3 } from '@/lib/format'
import { isModuleEnabled } from '@/lib/modules-db'
import { runTx, txError } from '@/lib/tx'
import { fail, ok } from '@/lib/types'
import { adjustWarehouseStock, warehouseQuantity } from '@/services/warehouse.engine'
import type { Prisma } from '@prisma/client'

export const FOOD_COST_ALERT = 32

export type RecipeCostRow = {
  id: string
  name: string
  nameEn: string
  brandCode: string | null
  menuProductId: string
  menuCode: string
  menuName: string
  sellingPrice: number
  ingredientCost: number
  foodCostPercent: number
  marginPercent: number
  targetFoodCostPercent: number
  overTarget: boolean
  lineCount: number
  active: boolean
}

function portionQty(base: number, wastagePercent: number) {
  return round3(base * (1 + Math.max(0, wastagePercent) / 100))
}

export async function computeRecipeIngredientCost(
  lines: Array<{ quantity: number; wastagePercent: number; ingredient: { costPrice: number } }>,
  recipeWastagePercent = 0,
) {
  const raw = lines.reduce((sum, line) => {
    const qty = portionQty(line.quantity, line.wastagePercent)
    return sum + qty * line.ingredient.costPrice
  }, 0)
  return round3(raw * (1 + Math.max(0, recipeWastagePercent) / 100))
}

export async function listRecipeCosts(options?: { brandCode?: string | null; q?: string }) {
  const where: Prisma.RecipeWhereInput = {
    ...(options?.brandCode ? { brandCode: options.brandCode } : {}),
    ...(options?.q
      ? {
          OR: [
            { name: { contains: options.q } },
            { nameEn: { contains: options.q } },
            { menuProduct: { name: { contains: options.q } } },
            { menuProduct: { code: { contains: options.q } } },
          ],
        }
      : {}),
  }
  const rows = await prisma.recipe.findMany({
    where,
    include: {
      menuProduct: { select: { id: true, code: true, name: true, sellingPrice: true } },
      lines: { include: { ingredient: { select: { costPrice: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  return rows.map((row): RecipeCostRow => {
    const ingredientCost = round3(
      row.lines.reduce((sum, line) => sum + portionQty(line.quantity, line.wastagePercent) * line.ingredient.costPrice, 0) *
        (1 + Math.max(0, row.wastagePercent) / 100),
    )
    const selling = row.menuProduct.sellingPrice || 0
    const foodCostPercent = selling > 0 ? round3((ingredientCost / selling) * 100) : 0
    const marginPercent = round3(100 - foodCostPercent)
    const target = row.targetFoodCostPercent || FOOD_COST_ALERT
    return {
      id: row.id,
      name: row.name,
      nameEn: row.nameEn,
      brandCode: row.brandCode,
      menuProductId: row.menuProductId,
      menuCode: row.menuProduct.code,
      menuName: row.menuProduct.name,
      sellingPrice: selling,
      ingredientCost,
      foodCostPercent,
      marginPercent,
      targetFoodCostPercent: target,
      overTarget: foodCostPercent > target,
      lineCount: row.lines.length,
      active: row.active,
    }
  })
}

export async function getRecipe(id: string) {
  return prisma.recipe.findUnique({
    where: { id },
    include: {
      menuProduct: true,
      lines: { include: { ingredient: true }, orderBy: { ingredient: { name: 'asc' } } },
    },
  })
}

export async function saveRecipe(input: {
  id?: string
  menuProductId: string
  name: string
  nameEn?: string
  brandCode?: string
  wastagePercent?: number
  targetFoodCostPercent?: number
  active?: boolean
  lines: Array<{ ingredientProductId: string; quantity: number; unit: string; wastagePercent?: number }>
}) {
  const gate = await checkPermission('recipes', input.id ? 'edit' : 'create')
  if (!gate.allowed || !gate.user) return fail(gate.message || 'ممنوع')
  if (!(await isModuleEnabled('recipes'))) return fail('وحدة الوصفات معطلة')
  const name = cleanText(input.name, 160)
  if (!name) return fail('اسم الوصفة مطلوب')
  if (!input.menuProductId) return fail('اختر صنف المنيو')
  if (!input.lines.length) return fail('أضف مكوّناً واحداً على الأقل')
  for (const line of input.lines) {
    if (!line.ingredientProductId) return fail('مكوّن غير صالح')
    if (!(line.quantity > 0)) return fail('كمية المكوّن يجب أن تكون موجبة')
    if (line.ingredientProductId === input.menuProductId) return fail('لا يمكن أن يكون صنف المنيو مكوّناً في وصفته')
  }

  let recipeId = input.id || ''
  const result = await runTx(async (tx) => {
    const menu = await tx.product.findUnique({ where: { id: input.menuProductId } })
    if (!menu) txError('صنف المنيو غير موجود')
    const data = {
      name,
      nameEn: cleanText(input.nameEn || '', 160),
      brandCode: input.brandCode || null,
      wastagePercent: Math.max(0, input.wastagePercent ?? 0),
      targetFoodCostPercent: Math.max(1, input.targetFoodCostPercent ?? FOOD_COST_ALERT),
      active: input.active !== false,
      menuProductId: input.menuProductId,
    }
    if (input.id) {
      await tx.recipeLine.deleteMany({ where: { recipeId: input.id } })
      await tx.recipe.update({ where: { id: input.id }, data })
      recipeId = input.id
    } else {
      const created = await tx.recipe.create({ data })
      recipeId = created.id
    }
    await tx.recipeLine.createMany({
      data: input.lines.map((line) => ({
        recipeId,
        ingredientProductId: line.ingredientProductId,
        quantity: round3(line.quantity),
        unit: cleanText(line.unit || 'g', 8) || 'g',
        wastagePercent: Math.max(0, line.wastagePercent ?? 0),
      })),
    })
    await writeActivity(tx, {
      userId: gate.user!.id,
      action: input.id ? 'UPDATE' : 'CREATE',
      module: 'recipes',
      details: `وصفة ${name}`,
    })
  })
  if (!result.ok) return result
  return { ok: true as const, id: recipeId, message: 'تم حفظ الوصفة' }
}

export async function deleteRecipe(id: string) {
  const gate = await checkPermission('recipes', 'delete')
  if (!gate.allowed || !gate.user) return fail(gate.message || 'ممنوع')
  const result = await runTx(async (tx) => {
    const row = await tx.recipe.findUnique({ where: { id } })
    if (!row) txError('الوصفة غير موجودة')
    await tx.recipe.delete({ where: { id } })
    await writeActivity(tx, {
      userId: gate.user!.id,
      action: 'DELETE',
      module: 'recipes',
      details: `حذف وصفة ${row.name}`,
    })
  })
  return result.ok ? ok('تم الحذف') : result
}

/** Atomic BOM explosion + ingredient stock deduction inside an open sales transaction. */
export async function deductRecipeIngredients(
  tx: Prisma.TransactionClient,
  input: {
    menuProductId: string
    soldQty: number
    warehouseId: string
    userId: string
    reference: string
  },
) {
  const recipe = await tx.recipe.findUnique({
    where: { menuProductId: input.menuProductId },
    include: { lines: { include: { ingredient: true } } },
  })
  if (!recipe || !recipe.active || recipe.lines.length === 0) return { usedRecipe: false, ingredientCost: 0 }

  let ingredientCost = 0
  const recipeFactor = 1 + Math.max(0, recipe.wastagePercent) / 100
  for (const line of recipe.lines) {
    const perPortion = portionQty(line.quantity, line.wastagePercent) * recipeFactor
    const need = round3(perPortion * input.soldQty)
    if (need <= 0) continue
    const onHand = await warehouseQuantity(tx, input.warehouseId, line.ingredientProductId)
    if (onHand + 0.0001 < need) {
      txError(
        `نقص مكوّن ${line.ingredient.name} للوصفة. المطلوب ${formatQty(need)} والمتاح ${formatQty(onHand)}`,
      )
    }
    const updated = await tx.product.update({
      where: { id: line.ingredientProductId },
      data: { currentStock: { decrement: need } },
    })
    await adjustWarehouseStock(tx, input.warehouseId, line.ingredientProductId, -need)
    await tx.stockMovement.create({
      data: {
        productId: line.ingredientProductId,
        type: 'OUT',
        quantity: need,
        balanceAfter: updated.currentStock,
        reference: input.reference,
        note: `خصم وصفة BOM · ${recipe.name} · ${input.reference}`,
        warehouseId: input.warehouseId,
        createdById: input.userId,
      },
    })
    ingredientCost = round3(ingredientCost + need * line.ingredient.costPrice)
  }
  return { usedRecipe: true, ingredientCost }
}
