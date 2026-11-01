/**
 * Multi-department smart folder ingest — 6 module-specific routers.
 * Zero-Blob: binaries via storeDeptBinary; DB stores fileUrl + metadata only.
 */
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { storeDeptBinary } from '@/lib/dept-file-storage'
import {
  isSmartIngestModule,
  type SmartIngestModule,
} from '@/lib/smart-ingest-modules'

export type IngestFileInput = {
  relativePath: string
  fileName: string
  mimeType?: string
  sizeBytes?: number
  contentBase64?: string
  textHint?: string
}

export type UniversalIngestRow = {
  id: string
  module: SmartIngestModule
  fileName: string
  relativePath: string
  category: string
  categoryLabelAr: string
  categoryLabelEn: string
  entityKey: string | null
  entityLabel: string | null
  branchCode: string | null
  brandCode: string | null
  amountKwd: number | null
  matchScore: number
  status: 'MATCHED' | 'REVIEW' | 'APPLIED' | 'SKIPPED'
  updates: string[]
  expiryDate: string | null
  fileUrl: string | null
}

export type UniversalIngestBatch = {
  batchId: string
  module: SmartIngestModule
  processed: number
  matched: number
  review: number
  appliedRows: number
  rows: UniversalIngestRow[]
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff.]+/g, ' ')
    .trim()
}

function bufferFromBase64(b64?: string): Buffer | null {
  if (!b64) return null
  try {
    return Buffer.from(b64.replace(/^data:[^;]+;base64,/, ''), 'base64')
  } catch {
    return null
  }
}

function textFromBuffer(buf: Buffer | null, mime: string, fileName: string): string {
  if (!buf) return ''
  if (/text|json|csv|xml/i.test(mime) || /\.(txt|csv|json|md)$/i.test(fileName)) {
    return buf.toString('utf8').slice(0, 20000)
  }
  const asLatin = buf.toString('latin1')
  return asLatin.replace(/[^\x09\x0a\x0d\x20-\x7e\u0600-\u06ff]/g, ' ').replace(/\s+/g, ' ').slice(0, 8000)
}

function extractAmountKwd(hay: string): number | null {
  const m =
    hay.match(/(\d{1,3}(?:,\d{3})*\.\d{3})\s*(?:د\.?\s*ك|kwd|kd)?/i) ||
    hay.match(/(?:kwd|د\.?\s*ك|kd)\s*[:=]?\s*(\d+(?:\.\d{1,3})?)/i) ||
    hay.match(/\b(\d+\.\d{3})\b/)
  if (!m) return null
  const n = Number(String(m[1]).replace(/,/g, ''))
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null
}

function extractExpiry(text: string): Date | null {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    if (!Number.isNaN(d.getTime())) return d
  }
  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/)
  if (dmy) {
    const d = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])))
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

function detectBranch(hay: string): string | null {
  const map: Array<[RegExp, string]> = [
    [/\bprm\b|prime/i, 'PRM'],
    [/\b360\b/i, '360'],
    [/\basm\b|assima/i, 'ASM'],
    [/\bkout\b|كوت/i, 'KOUT'],
    [/\bqrn\b|قرين|qurain/i, 'QRN'],
    [/salmiya|السالمية/i, 'SALMIYA'],
    [/ardiya|العارضية/i, 'ARDIYA'],
    [/\bck\b|central.?kitchen|مطبخ/i, 'CK'],
    [/rabih|رابح/i, 'RABIH'],
    [/sheila|شيلا/i, 'SHEILA'],
    [/amgad|امجاد|أمجاد/i, 'AMGAD'],
    [/sanad|سند/i, 'SANAD'],
  ]
  for (const [re, code] of map) if (re.test(hay)) return code
  return null
}

function detectBrand(hay: string): string | null {
  const map: Array<[RegExp, string]> = [
    [/rice\s*guys|رايس/i, 'RICE_GUYS'],
    [/firebird|فاير/i, 'FIREBIRD'],
    [/burger|برجر/i, 'BURGER'],
    [/sushi|سوشي/i, 'SUSHI'],
    [/pizza|بيتزا/i, 'PIZZA'],
    [/cafe|كافيه|قهوة/i, 'CAFE'],
  ]
  for (const [re, code] of map) if (re.test(hay)) return code
  return null
}

