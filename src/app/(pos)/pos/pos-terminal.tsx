'use client'

import React from 'react'
import UnlinkedSourceNotice from '@/components/erp/UnlinkedSourceNotice'
import { useI18n } from '@/lib/i18n'
import type { OrderTypeId, VentureBranchOption } from '@/lib/venture-branches'

export type PosProduct = {
  id: string
  code: string
  name: string
  category: string
  price: number
  stock: number
  imageUrl?: string | null
}

export type EmployeeBrief = {
  id: string
  code: string
  name: string
  jobTitle?: string
  department?: string
}

export interface PosTerminalProps {
  products: PosProduct[]
  walkInId: string
  customers: Array<{ id: string; name: string }>
  employees?: EmployeeBrief[]
  brands: Array<{ code: string; nameAr: string; nameEn?: string }>
  branches: VentureBranchOption[]
  orderTypes: Array<{ id: OrderTypeId | string; labelAr: string; labelEn?: string }>
  initialBrandCode?: string
  initialBranchId?: string
  warehouseId?: string
}

export function PosTerminal(_props: PosTerminalProps) {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl p-4 sm:p-6">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="شاشة الكاشير (POS Terminal)"
        titleEn="POS Cashier Terminal"
        reasonAr="غير مربوط بمصدر جلسات كاشير مباشرة خارج Odoo POS."
        reasonEn="Not connected to a standalone live cashier session source outside Odoo POS."
      />
    </div>
  )
}
