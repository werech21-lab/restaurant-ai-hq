/**
 * Full codebase Arabic string extraction → comprehensive AR→EN map.
 * Run: npx tsx scripts/extract-all-arabic.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ARABIC_CHUNK = /[\u0600-\u06FF][^"'`<>{}\n\\]*/g
const ARABIC_RE = /[\u0600-\u06FF]/

const SCAN_GLOBS = [
  'src/app',
  'src/components',
  'src/lib',
  'src/modules',
  'src/services',
]

const EXTRA_FILES = ['prisma/seed.ts']

const MANUAL: Record<string, string> = {
  'مستودع جديد': 'New Warehouse / Branch',
  'تحويل مخزني بين الفروع': 'Inter-Branch Stock Transfer',
  'من مستودع': 'From Warehouse / Branch',
  'إلى مستودع': 'To Warehouse / Branch',
  'الموقع': 'Location / Address',
  'المسؤول': 'Manager / Person in Charge',
  'مستودع افتراضي': 'Default Warehouse',
  'حفظ المستودع': 'Save Warehouse',
  'Save المستودع': 'Save Warehouse',
  'ملاحظة': 'Notes / Remarks',
  'ملاحظات': 'Notes / Remarks',
  'تنفيذ التحويل': 'Execute Stock Transfer',
  'تحويل المخزون': 'Execute Stock Transfer',
  'أرصدة المستودعات': 'Warehouse Stock Balances',
  'سجل التحويلات المخزنية': 'Stock Transfers History',
  'تم التحويل': 'Transfer completed',
  'تم الحفظ': 'Saved',
  'رصيد هذا المستودع': 'This warehouse',
  'إجمالي الشركة': 'Company total',
  'لا يوجد رصيد في هذا المستودع.': 'No stock in this warehouse.',
  'دليل الهواتف والبدالة للفروع': 'Branch phone & PBX directory',
  'رصيد كل صنف في كل مستودع، وتحويل الكميات بين الفروع دون تغيير إجمالي المخزون.':
    'Per-warehouse stock balances and branch transfers without changing company-wide totals.',
  ' · افتراضي': ' · Default',
  افتراضي: 'Default',
  'من': 'From',
  'إلى': 'To',
  'الصنف': 'Item',
  'الكمية': 'Qty',
  'الاسم': 'Name',
  'المستودع': 'Warehouse',
  'الفروع': 'Branches',
  'تشاينا جاردن': 'China Garden',
  'فارم براون': 'Farm Brown',
  فرانكس: "Frank's",
  'كرك كافتيريا': 'Karak Cafeteria',
  'ذا نودل بار': 'The Noodle Bar',
  'شاورما طحينة': 'Shawarma Tahina',
  طحينة: 'Shawarma Tahina',
  الفحيحيل: 'Fahaheel',
  الفروانية: 'Farwaniya',
  السالمية: 'Salmiya',
  العارضية: 'Ardiya',
  القرين: 'Al-Qurain',
  'أسواق القرين': 'Al-Qurain',
  الكوت: 'Al-Kout Mall',
  'الكوت مول': 'Al-Kout Mall',
  العاصمة: 'Assima Mall',
  'العاصمة مول': 'Assima Mall',
  الأفنيوز: 'The Avenues',
  البروميناد: 'Promenade Mall',
  الجهراء: 'Jahra',
  الشويخ: 'Shuwaikh',
  الشرق: 'Sharq',
  'صباح الناصر': 'Sabah Al-Nasser',
  'المطبخ المركزي': 'Central Kitchen (CK)',
  'المستودع الرئيسي': 'Main Warehouse',
  'المخزن الرئيسي': 'Main Warehouse',
  حولي: 'Hawally',
  الأحمدي: 'Ahmadi',
  مبارك: 'Mubarak',
  'مبارك الكبير': 'Mubarak Al-Kabeer',
  'وصف القيد': 'Entry description',
  'قيد آلي': 'Auto journal',
  مطابق: 'Matched',
  'نقص إيداع': 'Deposit shortfall',
  'عمولة زائدة': 'Excess commission',
  مراجعة: 'Review',
  عمولة: 'Commission',
  صافي: 'Net',
  تعطيل: 'Disable',
  الكيان: 'Entity',
  'اسم الحقل': 'Field name',
  نص: 'Text',
  رقم: 'Number',
  تاريخ: 'Date',
  الحقل: 'Field',
  الإجراء: 'Action',
  'مبيعات الشهر': 'Month sales',
  'هامش الربح': 'Profit margin',
  'النقد الحالي': 'Cash on hand',
  الأسبوع: 'Week',
  'أصناف راكدة': 'Slow movers',
  'قرب النفاد': 'Near stockout',
  'اتخاذ إجراء آلي': 'Take automated action',
  'فتح الجرد': 'Open stock count',
  رابحة: 'Won',
  خاسرة: 'Lost',
  'جهة الاتصال': 'Contact',
  'غير مسنَد': 'Unassigned',
  الصلاحية: 'Validity',
  'غير مضافة': 'Not added',
  'عدد فواتير الشهر': 'Invoices this month',
  حد: 'Limit',
  مفتوح: 'Open',
  'فحص الصحة': 'Health check',
  'روابط الدفع': 'Payment links',
  مربوط: 'Linked',
  'دليل فقط': 'Directory only',
  'غير مربوط بعد': 'Not linked yet',
  'رفع المجلد الذكي': 'Smart folder upload',
  'رادار الإقامات وكروت البلدية': 'Residency & Health Card Radar',
  'محرك الأتمتة': 'Automation engine',
  'طباعة العرض': 'Print quotation',
  'أشد الأصناف نقصاً': 'Most critical stockouts',
  'آخر فواتير البيع': 'Latest sales invoices',
  'جواز السفر': 'Passport',
  'غير مسجّل': 'Not registered',
  'كل الوثائق': 'All documents',
  'كرت الصحة والبلدية': 'Health & municipality card',
  'تم التسجيل': 'Recorded',
  حاضر: 'Present',
  متأخر: 'Late',
  غائب: 'Absent',
  إجازة: 'Leave',
  'تم التوليد': 'Generated',
  'توليد مسير': 'Generate payroll',
  'تم الصرف': 'Paid out',
  الوظيفة: 'Job title',
  الاستقطاع: 'Deductions',
  الساعات: 'Hours',
  'المسير غير موجود': 'Payslip not found',
  'سجل الرقابة': 'Audit Log',
  التفاصيل: 'Details',
  إيقاف: 'Disable',
  تفعيل: 'Enable',
  مورد: 'Supplier',
  معطلة: 'Disabled',
  مباشر: 'Direct',
  موبايل: 'Mobile',
  'ذكاء الأعمال': 'Business Intelligence',
  'حزمة النشر السحابي': 'Cloud deploy pack',
  'بوابات الدفع': 'Payment gateways',
  النشر: 'Deploy',
}

