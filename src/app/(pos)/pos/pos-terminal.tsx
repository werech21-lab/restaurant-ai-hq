'use client'

import React from 'react'
import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { SectionCard, StateBlock } from '@/components/ui'
import { formatKwd } from '@/lib/format'
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
  const resolvedLocale = isAr ? 'ar' : 'en'
  const zeroSampleKwd = formatKwd(0, { locale: resolvedLocale })

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <SectionCard
        locale={resolvedLocale}
        icon={<Receipt className="h-5 w-5" aria-hidden />}
        title={isAr ? 'شاشة الكاشير (POS Terminal)' : 'POS Cashier Terminal'}
        subtitle={
          isAr
            ? `واجهة كاشير عالية التباين (دقة العملة: ${zeroSampleKwd})`
            : `High-contrast cashier view (${zeroSampleKwd} 3-decimal KWD precision)`
        }
        actions={
          <Link
            href="/sales"
            className="ds-surface ds-motion ds-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[var(--ds-bg-hover)]"
          >
            {isAr ? 'الانتقال إلى المبيعات' : 'Go to Sales'}
          </Link>
        }
      >
        <StateBlock
          state="unlinked"
          locale={resolvedLocale}
          title={
            isAr
              ? 'شاشة الكاشير المستقلة غير مربوطة بمصدر'
              : 'Standalone Cashier Session Not Connected'
          }
          description={
            isAr
              ? 'غير مربوط بمصدر جلسات كاشير خارج Odoo POS.'
              : 'Not connected to a standalone cashier session source outside Odoo POS.'
          }
        />
      </SectionCard>
    </div>
  )
}
