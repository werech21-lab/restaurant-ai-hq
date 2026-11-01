/**
 * Smart HR folder ingest: match employees, classify docs, apply Excel/CSV rows.
 */
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { storeHrBinary } from '@/lib/hr-file-storage'
import { matchDirectoryPerson } from '@/lib/vf-contact-directory'

export const HR_DOC_CATEGORIES = [
  'civil_id',
  'passport_work',
  'health_card',
  'driving',
  'contract_payslip',
  'sick_medical',
  'avatar',
  'attendance_sheet',
  'payroll_sheet',
  'employee_sheet',
  'other',
] as const

export type HrDocCategory = (typeof HR_DOC_CATEGORIES)[number]

export type IngestFileInput = {
  relativePath: string
  fileName: string
  mimeType?: string
  sizeBytes?: number
  /** base64 without data: prefix */
  contentBase64?: string
  /** Optional plain text preview from client */
  textHint?: string
}

export type IngestResultRow = {
  id: string
  fileName: string
  relativePath: string
  category: HrDocCategory
  categoryLabelAr: string
  categoryLabelEn: string
  employeeId: string | null
  employeeName: string | null
  employeeCode: string | null
  matchScore: number
  status: 'MATCHED' | 'REVIEW' | 'APPLIED' | 'SKIPPED'
  updates: string[]
  expiryDate: string | null
  civilId: string | null
}

export type IngestBatchResult = {
  batchId: string
  processed: number
  matched: number
  review: number
  appliedRows: number
  rows: IngestResultRow[]
}

type Emp = { id: string; code: string; name: string; phone: string | null; jobTitle: string; department: string }

const CATEGORY_LABELS: Record<HrDocCategory, { ar: string; en: string }> = {
  civil_id: { ar: 'البطاقة المدنية والإقامة', en: 'Civil ID & Residency' },
  passport_work: { ar: 'جواز السفر وإذن العمل', en: 'Passport & Work Permit' },
  health_card: { ar: 'كرت الصحة والبلدية', en: 'Municipality Health Card' },
  driving: { ar: 'رخصة القيادة والمخالفات', en: 'Driving License & Traffic' },
  contract_payslip: { ar: 'عقد العمل وقسائم الراتب', en: 'Employment Contract & Payslips' },
  sick_medical: { ar: 'الإجازات المرضية والتقارير الطبية', en: 'Sick Leaves & Medical' },
  avatar: { ar: 'الصورة الشخصية', en: 'Employee Avatar/Photo' },
  attendance_sheet: { ar: 'جدول حضور', en: 'Attendance sheet' },
  payroll_sheet: { ar: 'جدول رواتب', en: 'Payroll sheet' },
  employee_sheet: { ar: 'بيانات موظفين', en: 'Employee data sheet' },
  other: { ar: 'مستند عام', en: 'Other document' },
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim()
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((t) => t.length > 1)
}

function nameScore(a: string, b: string): number {
  const ta = new Set(tokens(a))
  const tb = tokens(b)
  if (ta.size === 0 || tb.length === 0) return 0
  let hit = 0
  for (const t of tb) if (ta.has(t)) hit += 1
  const overlap = hit / Math.max(ta.size, tb.length)
  const includes = normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a))
  return Math.min(1, overlap + (includes ? 0.25 : 0))
}

function classifyPath(relativePath: string, fileName: string, text: string): HrDocCategory {
  const hay = `${relativePath} ${fileName} ${text}`.toLowerCase()
  if (/civil|iqama|اقامة|إقامة|مدني|residen|civil.?id|cid/.test(hay)) return 'civil_id'
  if (/passport|جواز|شؤون|shoun|work.?permit|visa/.test(hay)) return 'passport_work'
  if (/health|بلدي|صح[ةه]|municip|medical.?card/.test(hay)) return 'health_card'
  if (/driv|رخص|مرور|traffic|license/.test(hay)) return 'driving'
  if (/contract|عقد|payslip|قسيم|راتب|salary|wage/.test(hay) && !/\.xlsx?$|\.csv$/i.test(fileName)) return 'contract_payslip'
  if (/sick|مرض|medical|تقرير طبي|leave/.test(hay)) return 'sick_medical'
  if (/\.(jpe?g|png|webp)$/i.test(fileName) && /avatar|photo|صورة|profile|personal|face/.test(hay)) return 'avatar'
  if (/\.(jpe?g|png|webp)$/i.test(fileName) && /\/photos?\/|\/صور|headshot/.test(hay)) return 'avatar'
  return 'other'
}

