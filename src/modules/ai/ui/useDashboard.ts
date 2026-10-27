'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { Phase } from '@/components/erp/common'
import type { MessageKey } from '@/lib/i18n'
import type { Dashboard } from '@/modules/ai/client'

export type DashboardState = {
  dashboard: Dashboard | null
  phase: Phase
  error: MessageKey
  retry: () => void
}

/** Reads the live dashboard numbers. A new `reloadToken` reads them again and keeps the old numbers on screen meanwhile. */
export function useDashboard(reloadToken: number): DashboardState {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ data: Dashboard }>('/api/v1/ai/dashboard', { signal: controller.signal })
      .then((payload) => {
        setDashboard(payload.data)
        setPhase('ready')
      })
      .catch((failure: unknown) => {
        if (isAbort(failure)) return
        setError(errorKey(failure))
        setPhase('error')
      })
    return () => controller.abort()
  }, [reloadToken, retryToken])

  return {
    dashboard,
    phase,
    error,
    retry: () => {
      setPhase('loading')
      setRetryToken((value) => value + 1)
    },
  }
}
