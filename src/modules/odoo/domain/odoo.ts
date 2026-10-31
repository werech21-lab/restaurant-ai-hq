import { permissions, type Permission } from '@/lib/auth/permissions'

/** The only Odoo host this importer may call. */
export const ODOO_ORIGIN = 'https://venturefoods.walnutss.com'

export const ODOO_COMPANY_ID = 1

export const odooModels = [
  'hr.employee',
  'hr.contract',
  'hr.payslip',
  'hr.attendance',
  'hr.leave',
  'hr.appraisal',
  'hr.expense',
  'account.account',
  'account.move',
  'product.template',
  'stock.quant',
  'purchase.order',
  'purchase.requisition',
  'res.partner',
] as const

export type OdooModel = (typeof odooModels)[number]

export const odooFields: Record<OdooModel, readonly string[]> = {
  'hr.employee': ['id', 'name', 'job_title', 'work_email', 'active', 'barcode', 'department_id'],
  'hr.contract': ['id', 'name', 'employee_id', 'date_start', 'date_end', 'wage', 'state'],
  'hr.payslip': ['id', 'name', 'employee_id', 'date_from', 'date_to', 'state', 'net_wage'],
  'hr.attendance': ['id', 'employee_id', 'check_in', 'check_out'],
  'hr.leave': ['id', 'employee_id', 'holiday_status_id', 'date_from', 'date_to', 'state'],
  'hr.appraisal': ['id', 'employee_id', 'date_close', 'state'],
  'hr.expense': ['id', 'name', 'employee_id', 'total_amount', 'date', 'state'],
  'account.account': ['id', 'code', 'name', 'account_type'],
  'account.move': ['id', 'name', 'move_type', 'partner_id', 'invoice_date', 'amount_total', 'state', 'currency_id'],
  'product.template': ['id', 'name', 'default_code', 'list_price', 'standard_price', 'active'],
  'stock.quant': ['id', 'product_id', 'location_id', 'quantity'],
  'purchase.order': ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state'],
  'purchase.requisition': ['id', 'name', 'state', 'ordering_date'],
  'res.partner': ['id', 'name', 'email', 'phone', 'vat', 'street'],
}

export type Plain = string | number | boolean | null
export type OdooPayload = Record<string, Plain>

const APPLY_PERMISSION: Partial<Record<'customers' | 'hr_employees' | 'items', Permission>> = {
  customers: permissions.crmCustomerCreate,
  hr_employees: permissions.hrEmployeeManage,
  items: permissions.inventoryItemCreate,
}

export function isOdooModel(value: string): value is OdooModel {
  return (odooModels as readonly string[]).includes(value)
}

/** Whole fils from a decimal KWD amount. A negative or unreadable amount is refused. */
export function kwdToFils(value: unknown): number | null {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  const [majorText, fraction = ''] = text.split('.')
  const major = Number(majorText)
  const minor = Number((fraction + '000').slice(0, 3))
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor)) return null
  const fils = major * 1000 + minor
  return fils <= 1_000_000_000 ? fils : null
}

export function plainValue(value: unknown): Plain {
  if (value === null || value === undefined || value === false) return null
  if (typeof value === 'string') return value.slice(0, 500)
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value) && typeof value[1] === 'string') return value[1].slice(0, 500)
  return null
}

export function payloadFromOdoo(model: OdooModel, row: Record<string, unknown>): OdooPayload {
  const payload: OdooPayload = {}
  for (const field of odooFields[model]) payload[field] = plainValue(row[field])
  return payload
}

export function textOf(payload: OdooPayload, key: string): string {
  const value = payload[key]
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
}

export function externalId(payload: OdooPayload, fallback: string): string {
  const raw = textOf(payload, 'id') || textOf(payload, 'external_id') || fallback
  return raw.replace(/[^\w.-]/g, '').slice(0, 80) || fallback.slice(0, 80)
}

export function displayName(model: OdooModel, payload: OdooPayload, external: string): string {
  const name = textOf(payload, 'name') || textOf(payload, 'code') || textOf(payload, 'default_code') || `${model} ${external}`
  return name.slice(0, 200)
}

export type ApplyTarget = 'customers' | 'hr_employees' | 'items'

export type ApplyPlan =
  | { status: 'applied'; target: ApplyTarget; reason: null }
  | { status: 'staged'; target: null; reason: 'ledger' | 'stock' | 'payroll' | 'permission' | 'incomplete' }
  | { status: 'skipped'; target: null; reason: 'incomplete' }

/** Contacts, employees and products can enter their modules. Ledgers, stock and payroll stay staged. */
export function planApply(model: OdooModel, payload: OdooPayload, granted: ReadonlySet<string>): ApplyPlan {
  if (model === 'account.account' || model === 'account.move' || model === 'purchase.order' || model === 'purchase.requisition') {
    return { status: 'staged', target: null, reason: 'ledger' }
  }
  if (model === 'stock.quant') return { status: 'staged', target: null, reason: 'stock' }
  if (model === 'hr.contract' || model === 'hr.payslip' || model === 'hr.attendance' || model === 'hr.leave' || model === 'hr.appraisal' || model === 'hr.expense') {
    return { status: 'staged', target: null, reason: 'payroll' }
  }
  const target: ApplyTarget = model === 'res.partner' ? 'customers' : model === 'hr.employee' ? 'hr_employees' : 'items'
  const permission = APPLY_PERMISSION[target]
  if (!permission || !granted.has(permission)) return { status: 'staged', target: null, reason: 'permission' }
  if (model === 'res.partner' && textOf(payload, 'name') === '') return { status: 'skipped', target: null, reason: 'incomplete' }
  if (model === 'hr.employee' && textOf(payload, 'name') === '') return { status: 'skipped', target: null, reason: 'incomplete' }
  if (model === 'product.template') {
    if (textOf(payload, 'name') === '') return { status: 'skipped', target: null, reason: 'incomplete' }
    if (kwdToFils(payload.list_price ?? 0) === null || kwdToFils(payload.standard_price ?? 0) === null) return { status: 'skipped', target: null, reason: 'incomplete' }
  }
  return { status: 'applied', target, reason: null }
}

const headerKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '_')

export function detectModel(headers: readonly string[]): OdooModel | null {
  const keys = new Set(headers.map(headerKey))
  const has = (...names: string[]) => names.some((name) => keys.has(name))
  if (has('net_wage', 'payslip')) return 'hr.payslip'
  if (has('wage', 'date_start')) return 'hr.contract'
  if (has('total_amount')) return 'hr.expense'
  if (has('date_close')) return 'hr.appraisal'
  if (has('ordering_date', 'requisition')) return 'purchase.requisition'
  if (has('check_in')) return 'hr.attendance'
  if (has('holiday_status', 'holiday_status_id')) return 'hr.leave'
  if (has('work_email', 'job_title', 'barcode')) return 'hr.employee'
  if (has('move_type', 'invoice_date')) return 'account.move'
  if (has('date_order')) return 'purchase.order'
  if (has('default_code', 'list_price', 'standard_price')) return 'product.template'
  if (has('quantity') && has('location', 'location_id')) return 'stock.quant'
  if (has('account_type') || (has('code') && has('name') && !has('email'))) return 'account.account'
  if (has('email', 'phone', 'partner', 'vat')) return 'res.partner'
  if (has('name')) return 'res.partner'
  return null
}

export function recordsFromRows(headers: string[], rows: string[][]): OdooPayload[] {
  return rows.map((row) => {
    const payload: OdooPayload = {}
    headers.forEach((header, index) => {
      payload[headerKey(header)] = plainValue(row[index] ?? '')
    })
    return payload
  })
}