function sheetObjects(buf: Buffer, fileName: string): Record<string, unknown>[] {
  try {
    if (/\.csv$/i.test(fileName)) {
      const wb = XLSX.read(buf.toString('utf8'), { type: 'string' })
      const sheet = wb.Sheets[wb.SheetNames[0]!]
      return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : []
    }
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]!]
    return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : []
  } catch {
    return []
  }
}

function cell(row: Record<string, unknown>, keys: string[]): string {
  const map = new Map(Object.keys(row).map((k) => [normalize(k), k]))
  for (const key of keys) {
    const real = map.get(normalize(key))
    if (real != null) return String(row[real] ?? '').trim()
  }
  for (const [nk, real] of map) {
    if (keys.some((k) => nk.includes(normalize(k)))) return String(row[real] ?? '').trim()
  }
  return ''
}

type RouteResult = {
  category: string
  categoryLabelAr: string
  categoryLabelEn: string
  entityKey: string | null
  entityLabel: string | null
  branchCode: string | null
  brandCode: string | null
  amountKwd: number | null
  matchScore: number
  status: UniversalIngestRow['status']
  updates: string[]
  expiryDate: Date | null
}

async function routeAccounting(hay: string, fileName: string, buf: Buffer | null): Promise<RouteResult> {
  const updates: string[] = []
  let category = 'other'
  let categoryLabelAr = 'مستند محاسبي'
  let categoryLabelEn = 'Accounting document'
  if (/nbk|national.?bank|الوطني/i.test(hay)) {
    category = 'bank_nbk'
    categoryLabelAr = 'كشف بنك الوطني NBK'
    categoryLabelEn = 'NBK bank statement'
  } else if (/gulf.?bank|الخليج/i.test(hay)) {
    category = 'bank_gulf'
    categoryLabelAr = 'كشف بنك الخليج'
    categoryLabelEn = 'Gulf Bank statement'
  } else if (/boubyan|بوبيان/i.test(hay)) {
    category = 'bank_boubyan'
    categoryLabelAr = 'كشف بنك بوبيان'
    categoryLabelEn = 'Boubyan statement'
  } else if (/ahli|الاهلي|الأهلي/i.test(hay)) {
    category = 'bank_ahli'
    categoryLabelAr = 'كشف البنك الأهلي'
    categoryLabelEn = 'Ahli Bank statement'
  } else if (/petty|عهد|rabih|sheila|amgad|sanad/i.test(hay)) {
    category = 'petty_cash'
    categoryLabelAr = 'عهدة فرع / Petty Cash'
    categoryLabelEn = 'Branch petty cash'
  } else if (/invoice|فاتور|مصروف|expense|receipt|ايصال|إيصال/i.test(hay)) {
    category = 'expense_invoice'
    categoryLabelAr = 'فاتورة مشتريات/مصروف'
    categoryLabelEn = 'Purchase / expense invoice'
  } else if (/journal|قيد|entry/i.test(hay)) {
    category = 'journal'
    categoryLabelAr = 'قيد محاسبي'
    categoryLabelEn = 'Journal entry'
  }

  const codeHit = hay.match(/\b(10\d{3}|40\d{3}|20\d{3}|10143|10153|40551|40135)\b/)
  let entityKey: string | null = codeHit?.[1] ?? null
  let entityLabel: string | null = null
  let score = 0.4
  if (entityKey) {
    const account = await prisma.account.findFirst({ where: { code: entityKey } })
    if (account) {
      entityLabel = `${account.code} · ${account.name}`
      score = 0.92
      updates.push(`account:${account.code}`)
    } else {
      const known: Record<string, string> = {
        '10143': 'البنك الوطني NBK',
        '10153': 'عهدة سند',
        '40551': 'إيجارات الفروع',
        '40135': 'صيانة',
      }
      entityLabel = known[entityKey] || `حساب ${entityKey}`
      score = 0.75
      updates.push(`account_hint:${entityKey}`)
    }
  } else if (category.startsWith('bank_')) {
    const bankCode = category === 'bank_nbk' ? '10143' : null
    if (bankCode) {
      entityKey = bankCode
      entityLabel = '10143 · الوطني'
      score = 0.8
      updates.push('account:10143')
    }
  }

  let applied = 0
  if (buf && /\.(xlsx|xls|csv)$/i.test(fileName)) {
    const rows = sheetObjects(buf, fileName)
    for (const row of rows.slice(0, 200)) {
      const desc = cell(row, ['description', 'بيان', 'narration', 'memo', 'التفاصيل']) || 'AI ingest'
      const debit = Number(cell(row, ['debit', 'مدين', 'dr']) || 0)
      const credit = Number(cell(row, ['credit', 'دائن', 'cr']) || 0)
      const accCode = cell(row, ['account', 'حساب', 'code', 'رمز']) || entityKey || ''
      if (!accCode || (debit <= 0 && credit <= 0)) continue
      const account = await prisma.account.findFirst({ where: { code: accCode } })
      if (!account) continue
      // Soft link only via activity — avoid unbalanced auto-post without human review
      applied += 1
      updates.push(`sheet_line:${account.code}:${debit || credit}`)
    }
    if (applied) {
      updates.push(`sheet_lines_reviewed:${applied}`)
      score = Math.max(score, 0.85)
    }
  }

  const amount = extractAmountKwd(hay)
  if (amount != null) updates.push(`amount_kwd:${amount.toFixed(3)}`)
  if (buf) updates.push('verified_attachment_ready')

  return {
    category,
    categoryLabelAr,
    categoryLabelEn,
    entityKey,
    entityLabel,
    branchCode: detectBranch(hay),
    brandCode: detectBrand(hay),
    amountKwd: amount,
    matchScore: score,
    status: score >= 0.72 ? 'MATCHED' : score >= 0.45 ? 'REVIEW' : 'REVIEW',
    updates,
    expiryDate: null,
  }
}