function extractCivilId(text: string): string | null {
  const m = text.match(/\b\d{12}\b/) || text.match(/\b\d{3}\s?\d{4}\s?\d{5}\b/)
  return m ? m[0].replace(/\s/g, '') : null
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

function bufferFromBase64(b64?: string): Buffer | null {
  if (!b64) return null
  try {
    return Buffer.from(b64.replace(/^data:[^;]+;base64,/, ''), 'base64')
  } catch {
    return null
  }
}

function sheetToObjects(buf: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
}

function csvToObjects(text: string): Record<string, unknown>[] {
  const wb = XLSX.read(text, { type: 'string' })
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
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

function detectSheetKind(rows: Record<string, unknown>[]): 'employee' | 'payroll' | 'attendance' | 'unknown' {
  if (rows.length === 0) return 'unknown'
  const headers = Object.keys(rows[0]!).map(normalize).join(' ')
  if (/check.?in|check.?out|attendance|حضور|انصراف/.test(headers)) return 'attendance'
  if (/net.?wage|basic|allowance|salary|wage|راتب|مسير|payroll/.test(headers)) return 'payroll'
  if (/employee|name|اسم|job|phone|email|civil|barcode|code|موظف/.test(headers)) return 'employee'
  return 'unknown'
}

function resolveEmployee(haystack: string, employees: Emp[]): { emp: Emp; score: number } | null {
  const hay = normalize(haystack)
  const codeMatch = hay.match(/\b(\d{3,6})\b/g) || []
  for (const code of codeMatch) {
    const emp = employees.find((e) => e.code === code || e.code.endsWith(code))
    if (emp) return { emp, score: 1 }
  }
  let best: { emp: Emp; score: number } | null = null
  for (const emp of employees) {
    let score = nameScore(emp.name, haystack)
    if (emp.phone) {
      const digits = emp.phone.replace(/\D/g, '')
      if (digits && hay.replace(/\D/g, '').includes(digits.slice(-8))) score = Math.max(score, 0.95)
    }
    if (hay.includes(normalize(emp.code))) score = Math.max(score, 0.98)
    const dir = matchDirectoryPerson(emp.name)
    if (dir?.email && hay.includes(normalize(dir.email))) score = Math.max(score, 0.97)
    if (!best || score > best.score) best = { emp, score }
  }
  if (!best || best.score < 0.45) return null
  return best
}

async function applyEmployeeSheet(rows: Record<string, unknown>[], employees: Emp[], actorId: string): Promise<number> {
  let applied = 0
  for (const row of rows) {
    const name = cell(row, ['name', 'employee', 'employee name', 'الاسم', 'اسم الموظف', 'full name'])
    const code = cell(row, ['code', 'barcode', 'badge', 'emp id', 'employee id', 'الرقم الوظيفي', 'بصمة'])
    const phone = cell(row, ['phone', 'mobile', 'whatsapp', 'هاتف', 'موبايل'])
    const email = cell(row, ['email', 'mail', 'بريد'])
    const job = cell(row, ['job', 'job title', 'title', 'position', 'المسمى', 'الوظيفة'])
    const dept = cell(row, ['department', 'dept', 'القسم'])
    const civil = cell(row, ['civil', 'civil id', 'civil_id', 'iqama', 'الرقم المدني'])
    if (!name && !code) continue
    const resolved =
      (code && employees.find((e) => e.code === code)) ||
      (name ? resolveEmployee(name, employees)?.emp : null) ||
      null
    const phoneValue = [phone || null, email || null, civil ? `CID ${civil}` : null].filter(Boolean).join(' · ').slice(0, 80)
    if (resolved) {
      await prisma.employee.update({
        where: { id: resolved.id },
        data: {
          phone: phoneValue || resolved.phone,
          jobTitle: job || undefined,
          department: dept || undefined,
        },
      })
      applied += 1
    } else if (name) {
      const newCode = (code || `VF${String(applied + 1).padStart(4, '0')}`).slice(0, 20)
      const exists = await prisma.employee.findUnique({ where: { code: newCode } })
      if (!exists) {
        await prisma.employee.create({
          data: {
            code: newCode,
            name: name.slice(0, 120),
            jobTitle: (job || 'موظف').slice(0, 80),
            department: (dept || 'عام').slice(0, 80),
            phone: phoneValue || null,
            status: 'ACTIVE',
          },
        })
        applied += 1
      }
    }
  }
  if (applied > 0) {
    await prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'HR_FOLDER_EMPLOYEE_SHEET',
        module: 'hr',
        details: JSON.stringify({ applied, at: new Date().toISOString() }),
      },
    })
  }
  return applied
}

