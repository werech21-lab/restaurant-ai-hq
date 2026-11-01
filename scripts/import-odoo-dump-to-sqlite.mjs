/**
 * Promote Odoo dump products + partners into Prisma SQLite for panel POS/inventory/CRM.
 * Source: backups/odoo-full-dump/venturefoods_odoo_cids1_dump.json (or VENTURE_ODOO_DUMP).
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')

const dumpPath =
  process.env.VENTURE_ODOO_DUMP ||
  path.join(process.cwd(), 'backups', 'odoo-full-dump', 'venturefoods_odoo_cids1_dump.json')

function money(value) {
  const n = typeof value === 'number' ? value : Number(String(value ?? 0).replace(/,/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : 0
}

function skuOf(row, id) {
  const raw = String(row.default_code || `ODOO-${id}`).toUpperCase().replace(/[^A-Z0-9._-]/g, '').slice(0, 40)
  return raw || `ODOO-${id}`
}

function categoryBucket(name) {
  const n = String(name || '').toLowerCase()
  if (/drink|مشروب|juice|شاي|قهوة|كرك|cola|water|ماء|smoothie/.test(n)) return 'المشروبات'
  if (/dessert|حلويات|cake|آيس|ice|sweet|كنافة/.test(n)) return 'الحلويات'
  if (/extra|إضافة|sauce|صلصة|modifier|add.?on|side|جانب/.test(n)) return 'الإضافات'
  return 'الوجبات الرئيسية'
}

async function main() {
  if (!fs.existsSync(dumpPath)) {
    console.error('Dump not found:', dumpPath)
    process.exit(1)
  }
  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'))
  const models = dump.models || {}
  const products = Array.isArray(models['product.template']) ? models['product.template'] : []
  const partners = Array.isArray(models['res.partner']) ? models['res.partner'] : []
  const quants = Array.isArray(models['stock.quant']) ? models['stock.quant'] : []
  const stockByProduct = new Map()
  for (const q of quants) {
    const pid = Array.isArray(q.product_id) ? q.product_id[0] : q.product_id
    const qty = Number(q.quantity) || 0
    if (!pid) continue
    stockByProduct.set(pid, (stockByProduct.get(pid) || 0) + qty)
  }

  const prisma = new PrismaClient()
  const admin = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
  if (!admin) throw new Error('No active user for stock movements')

  const categoryIds = new Map()
  for (const name of ['الوجبات الرئيسية', 'المشروبات', 'الحلويات', 'الإضافات']) {
    const existing = await prisma.category.findFirst({ where: { name } })
    const row = existing ?? (await prisma.category.create({ data: { name, description: `Odoo · ${name}` } }))
    categoryIds.set(name, row.id)
  }

  let upsertedProducts = 0
  const sellable = products.filter((p) => p && p.active !== false && money(p.list_price) > 0)
  for (const row of sellable.slice(0, 800)) {
    const code = skuOf(row, row.id)
    const name = String(row.name || code).slice(0, 200)
    const cat = categoryBucket(name)
    const price = money(row.list_price)
    const cost = money(row.standard_price ?? price * 0.55)
    const open = Math.max(0, Math.round(stockByProduct.get(row.id) || 25))
    const existing = await prisma.product.findUnique({ where: { code } })
    if (existing) {
      await prisma.product.update({
        where: { code },
        data: {
          name,
          categoryId: categoryIds.get(cat),
          costPrice: cost,
          sellingPrice: price,
          currentStock: open,
          reorderLevel: Math.max(3, Math.floor(open / 5)),
        },
      })
    } else {
      const created = await prisma.product.create({
        data: {
          code,
          name,
          categoryId: categoryIds.get(cat),
          costPrice: cost,
          sellingPrice: price,
          openingStock: open,
          currentStock: open,
          reorderLevel: Math.max(3, Math.floor(open / 5)),
        },
      })
      await prisma.stockMovement.create({
        data: {
          productId: created.id,
          type: 'OPENING',
          quantity: open,
          balanceAfter: open,
          reference: `ODOO-${row.id}`,
          note: 'رصيد من سحب Odoo',
          createdById: admin.id,
        },
      })
    }
    upsertedProducts += 1
  }

  let upsertedPartners = 0
  for (const row of partners.slice(0, 400)) {
    const name = String(row.name || '').trim()
    if (!name || name.length < 2) continue
    const phone = String(row.phone || '').slice(0, 40)
    const email = String(row.email || '').slice(0, 120)
    const existing = await prisma.customer.findFirst({ where: { name } })
    if (existing) {
      await prisma.customer.update({ where: { id: existing.id }, data: { phone, email } })
    } else {
      await prisma.customer.create({ data: { name: name.slice(0, 200), phone, email, balance: 0 } })
    }
    upsertedPartners += 1
  }

  const walkIn = await prisma.customer.findFirst({ where: { name: 'عميل نقدي - الصندوق' } })
  if (!walkIn) {
    await prisma.customer.create({ data: { name: 'عميل نقدي - الصندوق', phone: '', email: '', balance: 0 } })
  }

  console.log(
    JSON.stringify(
      {
        dumpPath,
        productsInDump: products.length,
        sellable: sellable.length,
        upsertedProducts,
        partnersInDump: partners.length,
        upsertedPartners,
        employees: (models['hr.employee'] || []).length,
        payslips: (models['hr.payslip'] || []).length,
      },
      null,
      2,
    ),
  )
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
