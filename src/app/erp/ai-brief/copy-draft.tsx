'use client'

import { useState } from 'react'

export function CopyIssueDraft({ draft }: { draft: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-2">
      <button type="button" onClick={copy} className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-slate-900 ring-1 ring-slate-300">
        نسخ مسودة GitHub
      </button>
      {copied ? <p className="mt-1 text-xs text-slate-600">نُسخت المسودة. لم يُنشأ شيء ولم يُكتب كود.</p> : null}
      <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{draft}</pre>
    </div>
  )
}
