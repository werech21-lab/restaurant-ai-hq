'use client'

import React from 'react'
import { useLang } from '@/components/aether/ui'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function ThreeWayReconciliationTab() {
  const { isAr } = useLang()
  return <UnlinkedSourceNotice isAr={isAr} compact />
}

export function ChargebacksTab() {
  const { isAr } = useLang()
  return <UnlinkedSourceNotice isAr={isAr} compact />
}

export function OrderWaterfallTab() {
  const { isAr } = useLang()
  return <UnlinkedSourceNotice isAr={isAr} compact />
}
