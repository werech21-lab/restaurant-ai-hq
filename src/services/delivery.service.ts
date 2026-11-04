import { writeActivity } from '@/lib/activity'
import { checkPermission } from '@/lib/erp-auth'
import { prisma } from '@/lib/db'
import { round3 } from '@/lib/format'
import { isModuleEnabled } from '@/lib/modules-db'
import { runTx, txError } from '@/lib/tx'
import { fail, ok } from '@/lib/types'
import { ACCOUNTS, postEntry } from '@/services/accounting.engine'
import type { Prisma } from '@prisma/client'

export const DELIVERY_PLATFORMS = [
  { code: 'TALABAT', nameAr: 'طلبات', nameEn: 'Talabat', commissionPercent: 22, fixedFeeKwd: 0, sortOrder: 1 },
  { code: 'DELIVEROO', nameAr: 'ديليفرو', nameEn: 'Deliveroo', commissionPercent: 25, fixedFeeKwd: 0, sortOrder: 2 },
  { code: 'JAHEZ', nameAr: 'جاهز', nameEn: 'Jahez', commissionPercent: 18, fixedFeeKwd: 0, sortOrder: 3 },
  { code: 'SNOONU', nameAr: 'سنونو', nameEn: 'Snoonu', commissionPercent: 20, fixedFeeKwd: 0, sortOrder: 5 },
  { code: 'KEETA', nameAr: 'كيتا', nameEn: 'Keeta', commissionPercent: 21, fixedFeeKwd: 0, sortOrder: 6 },
  { code: 'IN_HOUSE', nameAr: 'توصيل الفرع', nameEn: 'In-House Delivery', commissionPercent: 0, fixedFeeKwd: 0.25, sortOrder: 5 },
] as const

export type AggregatorCode = (typeof DELIVERY_PLATFORMS)[number]['code']

const ORDER_TYPE_TO_PLATFORM: Record<string, AggregatorCode> = {
  talabat: 'TALABAT',
  deliveroo: 'DELIVEROO',
  jahez: 'JAHEZ',
  in_house: 'IN_HOUSE',
  delivery: 'IN_HOUSE',
  aggregator: 'TALABAT',
}

export function platformFromOrderType(orderType?: string | null): AggregatorCode | null {
  if (!orderType) return null
  return ORDER_TYPE_TO_PLATFORM[orderType] ?? null
}

export async function ensureDeliveryPlatforms() {
  for (const row of DELIVERY_PLATFORMS) {
    const existing = await prisma.deliveryPlatform.findUnique({ where: { code: row.code } })
    if (existing) continue
    await prisma.deliveryPlatform.create({ data: { ...row, isActive: true } })
  }
}

async function ensureCommissionAccount(tx: Prisma.TransactionClient) {
  const code = '5300'
  const existing = await tx.account.findUnique({ where: { code } })
  if (existing) return existing
  return tx.account.create({
    data: { code, name: 'عمولات منصات التوصيل', type: 'EXPENSE', balance: 0 },
  })
}

async function ensureAggregatorReceivable(tx: Prisma.TransactionClient) {
  const code = '1500'
  const existing = await tx.account.findUnique({ where: { code } })
  if (existing) return existing
  return tx.account.create({
    data: { code, name: 'ذمم منصات التوصيل', type: 'ASSET', balance: 0 },
  })
}

export function computePayout(input: {
  gross: number
  commissionPercent: number
  fixedFeeKwd: number
  deliveryFee?: number
  marketingDiscount?: number
}) {
  const gross = round3(input.gross)
  const commissionAmount = round3(gross * (input.commissionPercent / 100) + input.fixedFeeKwd)
  const deliveryFee = round3(input.deliveryFee ?? 0)
  const marketingDiscount = round3(input.marketingDiscount ?? 0)
  const netPayout = round3(gross - commissionAmount - marketingDiscount + deliveryFee)
  return { gross, commissionAmount, deliveryFee, marketingDiscount, netPayout }
}

