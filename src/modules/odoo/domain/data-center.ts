import type { MappedProduct } from '@/lib/odoo-mapper'
import type { OdooModel } from '@/modules/odoo/domain/odoo'

export type OdooDataCenterReport = {
  tenantId: string
  counts: Record<string, number>
  indexes: { name: string; present: boolean }[]
  querySpeedMs: number
  fieldCoverage: {
    model: OdooModel
    samples: number
    averagePercent: number
    missingFields: string[]
  }[]
  brands: number
  branches: number
  sampleProduct: MappedProduct | null
}
