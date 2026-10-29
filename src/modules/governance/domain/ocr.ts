import { parseKwdToMinor } from '@/lib/money'

export const archiveCategories = ['fuel_invoice', 'contract', 'knet_receipt', 'traffic_fine', 'delivery_waybill'] as const
export type ArchiveCategory = (typeof archiveCategories)[number]

export const archiveRoutes = ['/erp/hr', '/erp/contracts', '/erp/delivery', '/erp/finance'] as const
export type ArchiveRoute = (typeof archiveRoutes)[number]

const routeByCategory: Record<ArchiveCategory, ArchiveRoute> = {
  fuel_invoice: '/erp/hr',
  traffic_fine: '/erp/hr',
  contract: '/erp/contracts',
  knet_receipt: '/erp/finance',
  delivery_waybill: '/erp/delivery',
}

export function routeForCategory(category: ArchiveCategory): ArchiveRoute {
  return routeByCategory[category]
}

export function fileTypeOf(fileName: string): 'pdf' | 'image' | 'text' {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (/\.(png|jpe?g|webp|gif)$/.test(lower)) return 'image'
  return 'text'
}

export function readAmountMinor(text: string): number {
  const match = /(\d{1,9})[.,](\d{3})(?!\d)/.exec(text)
  if (!match) return 0
  return parseKwdToMinor(`${match[1]}.${match[2]}`) ?? 0
}

export function readCounterparty(text: string): string {
  const match = /الطرف(?:\s+الثاني)?\s*[:：]\s*([^\n]{2,80})/.exec(text)
  return match?.[1]?.trim() || 'طرف مستخرج من الأرشيف'
}

export type ArchiveExtraction = {
  amountMinor: number
  counterparty: string
  fileType: 'pdf' | 'image' | 'text'
  route: ArchiveRoute
}

export function extractArchive(fileName: string, text: string, category: ArchiveCategory): ArchiveExtraction {
  return {
    amountMinor: readAmountMinor(text),
    counterparty: readCounterparty(text),
    fileType: fileTypeOf(fileName),
    route: routeForCategory(category),
  }
}
