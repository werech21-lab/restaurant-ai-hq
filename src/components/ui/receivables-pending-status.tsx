import React from 'react'
import { Clock } from 'lucide-react'
import {
  RECEIVABLES_PENDING_DETAIL,
  RECEIVABLES_PENDING_STATUS,
} from '@/lib/aether/receivables-status'

/**
 * Calm neutral (gray) status shown in place of receivable amounts until per-customer
 * due-date aging is verified. Never red/amber — this is a process state, not an alarm.
 */
export function ReceivablesPendingStatus({
  isAr,
  showDetail = false,
  size = 'md',
  className = '',
}: {
  isAr: boolean
  showDetail?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div data-receivables-status="pending-reconciliation" className={className}>
      <span
        role="status"
        className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 font-semibold text-slate-700 ring-1 ring-slate-300/70 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15 ${
          size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
        }`}
      >
        <Clock className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
        <span>{isAr ? RECEIVABLES_PENDING_STATUS.ar : RECEIVABLES_PENDING_STATUS.en}</span>
      </span>
      {showDetail ? (
        <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
          {isAr ? RECEIVABLES_PENDING_DETAIL.ar : RECEIVABLES_PENDING_DETAIL.en}
        </p>
      ) : null}
    </div>
  )
}
