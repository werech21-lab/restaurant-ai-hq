'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { apiRequest, newIdempotencyKey } from '@/components/erp/api'

/** Records the signed-in person's path inside the ERP. Failures stay on the server log, not the screen. */
export default function GovernancePulse() {
  const pathname = usePathname() ?? ''

  useEffect(() => {
    if (!pathname.startsWith('/erp')) return undefined
    const started = Date.now()
    const timer = window.setTimeout(() => {
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