export async function listPlatforms() {
  await ensureDeliveryPlatforms()
  return prisma.deliveryPlatform.findMany({ orderBy: { sortOrder: 'asc' } })
}

export async function updatePlatform(input: {
  code: string
  commissionPercent: number
  fixedFeeKwd: number
  isActive?: boolean
}) {
  const gate = await checkPermission('delivery-hub', 'edit')
  if (!gate.allowed || !gate.user) return fail(gate.message || 'ممنوع')
  await ensureDeliveryPlatforms()
  await prisma.deliveryPlatform.update({
    where: { code: input.code },
    data: {
      commissionPercent: Math.max(0, input.commissionPercent),
      fixedFeeKwd: Math.max(0, input.fixedFeeKwd),
      isActive: input.isActive !== false,
    },
  })
  return ok('تم التحديث')
}

export async function aggregatorSummary(scope?: {
  brandCode?: string | null
  branchCode?: string | null
  warehouseIds?: string[]
}) {
  await ensureDeliveryPlatforms()
  const platforms = await prisma.deliveryPlatform.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  const where: Prisma.DeliveryOrderWhereInput = {
    status: 'OPEN',
    ...(scope?.brandCode ? { brandCode: scope.brandCode } : {}),
    ...(scope?.branchCode ? { branchCode: scope.branchCode } : {}),
    ...(scope?.warehouseIds?.length ? { warehouseId: { in: scope.warehouseIds } } : {}),
  }
  const open = await prisma.deliveryOrder.findMany({ where })
  return platforms.map((platform) => {
    const rows = open.filter((row) => row.platformCode === platform.code)
    const gross = round3(rows.reduce((s, r) => s + r.grossAmount, 0))
    const commission = round3(rows.reduce((s, r) => s + r.commissionAmount, 0))
    const deliveryFee = round3(rows.reduce((s, r) => s + r.deliveryFee, 0))
    const discounts = round3(rows.reduce((s, r) => s + r.marketingDiscount, 0))
    const net = round3(rows.reduce((s, r) => s + r.netPayout, 0))
    return {
      ...platform,
      orderCount: rows.length,
      grossSales: gross,
      commissionTotal: commission,
      deliveryFeeTotal: deliveryFee,
      marketingDiscountTotal: discounts,
      netPayout: net,
    }
  })
}