async function applyPayrollSheet(rows: Record<string, unknown>[], employees: Emp[]): Promise<number> {
  let applied = 0
  for (const row of rows) {
    const name = cell(row, ['name', 'employee', 'employee name', 'الاسم'])
    const code = cell(row, ['code', 'barcode', 'emp id', 'الرقم الوظيفي'])
    const wageRaw = cell(row, ['net_wage', 'net', 'wage', 'basic', 'salary', 'basic_salary', 'صافي', 'راتب', 'الأساسي'])
    const allowRaw = cell(row, ['allowances', 'allowance', 'بدلات'])
    const dedRaw = cell(row, ['deductions', 'deduction', 'استقطاع'])
    const period = cell(row, ['period', 'month', 'date', 'date_from', 'الشهر'])
    const emp =
      (code && employees.find((e) => e.code === code)) || (name ? resolveEmployee(name, employees)?.emp : null)
    if (!emp) continue
    const net = Number(String(wageRaw).replace(/,/g, '')) || 0
    const allowances = Number(String(allowRaw).replace(/,/g, '')) || 0
    const deductions = Number(String(dedRaw).replace(/,/g, '')) || 0
    if (net <= 0 && allowances <= 0) continue
    let month = new Date().getUTCMonth() + 1
    let year = new Date().getUTCFullYear()
    const pm = period.match(/(20\d{2})[-/](\d{1,2})/) || period.match(/(\d{1,2})[-/](20\d{2})/)
    if (pm) {
      if (pm[1]!.length === 4) {
        year = Number(pm[1])
        month = Number(pm[2])
      } else {
        month = Number(pm[1])
        year = Number(pm[2])
      }
    }
    const basic = Math.max(0, net - allowances + deductions) || net
    await prisma.employee.update({
      where: { id: emp.id },
      data: { basicSalary: basic, allowances, deductions },
    })
    try {
      await prisma.payroll.upsert({
        where: { employeeId_month_year: { employeeId: emp.id, month, year } },
        create: {
          employeeId: emp.id,
          month,
          year,
          basicSalary: basic,
          totalAllowances: allowances,
          totalDeductions: deductions,
          netSalary: net || basic + allowances - deductions,
          status: 'APPROVED',
        },
        update: {
          basicSalary: basic,
          totalAllowances: allowances,
          totalDeductions: deductions,
          netSalary: net || basic + allowances - deductions,
          status: 'APPROVED',
        },
      })
      applied += 1
    } catch {
      // ignore unique races
    }
  }
  return applied
}