async function routeInventory(hay: string, fileName: string, buf: Buffer | null, mime: string): Promise<RouteResult> {
  const updates: string[] = []
  let category = 'other'
  let categoryLabelAr = 'مستند مخزون'
  let categoryLabelEn = 'Inventory document'
  if (/recipe|bom|وصفة|مكونات/i.test(hay)) {
    category = 'recipe_bom'
    categoryLabelAr = 'وصفة / BOM'
    categoryLabelEn = 'Recipe / BOM'
  } else if (/count|جرد|stock.?take|arbitrage|رصيد/i.test(hay)) {
    category = 'stock_count'
    categoryLabelAr = 'جرد فعلي'
    categoryLabelEn = 'Stock count'
  } else if (/\.(jpe?g|png|webp)$/i.test(fileName) || /^image\//i.test(mime)) {
    category = 'menu_image'
    categoryLabelAr = 'صورة صنف منيو'
    categoryLabelEn = 'Menu item image'
  } else if (/\brw\d|\bpi\d|\bpp\d|ricg|rifb/i.test(hay)) {
    category = 'item_master'
    categoryLabelAr = 'بطاقة صنف / مواد'
    categoryLabelEn = 'Item master'
  }

  const skuMatch = hay.match(/\b((?:RW|PI|PP)\d{4,}|RICG\d+|RIFB\d+|RIFR\d+|RIKC\d+|RITNB\d+|RITAH\d+|RI[A-Z]{2,}\d+)\b/i)
  let entityKey: string | null = skuMatch?.[1]?.toUpperCase() ?? null
  let entityLabel: string | null = null
  let score = 0.4

  let product =
    entityKey
      ? await prisma.product.findFirst({ where: { code: { equals: entityKey } } })
      : null
  if (!product) {
    const nameHint = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
    if (nameHint.length > 2) {
      product = await prisma.product.findFirst({
        where: { OR: [{ name: { contains: nameHint.slice(0, 40) } }, { code: { contains: nameHint.slice(0, 20) } }] },
      })
    }
  }
  if (product) {
    entityKey = product.code
    entityLabel = `${product.code} · ${product.name}`
    score = 0.9
    updates.push(`product:${product.code}`)
  }

  const branch = detectBranch(hay)
  if (branch) {
    updates.push(`warehouse_hint:${branch}`)
    const wh = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { code: { contains: branch } },
          { name: { contains: branch } },
        ],
      },
    })
    if (wh) updates.push(`warehouse:${wh.code || wh.id}`)
  }

  if (product && category === 'menu_image' && buf) {
    try {
      let custom: Record<string, unknown> = {}
      try {
        custom = JSON.parse(product.customData || '{}') as Record<string, unknown>
      } catch {
        custom = {}
      }
      // fileUrl filled later — mark pending bind
      custom.imagePending = true
      custom.imageSource = fileName
      await prisma.product.update({
        where: { id: product.id },
        data: { customData: JSON.stringify(custom) },
      })
      updates.push('menu_image_bound')
      score = 0.95
    } catch {
      updates.push('menu_image_bind_failed')
    }
  }

  let applied = 0
  if (buf && /\.(xlsx|xls|csv)$/i.test(fileName) && (category === 'stock_count' || category === 'item_master' || category === 'other')) {
    const rows = sheetObjects(buf, fileName)
    for (const row of rows.slice(0, 500)) {
      const code = cell(row, ['code', 'default_code', 'sku', 'رمز', 'صنف'])
      const qty = Number(cell(row, ['qty', 'quantity', 'on_hand', 'كمية', 'رصيد', 'count']) || NaN)
      const cost = Number(cell(row, ['cost', 'unit_cost', 'تكلفة', 'cost_price']) || NaN)
      if (!code) continue
      const p = await prisma.product.findFirst({ where: { code } })
      if (!p) continue
      const data: { currentStock?: number; costPrice?: number } = {}
      if (Number.isFinite(qty) && qty >= 0) data.currentStock = qty
      if (Number.isFinite(cost) && cost >= 0) data.costPrice = cost
      if (Object.keys(data).length) {
        await prisma.product.update({ where: { id: p.id }, data })
        applied += 1
      }
    }
    if (applied) {
      category = category === 'other' ? 'stock_count' : category
      categoryLabelAr = 'جرد / أرصدة محدّثة'
      categoryLabelEn = 'Stock / balances updated'
      updates.push(`stock_rows_updated:${applied}`)
      score = Math.max(score, 0.88)
    }
  }

  if (buf && category === 'recipe_bom' && /\.(xlsx|xls|csv)$/i.test(fileName)) {
    updates.push('recipe_sheet_queued')
    score = Math.max(score, 0.7)
  }

  return {
    category,
    categoryLabelAr,
    categoryLabelEn,
    entityKey,
    entityLabel,
    branchCode: branch,
    brandCode: detectBrand(hay),
    amountKwd: null,
    matchScore: score,
    status: applied > 0 ? 'APPLIED' : score >= 0.72 ? 'MATCHED' : 'REVIEW',
    updates,
    expiryDate: null,
  }
}

