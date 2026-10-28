'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ApiError, errorDetail, errorKey, newIdempotencyKey } from '@/components/erp/api'
import type { MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'

/** Today in UTC, the day the server uses for dates it checks. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Integer fils as a KWD string, or a dash when the number is outside the safe range. */
export function minorText(amountMinor: number): string {
  try {
    return formatMinor(amountMinor)
  } catch {
    return '—'
  }
}

export type Failure = { key: MessageKey; detail: string | null; conflict: boolean }

/** A key that stays the same while a lost response may still be replayed, and changes once the server gave a final answer. */
export function useIdempotencyKey() {
  const ref = useRef(newIdempotencyKey())
  const reset = useCallback(() => {
    ref.current = newIdempotencyKey()
  }, [])
  return { ref, reset }
}

/**
 * Runs one user action at a time and keeps its pending and failure state. Pass the key of a create so that it is renewed
 * after a final answer and kept after an unknown outcome (network or server failure), which makes the retry replay.
 */
export function useRunner() {
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)

  const run = useCallback(async (task: () => Promise<void>, key?: { reset: () => void }) => {
    setFailure(null)
    setPending(true)
    try {
      await task()
    } catch (error) {
      if (key && !(error instanceof ApiError && (error.status === 0 || error.status >= 500))) key.reset()
      setFailure({
        key: errorKey(error),
        detail: errorDetail(error),
        conflict: error instanceof ApiError && error.code === 'version_conflict',
      })
    } finally {
      setPending(false)
    }
  }, [])

  const clear = useCallback(() => setFailure(null), [])
  return { pending, failure, run, clear }
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm text-gray-400 ${className}`}>
      {label}
      {children}
    </label>
  )
}

/** The readable rows of a document header: label above value. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <div className="mt-1 text-sm text-gray-100">{children}</div>
    </div>
  )
}
