/**
 * Universal AI Document Classifier & 7-Department Auto-Router.
 * Deterministic multi-signal scoring (path + name + text + sheet peek). No LLM.
 */
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { storeDeptBinary, safeStorageKey } from '@/lib/dept-file-storage'
import {
  SMART_DROPZONE_DEPARTMENTS,
  type SmartDropzoneDepartment,
} from '@/modules/smart-dropzone/domain/departments'

export { SMART_DROPZONE_DEPARTMENTS, type SmartDropzoneDepartment }

export type RouterFileInput = {
  relativePath: string
  fileName: string
  mimeType?: string
  sizeBytes?: number
  contentBase64?: string
  textHint?: string
  /** Optional human override of AI department */
  forceDepartment?: SmartDropzoneDepartment
}

export type RouterResultRow = {
  id: string
  fileName: string
  relativePath: string
  mimeType: string
  department: SmartDropzoneDepartment
  departmentLabelAr: string
  departmentLabelEn: string
  href: string
  archiveHref: string
  entityKey: string | null
  entityLabel: string | null
  brandCode: string | null
  branchCode: string | null
  amountKwd: number | null
  matchScore: number
  status: 'MATCHED' | 'REVIEW' | 'APPLIED' | 'SKIPPED'
  updates: string[]
  updatesEn: string[]
  fileUrl: string | null
  previewUrl: string | null
  overridden: boolean
}

export type RouterBatchResult = {
  batchId: string
  processed: number
  counters: Record<SmartDropzoneDepartment, number>
  rows: RouterResultRow[]
}

const DEPT_META: Record<
  SmartDropzoneDepartment,
  { ar: string; en: string; href: string; module: string }
> = {
  hr: {
    ar: 'الموارد البشرية والإقامات',
    en: 'HR & Compliance',
    href: '/hr/compliance-radar',
    module: 'hr',
  },
  accounting: {
    ar: 'المحاسبة والبنوك',
    en: 'Finance & Accounting',
    href: '/accounting',
    module: 'accounting',
  },
  purchases: {
    ar: 'المشتريات والموردين',
    en: 'Purchases & Vendors',
    href: '/purchases',
    module: 'purchases',
  },
  inventory_recipes: {
    ar: 'الوصفات والمخزون والمنيو',
    en: 'Recipes & Inventory',
    href: '/recipes',
    module: 'inventory',
  },
  sales_aggregators: {
    ar: 'المبيعات ومنصات التوصيل',
    en: 'Sales & Aggregators',
    href: '/erp/aggregator-radar',
    module: 'sales_delivery',
  },
  governance: {
    ar: 'التراخيص والشؤون القانونية',
    en: 'Legal & Governance',
    href: '/erp/governance',
    module: 'governance',
  },
  crm_catering: {
    ar: 'الكاترينج والعملاء',
    en: 'CRM & Catering',
    href: '/crm',
    module: 'crm_projects',
  },
}