async function routePurchases(hay: string, fileName: string, buf: Buffer | null): Promise<RouteResult> {
  const updates: string[] = []
  let category = 'supplier_invoice'
  let categoryLabelAr = 'فاتورة مورد'
  let categoryLabelEn = 'Supplier invoice'
  if (/quote|عرض.?سعر|rfq/i.test(hay)) {
    category = 'supplier_quote'
    categoryLabelAr = 'عرض سعر مورد'
    categoryLabelEn = 'Supplier quotation'
  } else if (/contract|عقد.?توريد|agreement/i.test(hay)) {
    category = 'supply_contract'
    categoryLabelAr = 'عقد توريد'
    categoryLabelEn = 'Supply contract'
  } else if (/\bgrn\b|goods.?receipt|سند.?استلام|استلام.?بضاع/i.test(hay)) {
    category = 'grn'
    categoryLabelAr = 'سند استلام GRN'
    categoryLabelEn = 'Goods receipt note'
  }

  const suppliers = await prisma.supplier.findMany({ take: 400, select: { id: true, name: true, balance: true } })
  let best: { id: string; name: string; score: number } | null = null
  const hayN = normalize(hay)
  for (const s of suppliers) {
    const sn = normalize(s.name)
    if (!sn) continue
    let score = 0
    if (hayN.includes(sn)) score = 0.95
    else {
      const parts = sn.split(/\s+/).filter((t) => t.length > 2)
      const hits = parts.filter((t) => hayN.includes(t)).length
      if (parts.length) score = hits / parts.length
    }
    if (!best || score > best.score) best = { id: s.id, name: s.name, score }
  }
  // Known vendor hints
  if ((!best || best.score < 0.5) && /top\s*pack/i.test(hay)) {
    best = { id: 'hint_top_pack', name: 'Top Pack', score: 0.8 }
  } else if ((!best || best.score < 0.5) && /ساير|sayyer|sayer/i.test(hay)) {
    best = { id: 'hint_sayer', name: 'شركة الساير', score: 0.8 }
  }

  const amount = extractAmountKwd(hay)
  if (amount != null) updates.push(`amount_kwd:${amount.toFixed(3)}`)
  if (/2020[0-9]|202[1-4]0/.test(hay)) updates.push('ap_account_range:20200-20240')

  let applied = 0
  if (buf && /\.(xlsx|xls|csv)$/i.test(fileName) && best && best.score >= 0.7 && !best.id.startsWith('hint_')) {
    updates.push(`supplier_ledger:${best.name}`)
    applied = 1
  }

  return {
    category,
    categoryLabelAr,
    categoryLabelEn,
    entityKey: best && best.score >= 0.45 ? best.id : null,
    entityLabel: best && best.score >= 0.45 ? best.name : null,
    branchCode: detectBranch(hay),
    brandCode: detectBrand(hay),
    amountKwd: amount,
    matchScore: best?.score ?? 0.35,
    status: applied ? 'APPLIED' : (best?.score ?? 0) >= 0.72 ? 'MATCHED' : 'REVIEW',
    updates: best && best.score >= 0.45 ? [...updates, `supplier:${best.name}`] : updates,
    expiryDate: extractExpiry(hay),
  }
}