const WORD_FALLBACK: Record<string, string> = {
  حفظ: 'Save',
  تعديل: 'Edit',
  حذف: 'Delete',
  إضافة: 'Add',
  بحث: 'Search',
  مسح: 'Clear',
  إلغاء: 'Cancel',
  إغلاق: 'Close',
  طباعة: 'Print',
  تصدير: 'Export',
  استيراد: 'Import',
  جديد: 'New',
  جديدة: 'New',
  نشط: 'Active',
  نشطة: 'Active',
  موقوف: 'Inactive',
  موقوفة: 'Inactive',
  الحالة: 'Status',
  التاريخ: 'Date',
  الإجراءات: 'Actions',
  إجراءات: 'Actions',
  المستخدم: 'User',
  المستخدمون: 'Users',
  الدور: 'Role',
  الأدوار: 'Roles',
  الصلاحيات: 'Permissions',
  المخزون: 'Inventory',
  المستودعات: 'Warehouses',
  المشتريات: 'Purchases',
  المبيعات: 'Sales',
  المحاسبة: 'Accounting',
  التقارير: 'Reports',
  الأتمتة: 'Automations',
  العملاء: 'Customers',
  الموردين: 'Suppliers',
  المورد: 'Supplier',
  العميل: 'Customer',
  الفاتورة: 'Invoice',
  فاتورة: 'Invoice',
  الطلب: 'Order',
  الكمية: 'Qty',
  السعر: 'Price',
  الإجمالي: 'Total',
  الخصم: 'Discount',
  الضريبة: 'Tax',
  المدفوع: 'Paid',
  المتبقي: 'Due',
  الرصيد: 'Balance',
  التحويل: 'Transfer',
  الفرع: 'Branch',
  البراند: 'Brand',
  القسم: 'Department',
  الموظف: 'Employee',
  الموظفون: 'Employees',
  الحضور: 'Attendance',
  المسير: 'Payroll',
  الراتب: 'Salary',
  كلمة: 'Password',
  المرور: 'password',
  البريد: 'Email',
  الهاتف: 'Phone',
  الموبايل: 'Mobile',
  الوصف: 'Description',
  البيان: 'Note',
  النوع: 'Type',
  الرمز: 'Code',
  الرقم: 'Number',
  المبلغ: 'Amount',
  الموقع: 'Location',
  المسؤول: 'Manager',
  افتراضي: 'Default',
  ملاحظة: 'Note',
  ملاحظات: 'Notes',
  مستودع: 'Warehouse',
  مخزن: 'Warehouse',
  مخزني: 'stock',
  بين: 'between',
  الفروع: 'branches',
  تنفيذ: 'Execute',
  عرض: 'View',
  الكل: 'All',
  لا: 'No',
  يوجد: 'matching',
  توجد: 'matching',
  جارٍ: '…',
  الحفظ: 'Saving',
  التصدير: 'Exporting',
  التسجيل: 'Recording',
  تحميل: 'Loading',
  خطأ: 'Error',
  نجاح: 'Success',
  تأكيد: 'Confirm',
  رجوع: 'Back',
  التالي: 'Next',
  السابق: 'Previous',
  صفحة: 'Page',
  من: 'From',
  إلى: 'To',
  في: 'in',
  على: 'on',
  هذا: 'this',
  هذه: 'this',
  كل: 'all',
  بدون: 'without',
  مع: 'with',
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '__tests__') continue
      walkFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