async function applyAttendanceSheet(rows: Record<string, unknown>[], employees: Emp[]): Promise<number> {
  let applied = 0
  for (const row of rows) {
    const name = cell(row, ['name', 'employee', 'الاسم'])
    const code = cell(row, ['code', 'barcode', 'emp id'])
    const checkIn = cell(row, ['check_in', 'checkin', 'in', 'حضور', 'time in'])
    const checkOut = cell(row, ['check_out', 'checkout', 'out', 'انصراف', 'time out'])
    const dateRaw = cell(row, ['date', 'day', 'التاريخ']) || checkIn
    const leave = cell(row, ['leave', 'status', 'إجازة', 'holiday'])
    const emp =
      (code && employees.find((e) => e.code === code)) || (name ? resolveEmployee(name, employees)?.emp : null)
    if (!emp) continue
    const when = new Date(dateRaw || checkIn)
    if (Number.isNaN(when.getTime())) continue
    const day = new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()))
    const cin = checkIn ? new Date(checkIn) : null
    const cout = checkOut ? new Date(checkOut) : null
    const hours =
      cin && cout && !Number.isNaN(cin.getTime()) && !Number.isNaN(cout.getTime())
        ? Math.max(0, (cout.getTime() - cin.getTime()) / 3_600_000)
        : 0
    const status = /leave|sick|إجازة|مرض/i.test(leave) ? 'LEAVE' : 'PRESENT'
    try {
      await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: emp.id, date: day } },
        create: {
          employeeId: emp.id,
          date: day,
          checkIn: cin && !Number.isNaN(cin.getTime()) ? cin : null,
          checkOut: cout && !Number.isNaN(cout.getTime()) ? cout : null,
          status,
          hoursWorked: Math.round(hours * 100) / 100,
        },
        update: {
          checkIn: cin && !Number.isNaN(cin.getTime()) ? cin : undefined,
          checkOut: cout && !Number.isNaN(cout.getTime()) ? cout : undefined,
          status,
          hoursWorked: Math.round(hours * 100) / 100,
        },
      })
      applied += 1
    } catch {
      // ignore
    }
  }
  return applied
}

function textFromBuffer(buf: Buffer | null, mime: string, fileName: string): string {
  if (!buf) return ''
  if (/text|json|csv|xml/i.test(mime) || /\.(txt|csv|json|md)$/i.test(fileName)) {
    return buf.toString('utf8').slice(0, 20000)
  }
  // Naive binary scrape for PDF-ish ASCII (lightweight OCR stand-in)
  const asLatin = buf.toString('latin1')
  const readable = asLatin.replace(/[^\x09\x0a\x0d\x20-\x7e\u0600-\u06ff]/g, ' ')
  return readable.replace(/\s+/g, ' ').slice(0, 8000)
}