async function routeSalesDelivery(
  hay: string,
  fileName: string,
  buf: Buffer | null,
  actorId: string,
): Promise<RouteResult> {
  const updates: string[] = []
  let platformCode: string | null = null
  let category = 'sales_report'
  let categoryLabelAr = 'تقرير مبيعات'
  let categoryLabelEn = 'Sales report'

  const platforms: Array<[RegExp, string, string, string]> = [
    [/talabat|طلبات/i, 'TALABAT', 'كشف طلبات Talabat', 'Talabat settlement'],
    [/deliveroo|ديليفرو/i, 'DELIVEROO', 'كشف ديليفرو', 'Deliveroo settlement'],
    [/jahez|جاهز/i, 'JAHEZ', 'كشف جاهز', 'Jahez settlement'],
    [/\bcari\b|كاري/i, 'CARI', 'كشف كاري', 'Cari settlement'],
    [/keeta|كيتا/i, 'KEETA', 'كشف كيتا', 'Keeta settlement'],
    [/snoonu|سنونو/i, 'SNOONU', 'كشف سنونو', 'Snoonu settlement'],
  ]
  for (const [re, code, ar, en] of platforms) {
    if (re.test(hay)) {
      platformCode = code
      category = `settlement_${code.toLowerCase()}`
      categoryLabelAr = ar
      categoryLabelEn = en
      break
    }
  }
  if (/pos|نقطة.?بيع|cashier/i.test(hay) && !platformCode) {
    category = 'pos_sales'
    categoryLabelAr = 'مبيعات نقاط البيع'
    categoryLabelEn = 'POS sales'
  }

  let channel: string | null = null
  if (/\btgo\b|talabat.?go|منصة|aggregator.?delivery/i.test(hay)) {
    channel = 'TGO'
    updates.push('commission_model:TGO_17pct')
  } else if (/\bmp\b|marketplace|توصيل.?الشركة|own.?fleet/i.test(hay)) {
    channel = 'MP'
    updates.push('commission_model:MP_10pct')
  }
  if (/offline|اغلاق|إغلاق|closed/i.test(hay)) updates.push('offline_period_flagged')

  const branch = detectBranch(hay)
  const brand = detectBrand(hay)
  const amount = extractAmountKwd(hay)
  let score = platformCode ? 0.85 : 0.5
  if (platformCode) {
    const p = await prisma.deliveryPlatform.findFirst({
      where: { OR: [{ code: platformCode }, { nameEn: { contains: platformCode.slice(0, 4) } }] },
    })
    if (p) {
      updates.push(`platform:${p.code}`)
      score = 0.93
      platformCode = p.code
    } else {
      updates.push(`platform_hint:${platformCode}`)
    }
  }

  let applied = 0
  if (buf && /\.(xlsx|xls|csv)$/i.test(fileName) && platformCode) {
    const rows = sheetObjects(buf, fileName)
    let gross = 0
    let commission = 0
    let net = 0
    for (const row of rows.slice(0, 1000)) {
      const g = Number(cell(row, ['gross', 'sales', 'مبيعات', 'amount', 'اجمالي', 'إجمالي']) || 0)
      const c = Number(cell(row, ['commission', 'عمولة', 'fee']) || 0)
      const n = Number(cell(row, ['net', 'payout', 'صافي', 'transfer']) || 0)
      if (g > 0) gross += g
      if (c > 0) commission += c
      if (n > 0) net += n
    }
    if (gross > 0 || net > 0) {
      if (commission <= 0 && channel === 'TGO') commission = Math.round(gross * 0.17 * 1000) / 1000
      if (commission <= 0 && channel === 'MP') commission = Math.round(gross * 0.1 * 1000) / 1000
      if (net <= 0) net = Math.round((gross - commission) * 1000) / 1000
      try {
        await prisma.deliverySettlement.create({
          data: {
            platformCode,
            brandCode: brand,
            periodLabel: fileName.slice(0, 80),
            grossAmount: gross || amount || 0,
            commissionAmount: commission,
            netPayout: net,
            status: 'DRAFT',
            createdById: actorId,
          },
        })
        applied = 1
        updates.push(`settlement_draft:gross=${(gross || 0).toFixed(3)}:net=${net.toFixed(3)}`)
        score = 0.95
      } catch (error) {
        updates.push(`settlement_calc:gross=${(gross || 0).toFixed(3)}:net=${net.toFixed(3)}`)
        logger.warn('delivery_settlement_create_soft', {
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        score = 0.88
      }
    }
  }

  return {
    category,
    categoryLabelAr,
    categoryLabelEn,
    entityKey: platformCode,
    entityLabel: platformCode,
    branchCode: branch,
    brandCode: brand,
    amountKwd: amount,
    matchScore: score,
    status: applied ? 'APPLIED' : score >= 0.72 ? 'MATCHED' : 'REVIEW',
    updates: channel ? [...updates, `channel:${channel}`] : updates,
    expiryDate: null,
  }
}

async function routeGovernance(hay: string, fileName: string): Promise<RouteResult> {
  const updates: string[] = []
  let category = 'license'
  let categoryLabelAr = 'رخصة / مستند قانوني'
  let categoryLabelEn = 'License / legal doc'
  if (/fire|اطفاء|إطفاء|safety/i.test(hay)) {
    category = 'fire_permit'
    categoryLabelAr = 'ترخيص إطفاء'
    categoryLabelEn = 'Fire safety permit'
  } else if (/municip|بلدي|صحة|health.?permit|صحة.?عامة/i.test(hay)) {
    category = 'municipality'
    categoryLabelAr = 'ترخيص بلدية / صحة'
    categoryLabelEn = 'Municipality / health permit'
  } else if (/advert|اعلان|إعلان|signage/i.test(hay)) {
    category = 'advertising'
    categoryLabelAr = 'ترخيص إعلانات'
    categoryLabelEn = 'Advertising permit'
  } else if (/lease|ايجار|إيجار|rent.?contract/i.test(hay)) {
    category = 'lease'
    categoryLabelAr = 'عقد إيجار فرع'
    categoryLabelEn = 'Branch lease contract'
  } else if (/vehicle|سياره|سيارة|registration|دفتر/i.test(hay)) {
    category = 'vehicle'
    categoryLabelAr = 'دفتر / تسجيل مركبة'
    categoryLabelEn = 'Vehicle registration'
  } else if (/commercial|تجار|trade.?licen/i.test(hay)) {
    category = 'trade_license'
    categoryLabelAr = 'رخصة تجارية'
    categoryLabelEn = 'Commercial trade license'
  }

  const expiry = extractExpiry(hay)
  if (expiry) {
    const days = Math.ceil((expiry.getTime() - Date.now()) / 86_400_000)
    updates.push(`expiry:${expiry.toISOString().slice(0, 10)}`)
    if (days <= 30) updates.push('renewal_alert:30d')
    else if (days <= 60) updates.push('renewal_alert:60d')
    else updates.push('renewal_ok')
  }
  const branch = detectBranch(hay)
  if (branch) updates.push(`branch:${branch}`)

  return {
    category,
    categoryLabelAr,
    categoryLabelEn,
    entityKey: branch || category,
    entityLabel: branch ? `فرع ${branch}` : categoryLabelAr,
    branchCode: branch,
    brandCode: detectBrand(hay),
    amountKwd: extractAmountKwd(hay),
    matchScore: branch || expiry ? 0.85 : 0.55,
    status: branch || expiry ? 'MATCHED' : 'REVIEW',
    updates,
    expiryDate: expiry,
  }
}

async function routeCrmProjects(hay: string, fileName: string, buf: Buffer | null): Promise<RouteResult> {
  const updates: string[] = []
  let category = 'customer_doc'
  let categoryLabelAr = 'مستند عميل'
  let categoryLabelEn = 'Customer document'
  if (/catering|كاترينج|تموين/i.test(hay)) {
    category = 'catering_contract'
    categoryLabelAr = 'عقد كاترينج'
    categoryLabelEn = 'Catering contract'
  } else if (/school|canteen|مقصف|مدرسة/i.test(hay)) {
    category = 'school_canteen'
    categoryLabelAr = 'عقد مقصف مدرسة'
    categoryLabelEn = 'School canteen contract'
  } else if (/mishref|expo|defense|police|معرض|معسكر/i.test(hay)) {
    category = 'expo_camp'
    categoryLabelAr = 'عقد معرض / معسكر'
    categoryLabelEn = 'Expo / camp contract'
  } else if (/customer|عميل|clients?/i.test(hay) && /\.(xlsx|xls|csv)$/i.test(fileName)) {
    category = 'customer_sheet'
    categoryLabelAr = 'قائمة عملاء'
    categoryLabelEn = 'Customer list'
  }

  const customers = await prisma.customer.findMany({ take: 400, select: { id: true, name: true } })
  let best: { id: string; name: string; score: number } | null = null
  const hayN = normalize(hay)
  for (const c of customers) {
    const cn = normalize(c.name)
    if (!cn) continue
    let score = hayN.includes(cn) ? 0.95 : 0
    if (!score) {
      const parts = cn.split(/\s+/).filter((t) => t.length > 2)
      const hits = parts.filter((t) => hayN.includes(t)).length
      if (parts.length) score = hits / parts.length
    }
    if (!best || score > best.score) best = { id: c.id, name: c.name, score }
  }

  let applied = 0
  if (buf && category === 'customer_sheet') {
    const rows = sheetObjects(buf, fileName)
    for (const row of rows.slice(0, 300)) {
      const name = cell(row, ['name', 'customer', 'عميل', 'الاسم'])
      const phone = cell(row, ['phone', 'mobile', 'هاتف', 'جوال'])
      if (!name || name.length < 2) continue
      const existing = await prisma.customer.findFirst({ where: { name } })
      if (existing) {
        if (phone && !existing.phone) {
          await prisma.customer.update({ where: { id: existing.id }, data: { phone } })
          applied += 1
        }
      } else {
        try {
          await prisma.customer.create({
            data: { name, phone: phone || null, customData: JSON.stringify({ source: 'smart_ingest' }) },
          })
          applied += 1
        } catch {
          /* skip dup */
        }
      }
    }
    if (applied) updates.push(`customers_upserted:${applied}`)
  }

  const amount = extractAmountKwd(hay)
  if (amount != null) updates.push(`contract_value_kwd:${amount.toFixed(3)}`)

  return {
    category,
    categoryLabelAr,
    categoryLabelEn,
    entityKey: best && best.score >= 0.45 ? best.id : category,
    entityLabel: best && best.score >= 0.45 ? best.name : categoryLabelAr,
    branchCode: detectBranch(hay),
    brandCode: detectBrand(hay),
    amountKwd: amount,
    matchScore: applied ? 0.95 : best?.score ?? 0.4,
    status: applied ? 'APPLIED' : (best?.score ?? 0) >= 0.72 ? 'MATCHED' : 'REVIEW',
    updates: best && best.score >= 0.45 ? [...updates, `customer:${best.name}`] : updates,
    expiryDate: extractExpiry(hay),
  }
}

async function routeModule(
  mod: SmartIngestModule,
  hay: string,
  fileName: string,
  buf: Buffer | null,
  mime: string,
  actorId: string,
): Promise<RouteResult> {
  switch (mod) {
    case 'accounting':
      return routeAccounting(hay, fileName, buf)
    case 'inventory':
      return routeInventory(hay, fileName, buf, mime)
    case 'purchases':
      return routePurchases(hay, fileName, buf)
    case 'sales_delivery':
      return routeSalesDelivery(hay, fileName, buf, actorId)
    case 'governance':
      return routeGovernance(hay, fileName)
    case 'crm_projects':
      return routeCrmProjects(hay, fileName, buf)
  }
}

export async function ingestUniversalBatch(input: {
  module: string
  actorId: string
  batchId?: string
  files: IngestFileInput[]
}): Promise<UniversalIngestBatch> {
  if (!isSmartIngestModule(input.module)) {
    throw new Error(`unsupported_module:${input.module}`)
  }
  const mod = input.module
  const batchId = input.batchId || `batch_${Date.now().toString(36)}`
  const rows: UniversalIngestRow[] = []
  let matched = 0
  let review = 0
  let appliedRows = 0

  for (const file of input.files) {
    const fileName = file.fileName || file.relativePath.split(/[/\\]/).pop() || 'file'
    const relativePath = file.relativePath || fileName
    try {
      const mime = file.mimeType || 'application/octet-stream'
      const buf = bufferFromBase64(file.contentBase64)
      const sizeBytes = file.sizeBytes ?? buf?.byteLength ?? 0
      const text = `${file.textHint || ''} ${textFromBuffer(buf, mime, fileName)}`
      const hay = `${relativePath} ${fileName} ${text}`
      const routed = await routeModule(mod, hay, fileName, buf, mime, input.actorId)

      let fileUrl: string | null = null
      let fileType: string | null = mime
      if (buf && sizeBytes > 0) {
        try {
          const stored = await storeDeptBinary({
            buffer: buf,
            fileName,
            mimeType: mime,
            module: mod,
            entityKey: routed.entityKey,
          })
          fileUrl = stored.fileUrl
          fileType = stored.fileType
          routed.updates.push(`stored:${stored.storageKey}`)

          // Bind menu image URL into product.customData when applicable
          if (mod === 'inventory' && routed.category === 'menu_image' && routed.entityKey) {
            const product = await prisma.product.findFirst({ where: { code: routed.entityKey } })
            if (product) {
              let custom: Record<string, unknown> = {}
              try {
                custom = JSON.parse(product.customData || '{}') as Record<string, unknown>
              } catch {
                custom = {}
              }
              custom.imageUrl = fileUrl
              custom.imagePending = false
              await prisma.product.update({
                where: { id: product.id },
                data: { customData: JSON.stringify(custom) },
              })
              routed.updates.push('pos_image_url_set')
            }
          }
        } catch (error) {
          logger.warn('dept_file_store_failed', {
            fileName,
            errorMessage: error instanceof Error ? error.message : String(error),
          })
        }
      }

      if (routed.status === 'APPLIED') appliedRows += 1
      if (routed.status === 'MATCHED' || routed.status === 'APPLIED') matched += 1
      else review += 1

      const amountMinor =
        routed.amountKwd != null ? Math.round(routed.amountKwd * 1000) : null

      const created = await prisma.deptIngestDocument.create({
        data: {
          module: mod,
          batchId,
          fileName: fileName.slice(0, 500),
          relativePath: relativePath.slice(0, 2000),
          category: routed.category,
          mimeType: mime.slice(0, 200),
          sizeBytes,
          fileUrl,
          fileType,
          extractedText: text.slice(0, 4000) || null,
          entityKey: routed.entityKey,
          entityLabel: routed.entityLabel,
          branchCode: routed.branchCode,
          brandCode: routed.brandCode,
          amountMinor,
          currency: 'KWD',
          expiryDate: routed.expiryDate,
          matchScore: routed.matchScore,
          status: routed.status,
          updatesJson: JSON.stringify(routed.updates),
          metaJson: JSON.stringify({ actorId: input.actorId }),
        },
      })

      try {
        await prisma.activityLog.create({
          data: {
            userId: input.actorId,
            action: 'DEPT_SMART_INGEST',
            module: mod,
            details: JSON.stringify({
              documentId: created.id,
              fileName,
              category: routed.category,
              entityKey: routed.entityKey,
              updates: routed.updates,
            }),
          },
        })
      } catch {
        /* non-fatal */
      }

      rows.push({
        id: created.id,
        module: mod,
        fileName,
        relativePath,
        category: routed.category,
        categoryLabelAr: routed.categoryLabelAr,
        categoryLabelEn: routed.categoryLabelEn,
        entityKey: routed.entityKey,
        entityLabel: routed.entityLabel,
        branchCode: routed.branchCode,
        brandCode: routed.brandCode,
        amountKwd: routed.amountKwd,
        matchScore: routed.matchScore,
        status: routed.status,
        updates: routed.updates,
        expiryDate: routed.expiryDate ? routed.expiryDate.toISOString().slice(0, 10) : null,
        fileUrl,
      })
    } catch (error) {
      logger.warn('universal_ingest_file_soft_skip', {
        module: mod,
        fileName,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      rows.push({
        id: `skip_${Date.now()}_${rows.length}`,
        module: mod,
        fileName,
        relativePath,
        category: 'other',
        categoryLabelAr: 'تم التخطي',
        categoryLabelEn: 'Skipped',
        entityKey: null,
        entityLabel: null,
        branchCode: null,
        brandCode: null,
        amountKwd: null,
        matchScore: 0,
        status: 'SKIPPED',
        updates: ['file_soft_skip'],
        expiryDate: null,
        fileUrl: null,
      })
    }
  }

  return { batchId, module: mod, processed: rows.length, matched, review, appliedRows, rows }
}

export async function listDeptIngestBatch(mod: string, batchId: string) {
  return prisma.deptIngestDocument.findMany({
    where: { module: mod, batchId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
}