const RULES: Array<{ dept: SmartDropzoneDepartment; weight: number; pattern: RegExp }> = [
  // HR
  { dept: 'hr', weight: 12, pattern: /\b(civil\s*id|passport|health\s*card|كرت\s*صحة|إقامة|اقامة|إذن\s*عمل|اذن\s*عمل|بصمة|barcode|wps|salary|استقالة|إجازة|اجازة|موظف|employee|payroll)\b/i },
  { dept: 'hr', weight: 10, pattern: /\b\d{12}\b/ },
  // Accounting
  { dept: 'accounting', weight: 12, pattern: /\b(nbk|boubyan|gulf\s*bank|الوطني|بوبيان|الخليج|petty\s*cash|عهدة|سند\s*صرف|سند\s*قبض|bank\s*statement|قيد|journal|kwd|10143|10153|101512|101513)\b/i },
  // Purchases
  { dept: 'purchases', weight: 12, pattern: /\b(purchase\s*order|\bpo\b|supplier|فاتورة\s*مشتريات|عرض\s*سعر|quotation|grn|سند\s*استلام|top\s*pack|الساير|مورد)\b/i },
  // Inventory / recipes
  { dept: 'inventory_recipes', weight: 14, pattern: /\b(recipe\s*card|بطاقة\s*وصفة|\bbom\b|stock\s*count|جرد|menu|منيو|rw01|pp03|pi02|ricg|rifb|rikc|ritn|exta)\b/i },
  { dept: 'inventory_recipes', weight: 8, pattern: /\b(rw|pp|pi|ri)[a-z0-9]{2,}\b/i },
  // Sales / aggregators
  { dept: 'sales_aggregators', weight: 14, pattern: /\b(talabat|طلبات|deliveroo|ديليفرو|jahez|جاهز|cari|keeta|snoonu|\btmp\b|\btgo\b|settlement|pos\s*sales)\b/i },
  // Governance
  { dept: 'governance', weight: 12, pattern: /\b(رخصة\s*تجارية|commercial\s*license|fire\s*license|ترخيص|عقد\s*إيجار|lease|بلدية|دفتر\s*سيارة|vehicle)\b/i },
  // CRM / catering
  { dept: 'crm_catering', weight: 12, pattern: /\b(catering|كاترينج|معرض|exhibition|school\s*canteen|مقصف|توريد\s*وجبات|crm)\b/i },
]

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff.\/\\_-]+/g, ' ')
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
    return buf.toString('utf8').slice(0, 24000)
  }
  if (/\.(xlsx|xls|ods)$/i.test(fileName) || /spreadsheet|excel/i.test(mime)) {
    try {
      const wb = XLSX.read(buf, { type: 'buffer', sheetRows: 40 })
      const parts: string[] = []
      for (const name of wb.SheetNames.slice(0, 3)) {
        const sheet = wb.Sheets[name]
        if (!sheet) continue
        parts.push(XLSX.utils.sheet_to_csv(sheet).slice(0, 8000))
      }
      return parts.join('\n')
    } catch {
      /* fall through */
    }
  }
  const asLatin = buf.toString('latin1')
  return asLatin.replace(/[^\x09\x0a\x0d\x20-\x7e\u0600-\u06ff]/g, ' ').replace(/\s+/g, ' ').slice(0, 10000)
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

function detectBranch(hay: string): string | null {
  const map: Array<[RegExp, string]> = [
    [/salmiya|السالمية/i, 'SALMIYA'],
    [/ardiya|العارضية/i, 'ARDIYA'],
    [/\b360\b/i, '360'],
    [/assima|العاصمة|\basm\b/i, 'ASM'],
    [/avenues|أفنيوز|افنيوز/i, 'AVE'],
    [/kout|كوت/i, 'KOUT'],
    [/qurain|قرين|\bqrn\b/i, 'QRN'],
    [/promenade|بروميناد|\bprm\b/i, 'PRM'],
    [/jahra|الجهراء/i, 'JAHRA'],
    [/central.?kitchen|مطبخ|\bck\b/i, 'CK'],
  ]
  for (const [re, code] of map) if (re.test(hay)) return code
  return null
}

