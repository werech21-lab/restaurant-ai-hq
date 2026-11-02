'use client'

import { useEffect } from 'react'

const CACHE_KEYS = [
  'vf_lang',
  'NEXT_LOCALE',
  'locale',
  'aether-locale',
  'vf_brand_id',
  'vf_branch_id',
]

function clearCorruptClientCache() {
  try {
    for (const key of CACHE_KEYS) {
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    }
  } catch {
    // ignore storage access failures
  }
}

export default function GlobalErrorShield({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AetherBI] client error boundary', error?.message, error?.digest)
  }, [error])

  return (
    <div className="min-h-[60vh] bg-[#0d1117] px-4 py-16 text-gray-100" dir="ltr">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#30363d] bg-[#161b22] p-8 text-center shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/80">AetherBI · Recovery Shield</p>
        <h1 className="mt-3 text-2xl font-black text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-400">
          A client-side exception was caught. Your session data is safe. Reset the view or clear corrupt browser cache and
          continue.
        </p>
        {error?.digest ? (
          <p className="mt-3 font-mono text-[11px] text-gray-500">digest: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500"
            onClick={() => reset()}
          >
            Try again
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#30363d] px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5"
            onClick={() => {
              clearCorruptClientCache()
              reset()
            }}
          >
            Clear cache & retry
          </button>
          <a
            href="/erp"
            className="rounded-lg border border-[#30363d] px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5"
          >
            Back to ERP
          </a>
        </div>
      </div>
    </div>
  )
}
