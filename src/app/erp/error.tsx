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
    // ignore
  }
}

export default function ErpErrorShield({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AetherBI ERP] client error boundary', error?.message, error?.digest)
  }, [error])

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16" dir="ltr">
      <div className="rounded-2xl border border-[#30363d] bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#1c2128] p-8 text-center text-gray-100 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/90">ERP Recovery · Dark Obsidian</p>
        <h1 className="mt-3 text-2xl font-black text-white">Page recovery shield</h1>
        <p className="mt-2 text-sm text-gray-400">
          This ERP screen hit a client exception (often from a stale auto-scan payload or a live timer). Reset restores the
          last good React tree without a black Vercel crash screen.
        </p>
        {error?.message ? (
          <p className="mt-4 break-words rounded-lg border border-red-500/20 bg-red-950/40 px-3 py-2 font-mono text-[11px] text-red-200">
            {error.message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
            onClick={() => reset()}
          >
            Reset this screen
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#30363d] px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5"
            onClick={() => {
              clearCorruptClientCache()
              reset()
            }}
          >
            Clear cache & reset
          </button>
          <a
            href="/erp/aggregator-radar"
            className="rounded-lg border border-[#30363d] px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/5"
          >
            Open Aggregator Radar
          </a>
          <a href="/erp" className="rounded-lg border border-[#30363d] px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5">
            ERP home
          </a>
        </div>
      </div>
    </main>
  )
}