function extractFromSource(source: string): string[] {
  const hits: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(ARABIC_CHUNK.source, 'g')
  while ((match = re.exec(source))) {
    const phrase = match[0].replace(/\s+/g, ' ').trim()
    if (phrase.length < 1) continue
    // Drop trailing punctuation noise except Arabic comma / period used in sentences
    const cleaned = phrase.replace(/[\\]+$/g, '').trim()
    if (ARABIC_RE.test(cleaned)) hits.push(cleaned)
  }
  return hits
}

/** Pull `'key': 'value'` pairs from a dictionary block. */
function parseDictBlock(source: string, marker: RegExp): Map<string, string> {
  const map = new Map<string, string>()
  const start = source.search(marker)
  if (start < 0) return map
  const slice = source.slice(start)
  const end = slice.search(/\n cons[t ]+\w+|^\}$/m)
  const body = end > 0 ? slice.slice(0, end) : slice.slice(0, 500_000)
  const pairRe = /['"]([^'"]+)['"]\s*:\s*'((?:\\'|[^'])*)'/g
  let m: RegExpExecArray | null
  while ((m = pairRe.exec(body))) {
    map.set(m[1], m[2].replace(/\\'/g, "'"))
  }
  // Also double-quoted values
  const pairRe2 = /['"]([^'"]+)['"]\s*:\s*"((?:\\"|[^"])*)"/g
  while ((m = pairRe2.exec(body))) {
    map.set(m[1], m[2].replace(/\\"/g, '"'))
  }
  return map
}

function fallbackTranslate(ar: string): string | null {
  if (MANUAL[ar]) return MANUAL[ar]
  // Compose from known words when every token is known
  const tokens = ar.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null
  const parts: string[] = []
  for (const token of tokens) {
    const bare = token.replace(/[،.؟!:]/g, '')
    if (MANUAL[bare]) parts.push(MANUAL[bare])
    else if (WORD_FALLBACK[bare]) parts.push(WORD_FALLBACK[bare])
    else if (!ARABIC_RE.test(bare)) parts.push(bare)
    else return null
  }
  return parts.join(' ')
}

function loadExistingAutoDict(): Record<string, string> {
  const file = path.join(ROOT, 'src/lib/i18n/auto-dictionary.ts')
  if (!fs.existsSync(file)) return {}
  const src = fs.readFileSync(file, 'utf8')
  const out: Record<string, string> = {}
  const pairRe = /'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'/g
  let m: RegExpExecArray | null
  while ((m = pairRe.exec(src))) {
    const k = m[1].replace(/\\'/g, "'")
    const v = m[2].replace(/\\'/g, "'")
    if (ARABIC_RE.test(k)) out[k] = v
  }
  return out
}

function escapeTsString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function main() {
  const files: string[] = []
  for (const rel of SCAN_GLOBS) walkFiles(path.join(ROOT, rel), files)
  for (const rel of EXTRA_FILES) {
    const full = path.join(ROOT, rel)
    if (fs.existsSync(full)) files.push(full)
  }

  const phraseSet = new Set<string>()
  const byFile: Array<{ file: string; count: number }> = []
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    const hits = extractFromSource(source)
    if (hits.length) byFile.push({ file: path.relative(ROOT, file), count: hits.length })
    for (const hit of hits) phraseSet.add(hit)
  }

  // Pair ar/en dictionaries from i18n engines
  const i18nSrc = fs.readFileSync(path.join(ROOT, 'src/lib/i18n.tsx'), 'utf8')
  const panelSrc = fs.readFileSync(path.join(ROOT, 'src/lib/i18n/panel-messages.ts'), 'utf8')
  const arMain = parseDictBlock(i18nSrc, /\nconst ar\s*[:=]/)
  const enMain = parseDictBlock(i18nSrc, /\nconst en\s*[:=]/)
  const arPanel = parseDictBlock(panelSrc, /export const panelAr/)
  const enPanel = parseDictBlock(panelSrc, /export const panelEn/)

  const paired: Record<string, string> = { ...loadExistingAutoDict(), ...MANUAL }
  for (const [key, arVal] of arMain) {
    const enVal = enMain.get(key)
    if (enVal && ARABIC_RE.test(arVal) && !ARABIC_RE.test(enVal)) paired[arVal] = enVal
  }
  for (const [key, arVal] of arPanel) {
    const enVal = enPanel.get(key)
    if (enVal && ARABIC_RE.test(arVal) && !ARABIC_RE.test(enVal)) paired[arVal] = enVal
  }

  let covered = 0
  let fallback = 0
  let baked = 0
  let missing = 0
  const finalMap: Record<string, string> = { ...paired }
  Object.assign(finalMap, MANUAL)
  const seedEntries = Object.entries(finalMap).sort((a, b) => b[0].length - a[0].length)
  const uncovered: string[] = []

  function bakeTranslate(raw: string): string {
    let out = raw
    for (const [ar, en] of seedEntries) {
      if (ar.length >= 2 && out.includes(ar)) out = out.split(ar).join(en)
    }
    // Drop residual Arabic letters that have no mapping (punctuation stays).
    out = out.replace(/[\u0600-\u06FF]+/g, '').replace(/\s{2,}/g, ' ').trim()
    return out || raw
  }

  for (const phrase of [...phraseSet].sort((a, b) => b.length - a.length || a.localeCompare(b))) {
    if (finalMap[phrase]) {
      covered += 1
      continue
    }
    const fb = fallbackTranslate(phrase)
    if (fb) {
      finalMap[phrase] = fb
      fallback += 1
      continue
    }
    const bakedEn = bakeTranslate(phrase)
    if (bakedEn && bakedEn !== phrase && !ARABIC_RE.test(bakedEn)) {
      finalMap[phrase] = bakedEn
      baked += 1
    } else if (bakedEn && bakedEn !== phrase) {
      // Still has Arabic leftovers — store the partially translated form; runtime will finish.
      finalMap[phrase] = bakedEn
      baked += 1
      if (ARABIC_RE.test(bakedEn)) uncovered.push(phrase)
    } else {
      uncovered.push(phrase)
      missing += 1
    }
  }

  // Ensure every MANUAL + brand/area key is present (overrides)
  Object.assign(finalMap, MANUAL)

  const sortedEntries = Object.entries(finalMap).sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]))

  const outPath = path.join(ROOT, 'src/lib/i18n/comprehensive-ar-en-map.ts')
  const body = sortedEntries
    .map(([ar, en]) => `  '${escapeTsString(ar)}': '${escapeTsString(en)}',`)
    .join('\n')

  const fileContents = `/**
 * AUTO-GENERATED by scripts/extract-all-arabic.ts — do not hand-edit large blocks.
 * Longest-match-first map for GlobalAutoTranslator (Zero Arabic in EN mode).
 * Phrases: ${sortedEntries.length} | source hits: ${phraseSet.size} | paired: ${Object.keys(paired).length}
 */
export const COMPREHENSIVE_AR_EN: Record<string, string> = {
${body}
}

export const COMPREHENSIVE_AR_EN_ENTRIES: Array<[string, string]> = Object.entries(COMPREHENSIVE_AR_EN).sort(
  (a, b) => b[0].length - a[0].length,
)

export const ARABIC_RE = /[\\u0600-\\u06FF]/

/**
 * Longest-match-first translator. Exact hit wins; otherwise replace phrases longest→shortest.
 * Also repairs broken hybrids like "Save المستودع".
 */
export function translateArabicText(raw: string): string {
  const text = raw.trim()
  if (!text || !ARABIC_RE.test(text)) return raw
  const leading = raw.match(/^\\s*/)?.[0] ?? ''
  const trailing = raw.match(/\\s*$/)?.[0] ?? ''
  let out = COMPREHENSIVE_AR_EN[text] ?? raw
  if (out === raw || ARABIC_RE.test(out)) {
    out = raw
    for (const [ar, en] of COMPREHENSIVE_AR_EN_ENTRIES) {
      if (ar && out.includes(ar)) out = out.split(ar).join(en)
    }
  }
  // Absolute EN guarantee: remove any residual Arabic script glyphs.
  if (ARABIC_RE.test(out)) {
    const stripped = out.replace(/[\\u0600-\\u06FF]+/g, ' ').replace(/\\s{2,}/g, ' ').trim()
    out = stripped || '—'
  }
  return \`\${leading}\${out}\${trailing}\`
}
`

  fs.writeFileSync(outPath, fileContents, 'utf8')

  const reportPath = path.join(ROOT, 'scripts/arabic-extraction-report.json')
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        filesScanned: files.length,
        uniquePhrasesFound: phraseSet.size,
        mapEntries: sortedEntries.length,
        coveredExactOrPaired: covered,
        coveredByFallback: fallback,
        coveredBySubstringBake: baked,
        stillUnmappedAtGeneration: missing,
        topFiles: byFile.sort((a, b) => b.count - a.count).slice(0, 40),
        sampleUnmapped: uncovered.slice(0, 80),
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log('=== Arabic extraction report ===')
  console.log('Files scanned:', files.length)
  console.log('Unique Arabic phrases:', phraseSet.size)
  console.log('Map entries written:', sortedEntries.length)
  console.log('Covered via i18n/manual:', covered)
  console.log('Covered via word fallback:', fallback)
  console.log('Covered via substring bake:', baked)
  console.log('Unmapped (rely on runtime substring):', missing)
  console.log('Wrote', path.relative(ROOT, outPath))
  console.log('Wrote', path.relative(ROOT, reportPath))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