export async function listOpenOrders(scope?: {
  brandCode?: string | null
  branchCode?: string | null
  warehouseIds?: string[]
  platformCode?: string
}) {
  return prisma.deliveryOrder.findMany({
    where: {
      status: 'OPEN',
      ...(scope?.platformCode ? { platformCode: scope.platformCode } : {}),
      ...(scope?.brandCode ? { brandCode: scope.brandCode } : {}),
      ...(scope?.branchCode ? { branchCode: scope.branchCode } : {}),
      ...(scope?.warehouseIds?.length ? { warehouseId: { in: scope.warehouseIds } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

/** Called from sales tx when POS/sales order type maps to an aggregator. */
export async function recordDeliverySale(
  tx: Prisma.TransactionClient,
  input: {
    platformCode: AggregatorCode
    invoiceId: string
    invoiceNumber: string
    grossAmount: number
    brandCode?: string | null
    branchCode?: string | null
    warehouseId?: string | null
  },
) {
  let platform = await tx.deliveryPlatform.findUnique({ where: { code: input.platformCode } })
  if (!platform) {
    const seed = DELIVERY_PLATFORMS.find((row) => row.code === input.platformCode)
    if (!seed) return null
    platform = await tx.deliveryPlatform.create({ data: { ...seed, isActive: true } })
  }
  if (!platform.isActive) return null
  const payout = computePayout({
    gross: input.grossAmount,
    commissionPercent: platform.commissionPercent,
    fixedFeeKwd: platform.fixedFeeKwd,
  })
  return tx.deliveryOrder.create({
    data: {
      platformCode: platform.code,
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      brandCode: input.brandCode || null,
      branchCode: input.branchCode || null,
      warehouseId: input.warehouseId || null,
      grossAmount: payout.gross,
      commissionAmount: payout.commissionAmount,
      deliveryFee: payout.deliveryFee,
      marketingDiscount: payout.marketingDiscount,
      netPayout: payout.netPayout,
      status: 'OPEN',
    },
  })
}

export async function settlePlatform(input: { platformCode: string; brandCode?: string | null }) {
  const gate = await checkPermission('delivery-hub', 'create')
  if (!gate.allowed || !gate.user) return fail(gate.message || 'ممنوع')
  if (!(await isModuleEnabled('delivery-hub'))) return fail('وحدة منصات التوصيل معطلة')
  await ensureDeliveryPlatforms()

  let settlementId = ''
  const result = await runTx(async (tx) => {
    await ensureCommissionAccount(tx)
    await ensureAggregatorReceivable(tx)
    const platform = await tx.deliveryPlatform.findUnique({ where: { code: input.platformCode } })
    if (!platform) txError('المنصة غير موجودة')
    const open = await tx.deliveryOrder.findMany({
      where: {
        platformCode: input.platformCode,
        status: 'OPEN',
        ...(input.brandCode ? { brandCode: input.brandCode } : {}),
      },
    })
    if (!open.length) txError('لا توجد طلبات مفتوحة للتسوية')
    const gross = round3(open.reduce((s, r) => s + r.grossAmount, 0))
    const commission = round3(open.reduce((s, r) => s + r.commissionAmount, 0))
    const deliveryFee = round3(open.reduce((s, r) => s + r.deliveryFee, 0))
    const discounts = round3(open.reduce((s, r) => s + r.marketingDiscount, 0))
    const net = round3(open.reduce((s, r) => s + r.netPayout, 0))
    if (net < -0.001) txError('صافي التسوية سالب — راجع العمولات والخصومات')

    const periodLabel = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date())

    const settlement = await tx.deliverySettlement.create({
      data: {
        platformCode: platform.code,
        brandCode: input.brandCode || null,
        periodLabel,
        grossAmount: gross,
        commissionAmount: commission,
        deliveryFee,
        marketingDiscount: discounts,
        netPayout: net,
        status: 'POSTED',
        createdById: gate.user!.id,
      },
    })
    settlementId = settlement.id

    const bankDebit = Math.max(net, 0)
    const expenseDebit = round3(commission + discounts)
    const receivableCredit = round3(bankDebit + expenseDebit)
    const entry = await postEntry(tx, {
      description: `تسوية منصة ${platform.nameAr} · ${periodLabel}`,
      referenceType: 'DELIVERY_SETTLEMENT',
      referenceId: settlement.id,
      createdById: gate.user!.id,
      lines: [
        { code: ACCOUNTS.bank, debit: bankDebit, credit: 0 },
        { code: '5300', debit: expenseDebit, credit: 0 },
        { code: '1500', debit: 0, credit: receivableCredit },
      ].filter((line) => line.debit > 0.0001 || line.credit > 0.0001),
    })

    await tx.deliverySettlement.update({
      where: { id: settlement.id },
      data: { journalEntryId: entry.id },
    })
    await tx.deliveryOrder.updateMany({
      where: { id: { in: open.map((row) => row.id) } },
      data: { status: 'SETTLED', settledAt: new Date(), settlementId: settlement.id },
    })
    await writeActivity(tx, {
      userId: gate.user!.id,
      action: 'CREATE',
      module: 'delivery-hub',
      details: `تسوية ${platform.nameAr}: صافي ${net} د.ك`,
    })
  })
  if (!result.ok) return result
  return { ok: true as const, id: settlementId, message: 'تم تسجيل التسوية' }
}
