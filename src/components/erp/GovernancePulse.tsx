'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { apiRequest, newIdempotencyKey } from '@/components/erp/api'

function isReadOnlyAuditorDom(): boolean {
  if (typeof document === 'undefined') return false
  const ds = document.documentElement.dataset
  return ds.auditor === 'true' || ds.sessionRole === 'auditor'
}

/** Records the signed-in executive's path inside the ERP. Read-only auditor sessions skip write telemetry. */
export default function GovernancePulse() {
  const pathname = usePathname() ?? ''

  useEffect(() => {
    if (!pathname.startsWith('/erp') || isReadOnlyAuditorDom()) return undefined
    const started = Date.now()
    const timer = window.setTimeout(() => {
      if (isReadOnlyAuditorDom()) return
      const dwellTimeSeconds = Math.min(86_400, Math.max(1, Math.floor((Date.now() - started) / 1000)))
      void apiRequest('/api/v1/governance/telemetry', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { activePath: pathname.slice(0, 200), actionSequence: ['open'], dwellTimeSeconds },
      }).catch(() => undefined)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return null
}