export async function ingestHrFolderBatch(input: {
  actorId: string
  batchId?: string
  files: IngestFileInput[]
}): Promise<IngestBatchResult> {
  const batchId = input.batchId || `batch_${Date.now().toString(36)}`
  let employees = await prisma.employee.findMany({
    select: { id: true, code: true, name: true, phone: true, jobTitle: true, department: true },
  })
  const rows: IngestResultRow[] = []
  let matched = 0
  let review = 0
  let appliedRows = 0

  for (const file of input.files) {
    const fileName = file.fileName || file.relativePath.split(/[/\\]/).pop() || 'file'
    const relativePath = file.relativePath || fileName
    const mime = file.mimeType || 'application/octet-stream'
    const buf = bufferFromBase64(file.contentBase64)
    const sizeBytes = file.sizeBytes ?? buf?.byteLength ?? 0
    let text = `${file.textHint || ''} ${textFromBuffer(buf, mime, fileName)}`
    const updates: string[] = []
    let category = classifyPath(relativePath, fileName, text)
    let sheetApplied = 0

    const isSheet = /\.(xlsx|xls|csv|json)$/i.test(fileName)
    if (isSheet && buf) {
      try {
        let objects: Record<string, unknown>[] = []
        if (/\.json$/i.test(fileName)) {
          const parsed = JSON.parse(buf.toString('utf8')) as unknown
          objects = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [parsed as Record<string, unknown>]
        } else if (/\.csv$/i.test(fileName)) {
          objects = csvToObjects(buf.toString('utf8'))
        } else {
          objects = sheetToObjects(buf)
        }
        const kind = detectSheetKind(objects)
        if (kind === 'employee') {
          category = 'employee_sheet'
          sheetApplied = await applyEmployeeSheet(objects, employees, input.actorId)
          employees = await prisma.employee.findMany({
            select: { id: true, code: true, name: true, phone: true, jobTitle: true, department: true },
          })
          updates.push(`updated_employees:${sheetApplied}`)
        } else if (kind === 'payroll') {
          category = 'payroll_sheet'
          sheetApplied = await applyPayrollSheet(objects, employees)
          updates.push(`payroll_rows:${sheetApplied}`)
        } else if (kind === 'attendance') {
          category = 'attendance_sheet'
          sheetApplied = await applyAttendanceSheet(objects, employees)
          updates.push(`attendance_rows:${sheetApplied}`)
        }
        appliedRows += sheetApplied
        text = `${text} ${objects
          .slice(0, 5)
          .map((r) => Object.values(r).join(' '))
          .join(' ')}`
      } catch (error) {
        logger.warn('hr_sheet_parse_failed', {
          fileName,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        updates.push('sheet_parse_failed')
      }
    }

    const resolved = resolveEmployee(`${relativePath} ${fileName} ${text}`, employees)
    const civilId = extractCivilId(text)
    const expiry = extractExpiry(text)
    if (civilId) updates.push(`civil_id:${civilId}`)
    if (expiry) updates.push(`expiry:${expiry.toISOString().slice(0, 10)}`)

    let status: IngestResultRow['status'] = 'REVIEW'
    let employeeId: string | null = null
    let score = resolved?.score ?? 0
    if (isSheet && sheetApplied > 0) {
      status = 'APPLIED'
      score = Math.max(score, 0.9)
      matched += 1
    } else if (resolved && resolved.score >= 0.72) {
      status = 'MATCHED'
      employeeId = resolved.emp.id
      matched += 1
      if (category === 'avatar' && buf && sizeBytes <= 400_000) {
        updates.push('avatar_bound')
      }
      if (civilId || expiry) {
        await prisma.activityLog.create({
          data: {
            userId: input.actorId,
            action: 'HR_DOC_META',
            module: 'hr',
            details: JSON.stringify({
              employeeId,
              category,
              civilId,
              expiry: expiry?.toISOString() ?? null,
              fileName,
            }),
          },
        })
      }
    } else {
      review += 1
      if (resolved && resolved.score >= 0.45) {
        employeeId = resolved.emp.id
        score = resolved.score
      }
    }

    // Zero-Blob: persist binary outside SQL; DB keeps fileUrl + indexed text only.
    let fileUrl: string | null = null
    let fileType: string | null = mime
    if (buf && sizeBytes > 0) {
      try {
        const stored = await storeHrBinary({
          buffer: buf,
          fileName,
          mimeType: mime,
          employeeCode: employeeId ? employees.find((e) => e.id === employeeId)?.code : null,
        })
        fileUrl = stored.fileUrl
        fileType = stored.fileType
        updates.push(`stored:${stored.storageKey}`)
      } catch (error) {
        logger.warn('hr_file_store_failed', {
          fileName,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (employeeId && expiry) {
      const patch: Record<string, Date> = {}
      if (category === 'civil_id') patch.civilIdExpiry = expiry
      if (category === 'passport_work') {
        patch.passportExpiry = expiry
        patch.workPermitExpiry = expiry
      }
      if (category === 'health_card') patch.healthCardExpiry = expiry
      if (category === 'driving') patch.drivingLicenseExpiry = expiry
      if (Object.keys(patch).length) {
        await prisma.employee.update({ where: { id: employeeId }, data: patch })
        updates.push('employee_expiry_synced')
      }
    }
    if (employeeId && civilId) {
      await prisma.employee.update({ where: { id: employeeId }, data: { civilId } })
    }

    const created = await prisma.hrDocument.create({
      data: {
        employeeId,
        batchId,
        fileName,
        relativePath,
        category,
        mimeType: mime,
        sizeBytes,
        fileUrl,
        fileType,
        contentBase64: null,
        extractedText: text.slice(0, 4000) || null,
        civilId,
        expiryDate: expiry,
        matchScore: score,
        status,
        updatesJson: JSON.stringify(updates),
        metaJson: JSON.stringify({ actorId: input.actorId }),
      },
    })

    const emp = employeeId ? employees.find((e) => e.id === employeeId) : null
    const labels = CATEGORY_LABELS[category]
    rows.push({
      id: created.id,
      fileName,
      relativePath,
      category,
      categoryLabelAr: labels.ar,
      categoryLabelEn: labels.en,
      employeeId,
      employeeName: emp?.name ?? null,
      employeeCode: emp?.code ?? null,
      matchScore: score,
      status,
      updates,
      expiryDate: expiry ? expiry.toISOString().slice(0, 10) : null,
      civilId,
    })
  }

  return {
    batchId,
    processed: rows.length,
    matched,
    review,
    appliedRows,
    rows,
  }
}

export async function assignHrDocument(input: {
  documentId: string
  employeeId: string
  actorId: string
}): Promise<IngestResultRow> {
  const doc = await prisma.hrDocument.findUnique({ where: { id: input.documentId } })
  if (!doc) throw new Error('document_not_found')
  const emp = await prisma.employee.findUnique({ where: { id: input.employeeId } })
  if (!emp) throw new Error('employee_not_found')
  const updated = await prisma.hrDocument.update({
    where: { id: doc.id },
    data: { employeeId: emp.id, status: 'MATCHED', matchScore: 1 },
  })
  await prisma.activityLog.create({
    data: {
      userId: input.actorId,
      action: 'HR_DOC_ASSIGN',
      module: 'hr',
      details: JSON.stringify({ documentId: doc.id, employeeId: emp.id }),
    },
  })
  const labels = CATEGORY_LABELS[(updated.category as HrDocCategory) || 'other'] || CATEGORY_LABELS.other
  return {
    id: updated.id,
    fileName: updated.fileName,
    relativePath: updated.relativePath,
    category: updated.category as HrDocCategory,
    categoryLabelAr: labels.ar,
    categoryLabelEn: labels.en,
    employeeId: emp.id,
    employeeName: emp.name,
    employeeCode: emp.code,
    matchScore: 1,
    status: 'MATCHED',
    updates: JSON.parse(updated.updatesJson || '[]') as string[],
    expiryDate: updated.expiryDate ? updated.expiryDate.toISOString().slice(0, 10) : null,
    civilId: updated.civilId,
  }
}

export async function listEmployeeDossier(employeeId: string) {
  const docs = await prisma.hrDocument.findMany({
    where: { employeeId },
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
  })
  const now = Date.now()
  return docs.map((doc) => {
    const labels = CATEGORY_LABELS[(doc.category as HrDocCategory) || 'other'] || CATEGORY_LABELS.other
    const expiry = doc.expiryDate
    const daysLeft = expiry ? Math.ceil((expiry.getTime() - now) / 86_400_000) : null
    return {
      id: doc.id,
      fileName: doc.fileName,
      relativePath: doc.relativePath,
      category: doc.category,
      categoryLabelAr: labels.ar,
      categoryLabelEn: labels.en,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      civilId: doc.civilId,
      expiryDate: expiry ? expiry.toISOString().slice(0, 10) : null,
      daysLeft,
      expiryStatus: daysLeft == null ? 'none' : daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'soon' : 'ok',
      hasContent: Boolean(doc.fileUrl),
      fileUrl: doc.fileUrl,
      createdAt: doc.createdAt.toISOString(),
      updates: JSON.parse(doc.updatesJson || '[]') as string[],
    }
  })
}

export async function listReviewQueue(limit = 100) {
  return prisma.hrDocument.findMany({
    where: { status: 'REVIEW' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { employee: { select: { id: true, name: true, code: true } } },
  })
}
