/**
 * Full Venture Foods Odoo dump → Prisma SQLite (panel) importer.
 * Source of truth: database/seeds/venturefoods_odoo_cids1_dump.json
 *
 * Upserts all 10 entity groups, purges demo transactional rows first.
 * Run: npx tsx scripts/import-venturefoods-odoo-dump.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: new (args?: { datasources?: { db?: { url?: string } } }) => import('@prisma/client').PrismaClient
}

const ROOT = process.cwd()
const DUMP_PATH =
  process.env.VENTURE_ODOO_DUMP ||
  path.join(ROOT, 'database', 'seeds', 'venturefoods_odoo_cids1_dump.json')
const SQLITE_FILE = path.join(ROOT, 'prisma', 'dev.db')

type DumpRow = Record<string, unknown>
type DumpFile = { models?: Record<string, DumpRow[]> }

type Counts = Record<string, number>

function money(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? 0).replace(/,/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1000) / 1000
}

function textOf(value: unknown, fallback = ''): string {
  if (value === false || value === null || value === undefined) return fallback
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value) && typeof value[1] === 'string') return String(value[1]).trim()
  return fallback
}

function idOf(value: unknown): number | null {
  if (Array.isArray(value)) {
    const n = Number(value[0])
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function skuOf(row: DumpRow, id: number): string {
  const raw = String(row.default_code || `ODOO-${id}`)
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, '')
    .slice(0, 40)
  return raw || `ODOO-${id}`
}

function parseSkuFromQuantLabel(label: string): string | null {
  const m = label.match(/\[([A-Za-z0-9._-]+)\]/)
  return m ? m[1].toUpperCase() : null
}

type BrandMap = { brand: string; category: string; kind: string }

function brandFromSku(code: string): BrandMap {
  const c = code.toUpperCase()
  if (/^(RICG|CTCG|EXCG)/.test(c)) return { brand: 'China Garden', category: 'China Garden', kind: 'menu' }
  if (/^(RIFB|CTFB|EXFB)/.test(c)) return { brand: 'Farm Brown', category: 'Farm Brown', kind: 'menu' }
  if (/^(RIFR|CTFR|EXFR)/.test(c)) return { brand: "Frank's Steak Sandwich", category: "Frank's Steak Sandwich", kind: 'menu' }
  if (/^(RIKC|CTKC|EXKC)/.test(c)) return { brand: 'Karak Cafeteria', category: 'Karak Cafeteria', kind: 'menu' }
  if (/^(RITNB|CTTNB|RITN|CTTN)/.test(c)) return { brand: 'The Noodle Bar', category: 'The Noodle Bar', kind: 'menu' }
  if (/^(RITAH|CTTAH|EXTAH|RITA|CTTA|EXTA)/.test(c)) return { brand: 'Shawarma Tahina', category: 'Shawarma Tahina', kind: 'menu' }
  if (/^RIHB/.test(c)) return { brand: 'Heisenberg', category: 'Heisenberg', kind: 'menu' }
  if (/^RITS/.test(c)) return { brand: 'Tasty Snacks', category: 'Tasty Snacks', kind: 'menu' }
  if (/^RIFDC|^RIFD/.test(c)) return { brand: 'School Canteen', category: 'School Canteen', kind: 'menu' }
  if (/^RW/.test(c)) return { brand: 'Central Kitchen', category: 'Raw Materials', kind: 'raw' }
  if (/^PI/.test(c)) return { brand: 'Central Kitchen', category: 'Packaging', kind: 'packaging' }
  if (/^PP/.test(c)) return { brand: 'Central Kitchen', category: 'Central Kitchen Prep', kind: 'prep' }
  if (/^CL/.test(c)) return { brand: 'Operations', category: 'Cleaning Supplies', kind: 'cleaning' }
  if (/^KS/.test(c)) return { brand: 'Operations', category: 'Kitchen Equipment', kind: 'equipment' }
  if (/^ST/.test(c)) return { brand: 'Operations', category: 'Stationery', kind: 'stationery' }
  return { brand: 'Venture Foods', category: 'General', kind: 'other' }
}

function mapAccountType(odooType: string): string {
  const t = (odooType || '').toLowerCase()
  if (t.startsWith('asset')) return 'ASSET'
  if (t.startsWith('liability') || t === 'liability_credit_card') return 'LIABILITY'
  if (t.startsWith('equity')) return 'EQUITY'
  if (t.startsWith('income')) return 'REVENUE'
  if (t.startsWith('expense')) return 'EXPENSE'
  return 'ASSET'
}

function warehouseMeta(locLabel: string): { code: string; name: string; location: string } | null {
  const label = locLabel.trim()
  if (!label.includes('/Stock') && !/^CK\b/i.test(label)) {
    if (/Virtual|Partners\//i.test(label)) return null
  }
  const code = label.split('/')[0].trim().toUpperCase()
  const map: Record<string, { name: string; location: string }> = {
    PRM: { name: 'Promenade Mall', location: 'الكويت — البروميناد' },
    '360': { name: '360 Mall', location: 'الكويت — مول 360' },
    ASM: { name: 'Assima Mall', location: 'الكويت — العاصمة مول' },
    KOUT: { name: 'Al Kout Mall', location: 'الكويت — الكوت مول' },
    QRN: { name: 'Aswaq Al Qurain', location: 'الكويت — القرين' },
    SAL: { name: 'Salmiya', location: 'الكويت — السالمية' },
    ARD: { name: 'Ardiya / KWC', location: 'الكويت — العارضية' },
    AVE: { name: 'Avenues Mall', location: 'الكويت — الأفنيوز' },
    JAH: { name: 'Jahra', location: 'الكويت — الجهراء' },
    CK: { name: 'Central Kitchen', location: 'الكويت — المطبخ المركزي' },
  }
  const meta = map[code] || { name: label, location: label }
  return { code, name: meta.name, location: meta.location }
}

function departmentOf(emp: DumpRow): string {
  const full = textOf(emp.department_id, 'عام')
  return full.split('/')[0].trim().slice(0, 80) || 'عام'
}

function safeDate(value: unknown, fallback = new Date()): Date {
  if (!value || value === false) return fallback
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? fallback : d
}

function dayKey(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function payslipStatus(state: string): string {
  const s = (state || '').toLowerCase()
  if (s === 'paid' || s === 'done') return 'PAID'
  if (s === 'verify' || s === 'confirm') return 'APPROVED'
  return 'DRAFT'
}

async function purgeDemo(prisma: import('@prisma/client').PrismaClient) {
  // Order matters for FKs. Keep users/roles/org/settings.
  await prisma.journalEntryLine.deleteMany({})
  await prisma.journalEntry.deleteMany({})
  await prisma.paymentLink.deleteMany({}).catch(() => undefined)
  await prisma.salesInvoiceItem.deleteMany({})
  await prisma.salesInvoice.deleteMany({})
  await prisma.quotationItem.deleteMany({}).catch(() => undefined)
  await prisma.quotation.deleteMany({}).catch(() => undefined)
  await prisma.purchaseOrderItem.deleteMany({})
  await prisma.purchaseOrder.deleteMany({})
  await prisma.stockTransferItem.deleteMany({})
  await prisma.stockTransfer.deleteMany({})
  await prisma.warehouseStock.deleteMany({})
  await prisma.stockMovement.deleteMany({})
  await prisma.recipeLine.deleteMany({}).catch(() => undefined)
  await prisma.recipe.deleteMany({}).catch(() => undefined)
  await prisma.payroll.deleteMany({})
  await prisma.attendance.deleteMany({})
  await prisma.employee.deleteMany({})
  await prisma.product.deleteMany({})
  await prisma.supplier.deleteMany({})
  await prisma.customer.deleteMany({})
  await prisma.account.deleteMany({})
  await prisma.warehouse.deleteMany({})
  await prisma.activityLog.deleteMany({}).catch(() => undefined)
  await prisma.systemNotification.deleteMany({}).catch(() => undefined)
}

async function ensureCategories(
  prisma: import('@prisma/client').PrismaClient,
  names: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const name of names) {
    const existing = await prisma.category.findFirst({ where: { name } })
    const row =
      existing ??
      (await prisma.category.create({
        data: { name, description: `Venture Foods · ${name}` },
      }))
    map.set(name, row.id)
  }
  return map
}

async function main() {
  if (!fs.existsSync(DUMP_PATH)) {
    console.error('Dump not found:', DUMP_PATH)
    process.exit(1)
  }

  const dump = JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8')) as DumpFile
  const models = dump.models || {}
  const counts: Counts = {}

  const sqliteUrl = `file:${SQLITE_FILE.replace(/\\/g, '/')}`
  const prisma = new PrismaClient({ datasources: { db: { url: sqliteUrl } } })

  const admin =
    (await prisma.user.findFirst({ where: { email: 'admin@aetherbi.com', isActive: true } })) ||
    (await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }))
  if (!admin) throw new Error('No active user — seed admin first')

  console.log('Purging demo transactional data…')
  await purgeDemo(prisma)

  // Extra real branch shells (even if dump has no quants yet)
  const EXTRA_WAREHOUSES = [
    { code: 'SAL', name: 'Salmiya', location: 'الكويت — السالمية' },
    { code: 'ARD', name: 'Ardiya / KWC', location: 'الكويت — العارضية' },
    { code: 'AVE', name: 'Avenues Mall', location: 'الكويت — الأفنيوز' },
    { code: 'JAH', name: 'Jahra', location: 'الكويت — الجهراء' },
    { code: 'CK', name: 'Central Kitchen', location: 'الكويت — المطبخ المركزي' },
  ]

  // ——— 1. Chart of accounts ———
  const accounts = Array.isArray(models['account.account']) ? models['account.account'] : []
  const accountIdByCode = new Map<string, string>()
  let accountBalanceSeed = 0
  for (const row of accounts) {
    const code = textOf(row.code).slice(0, 32)
    const name = textOf(row.name, code).slice(0, 200)
    if (!code) continue
    const type = mapAccountType(textOf(row.account_type))
    const created = await prisma.account.create({
      data: { code, name, type, balance: 0 },
    })
    accountIdByCode.set(code, created.id)
    accountBalanceSeed += 1
  }
  // Suspense for moves without lines
  if (!accountIdByCode.has('99999')) {
    const suspense = await prisma.account.create({
      data: { code: '99999', name: 'Suspense / Odoo Import Clearing', type: 'ASSET', balance: 0 },
    })
    accountIdByCode.set('99999', suspense.id)
  }
  if (!accountIdByCode.has('10001')) {
    const cash = await prisma.account.create({
      data: { code: '10001', name: 'Cash On Hand الصندوق', type: 'ASSET', balance: 0 },
    })
    accountIdByCode.set('10001', cash.id)
  }
  counts.accounts = accountBalanceSeed

  // ——— 10. Partners (customers + suppliers) ———
  // Dump often has name:false on res.partner — recover names from phones + account.move.partner_id
  const partners = Array.isArray(models['res.partner']) ? models['res.partner'] : []
  const movesForPartners = Array.isArray(models['account.move']) ? models['account.move'] : []
  let customers = 0
  let suppliers = 0
  const supplierHints =
    /شرك|مورد|توريد|شركة|co\.|company|trading|llc|ذ\.م\.م|مقاول|ايجار|إيجار|ساير|سند|خليج|real estate|petty|توظ|تأهيل|اصلاح|إصلاح/i
  const seenPartnerNames = new Set<string>()

  for (const row of partners) {
    const phone = textOf(row.phone || row.mobile).slice(0, 40)
    const email = textOf(row.email).slice(0, 120)
    const street = textOf(row.street)
    let name = textOf(row.name)
    if (!name || name.length < 2) {
      if (!phone) continue
      name = `عميل الكويت ${phone}`
    }
    const key = name.toLowerCase()
    if (seenPartnerNames.has(key)) continue
    seenPartnerNames.add(key)
    const custom = JSON.stringify({
      odooId: row.id,
      vat: textOf(row.vat) || undefined,
      street: street || undefined,
      source: 'odoo',
    })
    await prisma.customer.create({
      data: { name: name.slice(0, 200), phone, email, balance: 0, customData: custom },
    })
    customers += 1
  }

  for (const row of movesForPartners) {
    const name = textOf(row.partner_id)
    if (!name || name.length < 2) continue
    const key = name.toLowerCase()
    if (seenPartnerNames.has(key)) continue
    seenPartnerNames.add(key)
    const looksSupplier = supplierHints.test(name)
    const custom = JSON.stringify({ source: 'odoo-move', moveId: row.id })
    if (looksSupplier) {
      await prisma.supplier.create({
        data: { name: name.slice(0, 200), phone: '', email: '', balance: 0, customData: custom },
      })
      suppliers += 1
    } else {
      await prisma.customer.create({
        data: { name: name.slice(0, 200), phone: '', email: '', balance: 0, customData: custom },
      })
      customers += 1
    }
  }

  await prisma.customer.create({
    data: { name: 'عميل نقدي - الصندوق', phone: '', email: '', balance: 0, customData: '{"walkIn":true}' },
  })
  customers += 1
  counts.customers = customers
  counts.suppliers = suppliers

  // ——— 2. Journal moves ———
  const moves = Array.isArray(models['account.move']) ? models['account.move'] : []
  const cashId = accountIdByCode.get('10001')!
  const suspenseId = accountIdByCode.get('99999')!
  let journals = 0
  const balanceDelta = new Map<string, number>()
  for (const row of moves) {
    const name = textOf(row.name).replace(/\t/g, '').trim() || `MISC/${row.id}`
    const amount = money(row.amount_total)
    if (amount <= 0) continue
    const partner = textOf(row.partner_id)
    const moveType = textOf(row.move_type, 'entry')
    const state = textOf(row.state, 'posted')
    const entryNumber = name.slice(0, 60)
    const existing = await prisma.journalEntry.findUnique({ where: { entryNumber } })
    if (existing) continue
    const date = safeDate(row.invoice_date || row.date)
    const desc = [partner || null, moveType, name].filter(Boolean).join(' · ').slice(0, 400)
    // Balanced stub: expense-like → debit expense suspense / credit cash; else debit cash / credit clearing
    const isOutflow = /out_invoice|out_refund|expense|entry/i.test(moveType) && amount > 0
    const debitAccount = isOutflow ? suspenseId : cashId
    const creditAccount = isOutflow ? cashId : suspenseId
    await prisma.journalEntry.create({
      data: {
        entryNumber,
        date,
        description: desc,
        referenceType: 'ODOO_MOVE',
        referenceId: String(row.id),
        isPosted: state === 'posted',
        createdById: admin.id,
        lines: {
          create: [
            { accountId: debitAccount, debit: amount, credit: 0 },
            { accountId: creditAccount, debit: 0, credit: amount },
          ],
        },
      },
    })
    balanceDelta.set(debitAccount, (balanceDelta.get(debitAccount) || 0) + amount)
    balanceDelta.set(creditAccount, (balanceDelta.get(creditAccount) || 0) - amount)
    journals += 1
  }
  for (const [accountId, delta] of balanceDelta) {
    await prisma.account.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    })
  }
  counts.journalEntries = journals

  // ——— 8. Products ———
  const products = Array.isArray(models['product.template']) ? models['product.template'] : []
  const categoryNames = new Set<string>([
    'China Garden',
    'Farm Brown',
    "Frank's Steak Sandwich",
    'Karak Cafeteria',
    'The Noodle Bar',
    'Shawarma Tahina',
    'Heisenberg',
    'Tasty Snacks',
    'School Canteen',
    'Raw Materials',
    'Packaging',
    'Central Kitchen Prep',
    'Cleaning Supplies',
    'Kitchen Equipment',
    'Stationery',
    'General',
  ])
  for (const p of products) {
    const code = skuOf(p, Number(p.id) || 0)
    categoryNames.add(brandFromSku(code).category)
  }
  const categoryIds = await ensureCategories(prisma, [...categoryNames])

  const productIdBySku = new Map<string, string>()
  const productOdooIdToSku = new Map<number, string>()
  let productCount = 0
  for (const row of products) {
    if (!row || row.active === false) continue
    const id = Number(row.id) || 0
    const code = skuOf(row, id)
    const name = textOf(row.name, code).slice(0, 200)
    const meta = brandFromSku(code)
    const price = money(row.list_price)
    const cost = meta.kind === 'menu' ? money(price * 0.55) : money(price || 0)
    const customData = JSON.stringify({
      odooId: id,
      brand: meta.brand,
      kind: meta.kind,
      source: 'odoo',
    })
    const created = await prisma.product.create({
      data: {
        code,
        name,
        categoryId: categoryIds.get(meta.category) || categoryIds.get('General')!,
        costPrice: cost,
        sellingPrice: price,
        openingStock: 0,
        currentStock: 0,
        reorderLevel: meta.kind === 'menu' ? 5 : 10,
        customData,
      },
    })
    productIdBySku.set(code, created.id)
    productOdooIdToSku.set(id, code)
    productCount += 1
  }
  counts.products = productCount

  // ——— 9. Warehouses + stock quants ———
  const quants = Array.isArray(models['stock.quant']) ? models['stock.quant'] : []
  const warehouseIdByCode = new Map<string, string>()
  for (const extra of EXTRA_WAREHOUSES) {
    const wh = await prisma.warehouse.create({
      data: {
        code: extra.code,
        name: extra.name,
        location: extra.location,
        brandCode: extra.code === 'CK' ? 'CK' : null,
        isDefault: extra.code === 'CK',
      },
    })
    warehouseIdByCode.set(extra.code, wh.id)
  }
  let warehouseCount = EXTRA_WAREHOUSES.length
  let stockRows = 0
  const stockAgg = new Map<string, number>() // productId -> total qty

  for (const q of quants) {
    const loc = textOf(q.location_id)
    const meta = warehouseMeta(loc)
    if (!meta) continue
    let warehouseId = warehouseIdByCode.get(meta.code)
    if (!warehouseId) {
      const wh = await prisma.warehouse.create({
        data: {
          code: meta.code,
          name: meta.name,
          location: meta.location,
          isDefault: false,
        },
      })
      warehouseId = wh.id
      warehouseIdByCode.set(meta.code, warehouseId)
      warehouseCount += 1
    }
    const label = textOf(Array.isArray(q.product_id) ? q.product_id[1] : q.product_id)
    const sku = parseSkuFromQuantLabel(label)
    if (!sku) continue
    let productId = productIdBySku.get(sku)
    if (!productId) {
      // Create missing SKU from quant label
      const bareName = label.replace(/^\[[^\]]+\]\s*/, '').slice(0, 200) || sku
      const brand = brandFromSku(sku)
      if (!categoryIds.has(brand.category)) {
        const cat = await prisma.category.create({
          data: { name: brand.category, description: `Venture Foods · ${brand.category}` },
        })
        categoryIds.set(brand.category, cat.id)
      }
      const created = await prisma.product.create({
        data: {
          code: sku,
          name: bareName,
          categoryId: categoryIds.get(brand.category)!,
          costPrice: 0,
          sellingPrice: 0,
          openingStock: 0,
          currentStock: 0,
          reorderLevel: 5,
          customData: JSON.stringify({ brand: brand.brand, kind: brand.kind, source: 'odoo-quant' }),
        },
      })
      productId = created.id
      productIdBySku.set(sku, productId)
      productCount += 1
    }
    const qty = money(q.quantity)
    if (qty === 0) continue
    const existing = await prisma.warehouseStock.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    })
    if (existing) {
      await prisma.warehouseStock.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + qty },
      })
    } else {
      await prisma.warehouseStock.create({
        data: { warehouseId, productId, quantity: qty },
      })
      stockRows += 1
    }
    stockAgg.set(productId, (stockAgg.get(productId) || 0) + qty)
  }

  for (const [productId, qty] of stockAgg) {
    const open = Math.max(0, qty)
    await prisma.product.update({
      where: { id: productId },
      data: {
        openingStock: open,
        currentStock: open,
        reorderLevel: Math.max(3, Math.floor(open / 5) || 5),
      },
    })
    await prisma.stockMovement.create({
      data: {
        productId,
        type: 'OPENING',
        quantity: open,
        balanceAfter: open,
        reference: 'ODOO-QUANT',
        note: 'رصيد من سحب Odoo Venture Foods',
        createdById: admin.id,
      },
    })
  }
  counts.warehouses = warehouseCount
  counts.warehouseStock = stockRows
  counts.products = productCount
  counts.stockMovements = stockAgg.size

  // ——— 3–4. Employees + contracts ———
  const employees = Array.isArray(models['hr.employee']) ? models['hr.employee'] : []
  const contracts = Array.isArray(models['hr.contract']) ? models['hr.contract'] : []
  const wageByEmp = new Map<number, { wage: number; start: Date; state: string }>()
  for (const c of contracts) {
    const eid = idOf(c.employee_id)
    if (eid == null) continue
    const state = textOf(c.state, 'close')
    const wage = money(c.wage)
    const start = safeDate(c.date_start)
    const prev = wageByEmp.get(eid)
    const prefer =
      !prev ||
      (state === 'open' && prev.state !== 'open') ||
      (state === prev.state && start > prev.start)
    if (prefer) wageByEmp.set(eid, { wage, start, state })
  }

  const employeeDbId = new Map<number, string>()
  let empCount = 0
  let openContracts = 0
  for (const row of employees) {
    const name = textOf(row.name)
    if (!name || name.length < 2) continue
    const odooId = Number(row.id)
    const code = textOf(row.barcode, `E${odooId}`).replace(/[^\w.-]/g, '').slice(0, 20) || `E${odooId}`
    const contract = wageByEmp.get(odooId)
    if (contract?.state === 'open') openContracts += 1
    const created = await prisma.employee.create({
      data: {
        code,
        name: name.slice(0, 120),
        jobTitle: textOf(row.job_title, 'موظف').slice(0, 80),
        department: departmentOf(row),
        phone: textOf(row.work_email).includes('@') ? textOf(row.work_email).slice(0, 80) : null,
        basicSalary: contract?.wage ?? 0,
        allowances: 0,
        deductions: 0,
        hireDate: contract?.start ?? new Date('2024-01-01'),
        status: row.active === false ? 'INACTIVE' : 'ACTIVE',
      },
    })
    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: 'HR_EMPLOYEE_META',
        module: 'hr',
        details: JSON.stringify({
          employeeId: created.id,
          odooId,
          email: textOf(row.work_email) || null,
          barcode: textOf(row.barcode) || null,
          contractState: contract?.state ?? null,
          wage: contract?.wage ?? 0,
        }),
      },
    })
    employeeDbId.set(odooId, created.id)
    // Also map by name for payslip/attendance that may reference inactive dump ids
    empCount += 1
  }
  counts.employees = empCount
  counts.contractsOpen = openContracts
  counts.contracts = contracts.length

  // Name → employeeId fallback
  const employeeByName = new Map<string, string>()
  for (const row of employees) {
    const id = employeeDbId.get(Number(row.id))
    if (id) employeeByName.set(textOf(row.name).toLowerCase(), id)
  }

  function resolveEmployee(ref: unknown): string | null {
    const eid = idOf(ref)
    if (eid != null && employeeDbId.has(eid)) return employeeDbId.get(eid)!
    const name = textOf(ref).toLowerCase()
    return employeeByName.get(name) || null
  }

  // ——— 5. Payslips ———
  const payslips = Array.isArray(models['hr.payslip']) ? models['hr.payslip'] : []
  let payrollCount = 0
  for (const row of payslips) {
    const empId = resolveEmployee(row.employee_id)
    if (!empId) continue
    const from = safeDate(row.date_from)
    const month = from.getUTCMonth() + 1
    const year = from.getUTCFullYear()
    const net = money(row.net_wage)
    const basic = net
    try {
      await prisma.payroll.create({
        data: {
          month,
          year,
          employeeId: empId,
          basicSalary: basic,
          totalAllowances: 0,
          totalDeductions: 0,
          netSalary: net,
          absentDays: 0,
          lateDays: 0,
          status: payslipStatus(textOf(row.state)),
          paidAt: textOf(row.state).toLowerCase() === 'paid' ? from : null,
        },
      })
      payrollCount += 1
    } catch {
      // unique (employeeId, month, year) — keep first / higher net
      const existing = await prisma.payroll.findUnique({
        where: { employeeId_month_year: { employeeId: empId, month, year } },
      })
      if (existing && net > existing.netSalary) {
        await prisma.payroll.update({
          where: { id: existing.id },
          data: {
            basicSalary: basic,
            netSalary: net,
            status: payslipStatus(textOf(row.state)),
          },
        })
      }
    }
  }
  counts.payslips = payrollCount

  // ——— 6. Attendance + leaves + appraisals ———
  const attendances = Array.isArray(models['hr.attendance']) ? models['hr.attendance'] : []
  let attCount = 0
  for (const row of attendances) {
    const empId = resolveEmployee(row.employee_id)
    if (!empId) continue
    const checkIn = row.check_in ? safeDate(row.check_in) : null
    const checkOut = row.check_out && row.check_out !== false ? safeDate(row.check_out) : null
    if (!checkIn) continue
    const date = dayKey(checkIn)
    let hours = 0
    if (checkOut) hours = Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 3_600_000)
    try {
      await prisma.attendance.create({
        data: {
          employeeId: empId,
          date,
          checkIn,
          checkOut,
          status: checkOut ? 'PRESENT' : 'PRESENT',
          hoursWorked: Math.round(hours * 100) / 100,
        },
      })
      attCount += 1
    } catch {
      // duplicate day — keep earliest check-in
    }
  }
  counts.attendance = attCount

  const leaves = Array.isArray(models['hr.leave']) ? models['hr.leave'] : []
  let leaveCount = 0
  for (const row of leaves) {
    const empId = resolveEmployee(row.employee_id)
    if (!empId) continue
    const from = safeDate(row.date_from)
    const date = dayKey(from)
    const leaveType = textOf(row.holiday_status_id, 'Leave')
    try {
      await prisma.attendance.create({
        data: {
          employeeId: empId,
          date,
          checkIn: null,
          checkOut: null,
          status: 'LEAVE',
          hoursWorked: 0,
        },
      })
      leaveCount += 1
    } catch {
      await prisma.attendance.updateMany({
        where: { employeeId: empId, date },
        data: { status: 'LEAVE', hoursWorked: 0, checkIn: null, checkOut: null },
      })
      leaveCount += 1
    }
    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: 'HR_LEAVE',
        module: 'hr',
        details: JSON.stringify({
          employeeId: empId,
          type: leaveType,
          from: textOf(row.date_from),
          to: textOf(row.date_to),
          state: textOf(row.state),
        }),
      },
    })
  }
  counts.leaves = leaveCount

  const appraisals = Array.isArray(models['hr.appraisal']) ? models['hr.appraisal'] : []
  let appraisalCount = 0
  for (const row of appraisals) {
    const empId = resolveEmployee(row.employee_id)
    if (!empId) continue
    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: 'HR_APPRAISAL',
        module: 'hr',
        details: JSON.stringify({
          employeeId: empId,
          dateClose: textOf(row.date_close),
          state: textOf(row.state),
          odooId: row.id,
        }),
      },
    })
    appraisalCount += 1
  }
  counts.appraisals = appraisalCount

  // ——— 7. Expenses → journal entries ———
  const expenses = Array.isArray(models['hr.expense']) ? models['hr.expense'] : []
  let expenseCount = 0
  // Prefer an expense-type account
  const expenseAccount =
    (await prisma.account.findFirst({ where: { type: 'EXPENSE' }, orderBy: { code: 'asc' } })) ||
    (await prisma.account.findUnique({ where: { code: '99999' } }))
  for (const row of expenses) {
    const amount = money(row.total_amount)
    if (amount <= 0) continue
    const title = textOf(row.name, 'Expense').slice(0, 120)
    const empName = textOf(row.employee_id)
    const date = safeDate(row.date)
    const entryNumber = `EXP/${row.id}`.slice(0, 60)
    const existing = await prisma.journalEntry.findUnique({ where: { entryNumber } })
    if (existing) continue
    await prisma.journalEntry.create({
      data: {
        entryNumber,
        date,
        description: `${title}${empName ? ` · ${empName}` : ''}`.slice(0, 400),
        referenceType: 'ODOO_EXPENSE',
        referenceId: String(row.id),
        isPosted: textOf(row.state) === 'done' || textOf(row.state) === 'approved',
        createdById: admin.id,
        lines: {
          create: [
            { accountId: expenseAccount!.id, debit: amount, credit: 0 },
            { accountId: cashId, debit: 0, credit: amount },
          ],
        },
      },
    })
    await prisma.account.update({
      where: { id: expenseAccount!.id },
      data: { balance: { increment: amount } },
    })
    await prisma.account.update({
      where: { id: cashId },
      data: { balance: { increment: -amount } },
    })
    expenseCount += 1
  }
  counts.expenses = expenseCount

  await prisma.systemNotification.create({
    data: {
      title: 'Venture Foods Odoo import complete',
      body: `Imported real dump: ${counts.products} products, ${counts.employees} employees, ${counts.accounts} accounts.`,
      href: '/dashboard',
    },
  })

  const report = {
    dumpPath: DUMP_PATH,
    sqlite: SQLITE_FILE,
    counts,
    dumpSizes: Object.fromEntries(
      Object.entries(models).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
    ),
  }
  const reportPath = path.join(ROOT, 'database', 'seeds', 'venturefoods-import-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  process.exit(1)
})