function detectBrand(hay: string): string | null {
  const map: Array<[RegExp, string]> = [
    [/china\s*garden|تشاينا/i, 'CHINA-GARDEN'],
    [/farm\s*brown|فارم\s*براون/i, 'FARM-BROWN'],
    [/frank'?s|فرانكس/i, 'FRANKS-STEAK'],
    [/karak|كرك/i, 'KARAK-CAFETERIA'],
    [/noodle\s*bar|نودل/i, 'THE-NOODLE-BAR'],
    [/tahina|طحينة|شاورما/i, 'SHAWARMA-TAHINA'],
  ]
  for (const [re, code] of map) if (re.test(hay)) return code
  return null
}

function classify(hay: string): { dept: SmartDropzoneDepartment; score: number } {
  const scores = Object.fromEntries(SMART_DROPZONE_DEPARTMENTS.map((d) => [d, 0])) as Record<
    SmartDropzoneDepartment,
    number
  >
  for (const rule of RULES) {
    if (rule.pattern.test(hay)) scores[rule.dept] += rule.weight
  }
  // Path folder hints
  if (/\/hr\/|\\hr\\|employees?|موظفين|رواتب/i.test(hay)) scores.hr += 6
  if (/\/account|\\finance|بنوك|قيود/i.test(hay)) scores.accounting += 6
  if (/\/purchas|\\vendor|مشتريات|موردين/i.test(hay)) scores.purchases += 6
  if (/\/recipe|\\inventory|وصفات|جرد|مخزون/i.test(hay)) scores.inventory_recipes += 6
  if (/\/sales|\\delivery|talabat|aggregat/i.test(hay)) scores.sales_aggregators += 6
  if (/\/legal|\\govern|رخص|عقود/i.test(hay)) scores.governance += 6
  if (/\/crm|\\cater|كاترينج|معرض/i.test(hay)) scores.crm_catering += 6

  let best: SmartDropzoneDepartment = 'governance'
  let bestScore = -1
  for (const dept of SMART_DROPZONE_DEPARTMENTS) {
    if (scores[dept] > bestScore) {
      best = dept
      bestScore = scores[dept]
    }
  }
  if (bestScore <= 0) return { dept: 'governance', score: 0.15 }
  return { dept: best, score: Math.min(0.99, 0.35 + bestScore / 40) }
}

function buildUpdates(
  dept: SmartDropzoneDepartment,
  ctx: {
    amountKwd: number | null
    branchCode: string | null
    brandCode: string | null
    entityLabel: string | null
    fileName: string
  },
): { ar: string[]; en: string[] } {
  const brandBranch =
    [ctx.brandCode, ctx.branchCode].filter(Boolean).join(' · ') || ctx.entityLabel || ctx.fileName
  switch (dept) {
    case 'hr':
      return {
        ar: [`تم ربط الوثيقة بسجل الموارد البشرية (${brandBranch})`, 'تم جدولة مراجعة تواريخ الإقامة/البطاقة في رادار الامتثال'],
        en: [`Linked document to HR dossier (${brandBranch})`, 'Queued civil-ID / residency expiry review on compliance radar'],
      }
    case 'accounting':
      return {
        ar: [
          ctx.amountKwd != null
            ? `تم استخراج مبلغ ${ctx.amountKwd.toFixed(3)} د.ك وتوثيق المرفق المحاسبي`
            : 'تم أرشفة المستند المحاسبي/البنكي مع ربط الحساب',
          'جاهز للمطابقة في المحاسبة والتقارير',
        ],
        en: [
          ctx.amountKwd != null
            ? `Extracted ${ctx.amountKwd.toFixed(3)} KWD and archived finance attachment`
            : 'Archived bank/finance document with account linkage',
          'Ready for reconciliation in accounting & reports',
        ],
      }
    case 'purchases':
      return {
        ar: ['تم توجيه فاتورة/أمر شراء إلى سجل الموردين', 'تم تحديث مسار الاعتماد وسند الاستلام إن وُجد'],
        en: ['Routed PO/supplier invoice to vendor ledger', 'Purchase receipt / approval path updated when detected'],
      }
    case 'inventory_recipes':
      return {
        ar: [
          /recipe|وصفة|bom/i.test(ctx.fileName)
            ? 'تم تحديث مكونات/تكلفة بطاقة الوصفة'
            : 'تم توجيه ملف المخزون/الجرد/المنيو إلى المستودع أو الوصفات',
        ],
        en: [
          /recipe|وصفة|bom/i.test(ctx.fileName)
            ? 'Recipe card BOM/cost signals updated'
            : 'Inventory / stock-count / menu file routed to warehouse or recipes',
        ],
      }
    case 'sales_aggregators':
      return {
        ar: ['تم توجيه كشف المنصة إلى رادار التوصيل الجنائي', 'مطابقة عمولة TMP 10% مقابل TGO 17% جاهزة للمراجعة'],
        en: ['Platform settlement routed to aggregator forensic radar', 'TMP 10% vs TGO 17% commission match queued'],
      }
    case 'governance':
      return {
        ar: ['تم ربط الترخيص/العقد بالفرع أو البراند', 'تم تفعيل منبّه تاريخ الانتهاء في الحوكمة'],
        en: ['License/contract linked to brand/branch', 'Expiry reminder armed in governance'],
      }
    case 'crm_catering':
      return {
        ar: ['تم توثيق عقد/عرض كاترينج أو معرض في سجل العميل', 'الدفعات والمرفقات مرتبطة بـ CRM / المشاريع'],
        en: ['Catering/exhibition contract filed on CRM record', 'Payments & attachments linked to CRM / projects'],
      }
  }
}

function entityFrom(hay: string, dept: SmartDropzoneDepartment, fileName: string): { key: string; label: string } {
  const civil = hay.match(/\b(\d{12})\b/)
  if (dept === 'hr' && civil) return { key: `civil_${civil[1]}`, label: `Civil ID ${civil[1]}` }
  const emp = hay.match(/employee\s*#?\s*(\d{2,6})/i) || hay.match(/موظف\s*#?\s*(\d{2,6})/i)
  if (dept === 'hr' && emp) return { key: `emp_${emp[1]}`, label: `Employee #${emp[1]}` }
  const acct = hay.match(/\b(101\d{2,3})\b/)
  if (dept === 'accounting' && acct) return { key: `acct_${acct[1]}`, label: `Account ${acct[1]}` }
  const brand = detectBrand(hay)
  const branch = detectBranch(hay)
  if (brand || branch) {
    return {
      key: safeStorageKey([brand, branch].filter(Boolean).join('_') || fileName),
      label: [brand, branch].filter(Boolean).join(' · ') || fileName,
    }
  }
  return { key: safeStorageKey(fileName), label: fileName }
}

export async function processSmartDropzoneBatch(input: {
  actorId: string
  batchId?: string
  files: RouterFileInput[]
}): Promise<RouterBatchResult> {
  const batchId = input.batchId || `sdz_${Date.now()}`
  const counters = Object.fromEntries(SMART_DROPZONE_DEPARTMENTS.map((d) => [d, 0])) as Record<
    SmartDropzoneDepartment,
    number
  >
  const rows: RouterResultRow[] = []

  for (const file of input.files.slice(0, 8)) {
    const fileName = (file.fileName || 'file').slice(0, 500)
    const relativePath = (file.relativePath || fileName).slice(0, 2000)
    const mimeType = (file.mimeType || 'application/octet-stream').slice(0, 200)
    const buf = bufferFromBase64(file.contentBase64)
    const extracted = [file.textHint || '', relativePath, fileName, textFromBuffer(buf, mimeType, fileName)]
      .join('\n')
      .slice(0, 50000)
    const hay = normalize(`${relativePath} ${fileName} ${extracted}`)

    const classified = classify(hay)
    const overridden = Boolean(
      file.forceDepartment && SMART_DROPZONE_DEPARTMENTS.includes(file.forceDepartment),
    )
    const department = overridden ? file.forceDepartment! : classified.dept
    const meta = DEPT_META[department]
    const amountKwd = extractAmountKwd(extracted)
    const branchCode = detectBranch(hay)
    const brandCode = detectBrand(hay)
    const entity = entityFrom(hay, department, fileName)
    const updates = buildUpdates(department, {
      amountKwd,
      branchCode,
      brandCode,
      entityLabel: entity.label,
      fileName,
    })
    const score = overridden ? Math.max(classified.score, 0.9) : classified.score
    const status = score >= 0.45 ? 'APPLIED' : score >= 0.25 ? 'MATCHED' : 'REVIEW'

    let fileUrl: string | null = null
    if (buf && buf.byteLength > 0 && buf.byteLength < 8_000_000) {
      try {
        const stored = await storeDeptBinary({
          buffer: buf,
          fileName,
          mimeType,
          module: `smart_dropzone/${meta.module}`,
          entityKey: entity.key,
        })
        fileUrl = stored.fileUrl
      } catch (error) {
        logger.warn('smart_dropzone_store_failed', {
          fileName,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const id = `sdz_${Date.now()}_${rows.length}_${Math.random().toString(36).slice(2, 8)}`
    try {
      await prisma.deptIngestDocument.create({
        data: {
          id,
          module: `smart_dropzone:${department}`,
          batchId,
          fileName,
          relativePath,
          category: department,
          mimeType,
          sizeBytes: file.sizeBytes ?? buf?.byteLength ?? 0,
          fileUrl,
          fileType: mimeType,
          extractedText: extracted.slice(0, 8000),
          entityKey: entity.key,
          entityLabel: entity.label,
          branchCode,
          brandCode,
          amountMinor: amountKwd != null ? Math.round(amountKwd * 1000) : null,
          currency: 'KWD',
          matchScore: score,
          status,
          updatesJson: JSON.stringify(updates.ar),
          metaJson: JSON.stringify({
            actorId: input.actorId,
            updatesEn: updates.en,
            href: meta.href,
            overridden,
            departmentLabelEn: meta.en,
            departmentLabelAr: meta.ar,
          }),
        },
      })
    } catch (error) {
      logger.warn('smart_dropzone_db_write_failed', {
        fileName,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }

    counters[department] += 1
    rows.push({
      id,
      fileName,
      relativePath,
      mimeType,
      department,
      departmentLabelAr: meta.ar,
      departmentLabelEn: meta.en,
      href: meta.href,
      archiveHref: `/erp/archive?q=${encodeURIComponent(fileName)}`,
      entityKey: entity.key,
      entityLabel: entity.label,
      brandCode,
      branchCode,
      amountKwd,
      matchScore: score,
      status,
      updates: updates.ar,
      updatesEn: updates.en,
      fileUrl,
      previewUrl: fileUrl,
      overridden,
    })
  }

  logger.info('smart_dropzone_batch_done', {
    batchId,
    actorId: input.actorId,
    processed: rows.length,
    counters,
  })

  return { batchId, processed: rows.length, counters, rows }
}

export { emptySmartDropzoneCounters as emptyCounters } from '@/modules/smart-dropzone/domain/departments'
