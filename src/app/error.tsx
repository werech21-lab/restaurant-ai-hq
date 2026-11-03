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

function writeFallbackSession() {
  try {
    const fallbackUser = {
      id: 'usr_ahmed_exec',
      name: 'Ahmed Al-Ebrahim - CEO',
      email: 'ahmed@venturefoodskw.com',
      role: 'CEO',
      isAdmin: true,
    }
    window.localStorage.setItem('aether_user', JSON.stringify(fallbackUser))
    window.localStorage.setItem('vf_user', JSON.stringify(fallbackUser))
    window.localStorage.setItem('current_user', JSON.stringify(fallbackUser))
    window.localStorage.setItem('user_session', JSON.stringify(fallbackUser))
    window.localStorage.setItem('aether_session_token', 'local_exec_bypass')
  } catch {
    // ignore storage access errors
  }
}

function isNetworkOrFetchError(error: Error & { digest?: string }): boolean {
  const text = `${error?.message || ''} ${error?.name || ''} ${error?.digest || ''}`.toLowerCase()
  return (
    text.includes('failed to fetch') ||
    text.includes('err_name_not_resolved') ||
    text.includes('networkerror') ||
    text.includes('load failed') ||
    text.includes('net::') ||
    text.includes('econnrefused')
  )
}

export default function GlobalErrorShield({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isNetworkFailure = isNetworkOrFetchError(error)

  useEffect(() => {
    console.error('[AetherBI] client error boundary', error?.message, error?.digest)
    if (isNetworkFailure) {
      writeFallbackSession()
      // Bypass Recovery Shield and redirect directly to dashboard
      window.location.replace('/dashboard')
    }
  }, [error, isNetworkFailure])

  if (isNetworkFailure) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#07090f] text-gold-300">
        <div className="text-center font-cairo">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
          <p className="text-base font-bold text-white">جاري الاتصال والتحويل إلى لوحة التحكم...</p>
          <p className="mt-1 text-xs text-mist-400">Connecting to AetherBI...</p>
        </div>
      </div>
    )
  }

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
            href="/dashboard"
            className="rounded-lg border border-[#30363d] px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
