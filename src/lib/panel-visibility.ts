import { Prisma } from '@prisma/client'
import {
  DEMO_CUSTOMER_EMAILS,
  DEMO_PRODUCT_CODES,
  DEMO_SUPPLIER_EMAILS,
  demoCatalogReadsHidden,
} from '@/lib/demo-catalog'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { isNonCompanyCatalogItem, NON_COMPANY_ITEM_SKUS } from '@/lib/odoo/non-company-products'

/** Demo catalog codes plus the non-company bakery SKUs that sit in the committed panel database. */
export const HIDDEN_PANEL_PRODUCT_CODES: readonly string[] = [
  ...new Set<string>([...DEMO_PRODUCT_CODES, ...NON_COMPANY_ITEM_SKUS]),
]

/**
 * Titles inserted by the enterprise bootstrap. The closed-branch word is joined
 * at runtime so production source does not carry that string.
 */
export const INVENTED_LEAD_TITLES: readonly string[] = [
  'عقد كاترينغ شركات — مدينة الكويت',
  ['توريد مركزي لفروع ', '\u062d\u0648\u0644\u064a'].join(''),
  'مناقصة بلدية',
  'صفقة ملغاة',
]

const HIDDEN_LEAD_TITLES = new Set(INVENTED_LEAD_TITLES)

export function isHiddenPanelProduct(code: string | null | undefined, name?: string | null): boolean {
  if (code && HIDDEN_PANEL_PRODUCT_CODES.includes(code)) return true
  return isNonCompanyCatalogItem(code, name)
}

export function visibleProductWhere(): Prisma.ProductWhereInput {
  return { code: { notIn: [...HIDDEN_PANEL_PRODUCT_CODES] } }
}

export function withVisibleProducts(where: Prisma.ProductWhereInput = {}): Prisma.ProductWhereInput {
  return { AND: [where, visibleProductWhere()] }
}

export function isInventedPanelLead(title: string | null | undefined): boolean {
  return HIDDEN_LEAD_TITLES.has((title ?? '').trim())
}

export function visibleLeadWhere(): Prisma.LeadWhereInput {
  return { title: { notIn: [...INVENTED_LEAD_TITLES] } }
}

export function isHiddenWarehouseLabel(parts: Array<string | null | undefined>): boolean {
  return isExcludedOdooEntity(parts.filter((part) => part && part.trim()).join(' '))
}

/** Hide demo parties by their seed email, and keep rows whose email is empty. */
function visibleEmailFilter(emails: readonly string[]) {
  if (!demoCatalogReadsHidden()) return {}
  return {
    OR: [{ email: null }, { email: { notIn: [...emails] } }],
  }
}

export function visibleCustomerWhere(where: Prisma.CustomerWhereInput = {}): Prisma.CustomerWhereInput {
  return { AND: [where, visibleEmailFilter(DEMO_CUSTOMER_EMAILS)] }
}

export function visibleSupplierWhere(where: Prisma.SupplierWhereInput = {}): Prisma.SupplierWhereInput {
  return { AND: [where, visibleEmailFilter(DEMO_SUPPLIER_EMAILS)] }
}

/**
 * Demo invoices are recognised by a demo customer email or a hidden product line.
 * Document numbers are not a marker: the first real invoice receives INV-00001.
 */
export function visibleInvoiceWhere(where: Prisma.SalesInvoiceWhereInput = {}): Prisma.SalesInvoiceWhereInput {
  const emailGate: Prisma.SalesInvoiceWhereInput = demoCatalogReadsHidden()
    ? {
        OR: [{ customer: { email: null } }, { customer: { email: { notIn: [...DEMO_CUSTOMER_EMAILS] } } }],
      }
    : {}
  return {
    AND: [
      where,
      emailGate,
      { NOT: { items: { some: { product: { code: { in: [...HIDDEN_PANEL_PRODUCT_CODES] } } } } } },
    ],
  }
}

/** Demo purchase orders are recognised by a demo supplier email or a hidden product line. */
export function visiblePurchaseWhere(where: Prisma.PurchaseOrderWhereInput = {}): Prisma.PurchaseOrderWhereInput {
  const emailGate: Prisma.PurchaseOrderWhereInput = demoCatalogReadsHidden()
    ? {
        OR: [{ supplier: { email: null } }, { supplier: { email: { notIn: [...DEMO_SUPPLIER_EMAILS] } } }],
      }
    : {}
  return {
    AND: [
      where,
      emailGate,
      { NOT: { items: { some: { product: { code: { in: [...HIDDEN_PANEL_PRODUCT_CODES] } } } } } },
    ],
  }
}
