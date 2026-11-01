import { odooFields, textOf, type OdooModel, type OdooPayload, type Plain } from '@/modules/odoo/domain/odoo'

export type MappedField = {
  key: string
  labelAr: string
  labelEn: string
  value: Plain
  mapped: boolean
}

export type MappedProduct = {
  nameAr: string
  nameEn: string
  defaultCode: string
  barcode: string
  standardPrice: number | null
  listPrice: number | null
  qtyAvailable: number | null
  brand: string
  branch: string
  isActive: boolean
  mapped: MappedField[]
  extended: MappedField[]
}

export type MappedPartner = {
  name: string
  email: string
  phone: string
  vat: string
  street: string
  mapped: MappedField[]
  extended: MappedField[]
}

export type MappedInvoice = {
  number: string
  partner: string
  invoiceDate: string
  amountTotal: number | null
  state: string
  moveType: string
  mapped: MappedField[]
  extended: MappedField[]
}

const PRODUCT_CORE = new Set([
  'name',
  'default_code',
  'barcode',
  'list_price',
  'standard_price',
  'qty_available',
  'active',
  'id',
])

const PARTNER_CORE = new Set(['name', 'email', 'phone', 'vat', 'street', 'id'])
const MOVE_CORE = new Set(['name', 'partner_id', 'invoice_date', 'amount_total', 'state', 'move_type', 'id', 'currency_id'])

const LABELS: Record<string, { ar: string; en: string }> = {
  name: { ar: 'الاسم', en: 'Name' },
  default_code: { ar: 'كود Odoo الداخلي', en: 'Odoo default_code' },
  barcode: { ar: 'الباركود', en: 'Barcode' },
  list_price: { ar: 'سعر البيع', en: 'List price' },
  standard_price: { ar: 'سعر التكلفة', en: 'Standard / cost price' },
  qty_available: { ar: 'الكمية المتاحة', en: 'Qty available' },
  active: { ar: 'نشط', en: 'Active' },
  email: { ar: 'البريد', en: 'Email' },
  phone: { ar: 'الهاتف', en: 'Phone' },
  vat: { ar: 'الرقم الضريبي', en: 'VAT' },
  street: { ar: 'العنوان', en: 'Street' },
  partner_id: { ar: 'الشريك', en: 'Partner' },
  invoice_date: { ar: 'تاريخ الفاتورة', en: 'Invoice date' },
  amount_total: { ar: 'الإجمالي', en: 'Amount total' },
  state: { ar: 'الحالة', en: 'State' },
  move_type: { ar: 'نوع القيد', en: 'Move type' },
  brand: { ar: 'البراند', en: 'Brand' },
  branch: { ar: 'الفرع', en: 'Branch' },
}

function labelOf(key: string): { ar: string; en: string } {
  return LABELS[key] ?? { ar: key, en: key }
}

function asNumber(value: Plain): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return null
}

function field(key: string, value: Plain, mapped: boolean): MappedField {
  const label = labelOf(key)
  return { key, labelAr: label.ar, labelEn: label.en, value, mapped }
}

function splitFields(payload: OdooPayload, core: ReadonlySet<string>): { mapped: MappedField[]; extended: MappedField[] } {
  const mapped: MappedField[] = []
  const extended: MappedField[] = []
  for (const [key, value] of Object.entries(payload)) {
    const row = field(key, value, core.has(key))
    if (core.has(key)) mapped.push(row)
    else extended.push(row)
  }
  // Preserve known Odoo model fields even when missing from this payload row.
  return { mapped, extended }
}

/** Maps a product.template (or staging payload) into ERP item columns + extended Odoo metadata. */
export function mapOdooProduct(payload: OdooPayload, extras?: { brand?: string; branch?: string }): MappedProduct {
  const name = textOf(payload, 'name')
  const { mapped, extended } = splitFields(payload, PRODUCT_CORE)
  if (extras?.brand) extended.push(field('brand', extras.brand, false))
  if (extras?.branch) extended.push(field('branch', extras.branch, false))
  return {
    nameAr: name,
    nameEn: name,
    defaultCode: textOf(payload, 'default_code'),
    barcode: textOf(payload, 'barcode'),
    standardPrice: asNumber(payload.standard_price ?? null),
    listPrice: asNumber(payload.list_price ?? null),
    qtyAvailable: asNumber(payload.qty_available ?? null),
    brand: extras?.brand ?? textOf(payload, 'brand'),
    branch: extras?.branch ?? textOf(payload, 'branch'),
    isActive: payload.active !== false,
    mapped,
    extended,
  }
}

export function mapOdooPartner(payload: OdooPayload): MappedPartner {
  const { mapped, extended } = splitFields(payload, PARTNER_CORE)
  return {
    name: textOf(payload, 'name'),
    email: textOf(payload, 'email'),
    phone: textOf(payload, 'phone'),
    vat: textOf(payload, 'vat'),
    street: textOf(payload, 'street'),
    mapped,
    extended,
  }
}

export function mapOdooInvoice(payload: OdooPayload): MappedInvoice {
  const { mapped, extended } = splitFields(payload, MOVE_CORE)
  return {
    number: textOf(payload, 'name'),
    partner: textOf(payload, 'partner_id'),
    invoiceDate: textOf(payload, 'invoice_date'),
    amountTotal: asNumber(payload.amount_total ?? null),
    state: textOf(payload, 'state'),
    moveType: textOf(payload, 'move_type'),
    mapped,
    extended,
  }
}

/** Every known Odoo field for a model — used by the data-center integrity check. */
export function expectedFieldsFor(model: OdooModel): readonly string[] {
  return odooFields[model]
}

export function coverageReport(model: OdooModel, payload: OdooPayload): {
  model: OdooModel
  expected: number
  present: number
  missing: string[]
  extra: string[]
  percent: number
} {
  const expected = [...odooFields[model]]
  const presentKeys = new Set(Object.keys(payload))
  const missing = expected.filter((key) => !presentKeys.has(key))
  const extra = [...presentKeys].filter((key) => !expected.includes(key))
  const present = expected.length - missing.length
  const percent = expected.length === 0 ? 100 : Math.round((present / expected.length) * 100)
  return { model, expected: expected.length, present, missing, extra, percent }
}

export function mapByModel(model: OdooModel, payload: OdooPayload) {
  if (model === 'product.template') return { kind: 'product' as const, data: mapOdooProduct(payload) }
  if (model === 'res.partner') return { kind: 'partner' as const, data: mapOdooPartner(payload) }
  if (model === 'account.move') return { kind: 'invoice' as const, data: mapOdooInvoice(payload) }
  const { mapped, extended } = splitFields(payload, new Set(['id', 'name']))
  return { kind: 'generic' as const, data: { mapped, extended, title: textOf(payload, 'name') || model } }
}
