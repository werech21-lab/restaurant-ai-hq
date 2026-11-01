'use client'

import { useCallback, useRef, useState } from 'react'
import JSZip from 'jszip'
import type { SmartIngestModule } from '@/lib/smart-ingest-modules'
import { SMART_INGEST_META } from '@/lib/smart-ingest-modules'

type ResultRow = {
  id: string
  module: string
  fileName: string
  relativePath: string
  category: string
  categoryLabelAr: string
  categoryLabelEn: string
  entityKey: string | null
  entityLabel: string | null
  branchCode: string | null
  brandCode: string | null
  amountKwd: number | null
  matchScore: number
  status: 'MATCHED' | 'REVIEW' | 'APPLIED' | 'SKIPPED'
  updates: string[]
  expiryDate: string | null
  fileUrl: string | null
}

type Props = {
  module: SmartIngestModule
  locale: 'ar' | 'en'
}

const CONCURRENCY = 3
const MAX_INLINE = 750_000
const HR_EXT = /\.(pdf|jpe?g|png|webp|xlsx?|csv|docx?|txt)$/i
const JUNK_PATH =
  /(^|[\\/])(node_modules|\.git|\.next|AppData|\$RECYCLE\.BIN|System Volume Information|Windows|Program Files|ProgramData|\.cache|\.npm|\.pnpm|dist|build|coverage)([\\/]|$)/i
const JUNK_NAME = /^(Thumbs\.db|\.DS_Store|desktop\.ini|~\$)/i

function relativeOf(file: File) {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
}

function isJunk(file: File) {
  const rel = relativeOf(file)
  const base = file.name
  if (JUNK_PATH.test(rel)) return true
  if (JUNK_NAME.test(base)) return true
  if (base.startsWith('.') || base.startsWith('~$')) return true
  if (/\.(exe|dll|msi|mp4|mov|avi|mkv|iso|dmg|sys|bin|jar|wasm)$/i.test(base)) return true
  if (/\.zip$/i.test(base)) return false
  return !HR_EXT.test(base)
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) return file
  if (file.size < 120_000) return file
  try {
    const bitmap = await createImageBitmap(file)
    const max = 1280
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    const quality = file.size > 2_000_000 ? 0.55 : 0.7
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}

async function expandZip(file: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const out: File[] = []
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    const blob = await entry.async('blob')
    const name = entry.name.split('/').pop() || entry.name
    const f = new File([blob], name, { type: blob.type || 'application/octet-stream' })
    Object.defineProperty(f, 'webkitRelativePath', { value: entry.name, configurable: true })
    out.push(f)
  }
  return out
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  shouldPause: () => boolean,
) {
  const results: R[] = new Array(items.length)
  let next = 0
  async function run() {
    while (next < items.length) {
      while (shouldPause()) await new Promise((r) => setTimeout(r, 200))
      const index = next++
      results[index] = await worker(items[index]!, index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
  return results
}

export function SmartDepartmentFolderUpload({ module, locale }: Props) {
  const meta = SMART_INGEST_META[module]
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const label = useCallback((ar: string, en: string) => (locale === 'en' ? en : ar), [locale])
  const inputRef = useRef<HTMLInputElement>(null)
  const pauseRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState<File[]>([])
  const [ignoredCount, setIgnoredCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })
  const [batchId, setBatchId] = useState<string | null>(null)
  const [rows, setRows] = useState<ResultRow[]>([])
  const [failedNames, setFailedNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function prepareSelection(fileList: File[]) {
    setError(null)
    setNotice(null)
    setRows([])
    setFailedNames([])
    setProgress({ done: 0, total: 0, failed: 0 })
    const expanded: File[] = []
    for (const file of fileList) {
      if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
        try {
          expanded.push(...(await expandZip(file)))
        } catch {
          /* ignore */
        }
      } else expanded.push(file)
    }
    const accepted: File[] = []
    let ignored = 0
    for (const file of expanded) {
      if (isJunk(file)) ignored += 1
      else accepted.push(file)
    }
    setIgnoredCount(ignored)
    setPending(accepted)
    setNotice(
      label(
        `تم العثور على ${accepted.length} ملف صالح لهذا القسم (وتم تجاهل ${ignored} ملف نظام غير ذي صلة)`,
        `Found ${accepted.length} valid files for this department (ignored ${ignored} junk/system files)`,
      ),
    )
  }

  async function ingestOne(raw: File, batch: string): Promise<{ rows: ResultRow[]; failed?: string }> {
    try {
      const file = await compressImageIfNeeded(raw)
      const relativePath = relativeOf(raw)
      const sizeBytes = file.size
      let contentBase64: string | undefined
      let textHint: string | undefined
      if (sizeBytes <= MAX_INLINE) {
        contentBase64 = await fileToBase64(file)
        if (contentBase64.length > 1_050_000) {
          contentBase64 = undefined
          textHint = `${relativePath} ${file.name} (metadata-only: oversized)`
        }
      } else if (/\.(txt|csv)$/i.test(file.name)) {
        textHint = (await file.text()).slice(0, 15000)
      } else {
        textHint = `${relativePath} ${file.name}`
      }

      const res = await fetch(`/api/ingest/${module}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: batch,
          files: [
            {
              relativePath,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              sizeBytes,
              contentBase64,
              textHint,
            },
          ],
        }),
      })
      const json = (await res.json()) as { data?: { rows?: ResultRow[] } }
      if (!res.ok) return { rows: [], failed: file.name }
      const out = json.data?.rows || []
      if (out.every((r) => r.status === 'SKIPPED')) return { rows: out, failed: file.name }
      return { rows: out }
    } catch {
      return { rows: [], failed: raw.name }
    }
  }

  async function startDistribution() {
    if (!pending.length || busy) return
    setBusy(true)
    setError(null)
    pauseRef.current = false
    setPaused(false)
    const batch = `batch_${module}_${Date.now().toString(36)}`
    setBatchId(batch)
    setProgress({ done: 0, total: pending.length, failed: 0 })
    const collected: ResultRow[] = []
    const failed: string[] = []
    let done = 0

    await mapPool(
      pending,
      CONCURRENCY,
      async (file) => {
        const result = await ingestOne(file, batch)
        if (result.failed) failed.push(result.failed)
        if (result.rows.length) collected.push(...result.rows)
        done += 1
        setProgress({ done, total: pending.length, failed: failed.length })
        setRows([...collected])
        setFailedNames([...failed])
        return result
      },
      () => pauseRef.current,
    )

    setNotice(
      label(
        `اكتمل التوزيع: ${collected.length} · فشل/تخطّي ${failed.length} · مطابق ${collected.filter((r) => r.status !== 'REVIEW' && r.status !== 'SKIPPED').length}`,
        `Done: ${collected.length} · failed/skipped ${failed.length} · matched ${collected.filter((r) => r.status !== 'REVIEW' && r.status !== 'SKIPPED').length}`,
      ),
    )
    if (failed.length) {
      setError(
        label(
          `تم تخطي ${failed.length} ملفاً دون إيقاف الباقي.`,
          `${failed.length} files skipped without stopping the rest.`,
        ),
      )
    }
    setBusy(false)
  }

  function togglePause() {
    pauseRef.current = !pauseRef.current
    setPaused(pauseRef.current)
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="space-y-6" dir={dir}>
      <div className="overflow-hidden rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-emerald-50 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">Dark Obsidian · AI Ingest</p>
        <h2 className="mt-2 text-xl font-bold text-white">{locale === 'en' ? meta.titleEn : meta.titleAr}</h2>
        <p className="mt-2 max-w-3xl text-sm text-emerald-100/80">{locale === 'en' ? meta.descEn : meta.descAr}</p>
        <p className="mt-3 rounded-xl border border-emerald-700/40 bg-black/30 px-3 py-2 text-xs text-emerald-200/90">
          {locale === 'en' ? meta.acceptsEn : meta.acceptsAr}
        </p>
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void prepareSelection(Array.from(e.dataTransfer.files || []))
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragging ? 'border-emerald-400 bg-emerald-950/20' : 'border-emerald-600/50 bg-slate-950/5'
        }`}
      >
        <p className="text-lg font-bold text-white dark:text-emerald-50">
          {label('اسحب وأفلت مجلد القسم أو ZIP / Excel / PDF / صور', 'Drag & drop department folder, ZIP, Excel, PDF, or images')}
        </p>
        <p className="mt-2 text-sm text-mist-300">
          {label(
            'فلترة نظام تلقائية · رفع متوازٍ (3) · ملف واحد لكل طلب · safeStorageKey',
            'Auto junk filter · parallel pool (3) · 1 file/request · safeStorageKey',
          )}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
            onClick={() => {
              if (!inputRef.current) return
              inputRef.current.setAttribute('webkitdirectory', '')
              inputRef.current.setAttribute('directory', '')
              inputRef.current.multiple = true
              inputRef.current.click()
            }}
          >
            {label('اختيار مجلد كامل', 'Choose full folder')}
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-emerald-600 px-5 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-950/20 disabled:opacity-60"
            onClick={() => {
              if (!inputRef.current) return
              inputRef.current.removeAttribute('webkitdirectory')
              inputRef.current.removeAttribute('directory')
              inputRef.current.multiple = true
              inputRef.current.click()
            }}
          >
            {label('اختيار ملفات / ZIP', 'Choose files / ZIP')}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            void prepareSelection(e.target.files ? Array.from(e.target.files) : [])
            e.target.value = ''
          }}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
        />
      </div>

      {pending.length > 0 || ignoredCount > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#11161f] p-4">
          <p className="text-sm font-semibold text-white">
            {label(
              `تم العثور على ${pending.length} ملف صالح (وتم تجاهل ${ignoredCount} ملف نظام)`,
              `Found ${pending.length} valid files (ignored ${ignoredCount} system files)`,
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || pending.length === 0}
              onClick={() => void startDistribution()}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {label('بدء التوزيع الذكي الآن 🚀', 'Start smart distribution now 🚀')}
            </button>
            {busy ? (
              <button type="button" onClick={togglePause} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold">
                {paused ? label('استئناف ▶', 'Resume ▶') : label('إيقاف مؤقت ⏸', 'Pause ⏸')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {busy || progress.total > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#11161f] p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-mist-100">
              {label('التقدم اللحظي', 'Live progress')}
              {batchId ? ` · ${batchId}` : ''}
              {paused ? ` · ${label('متوقف', 'paused')}` : ''}
            </span>
            <span dir="ltr">
              {progress.done}/{progress.total} ({pct}%) · fail {progress.failed}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {notice ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">{notice}</p> : null}
      {error ? <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">{error}</p> : null}

      {failedNames.length > 0 ? (
        <details className="rounded-xl border border-white/10 bg-[#11161f] p-3 text-xs text-mist-300">
          <summary className="cursor-pointer font-semibold">{label('قائمة المتخطاة / إعادة المحاولة', 'Skipped / retry list')}</summary>
          <ul className="mt-2 max-h-40 list-disc overflow-auto ps-5" dir="ltr">
            {failedNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#11161f]">
          <header className="border-b border-white/10 px-4 py-3">
            <h2 className="font-semibold text-white">{label('جدول التوزيع التلقائي الحي', 'Live auto-distribution table')}</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-mist-400">
                  <th className="px-3 py-2 text-start">{label('الملف', 'File')}</th>
                  <th className="px-3 py-2 text-start">{label('الربط', 'Matched entity')}</th>
                  <th className="px-3 py-2 text-start">{label('فرع/براند', 'Branch/Brand')}</th>
                  <th className="px-3 py-2 text-start">{label('التصنيف', 'Category')}</th>
                  <th className="px-3 py-2 text-start">{label('التحديثات', 'Updates')}</th>
                  <th className="px-3 py-2 text-start">{label('الحالة', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="px-3 py-2">
                      <p className="font-medium text-white">{row.fileName}</p>
                      <p className="text-xs text-mist-400" dir="ltr">
                        {row.relativePath}
                      </p>
                      {row.amountKwd != null ? (
                        <p className="text-xs text-emerald-700" dir="ltr">
                          {row.amountKwd.toFixed(3)} KWD
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {row.entityLabel || '—'}
                      {row.entityKey ? (
                        <span className="mt-0.5 block text-xs text-mist-400" dir="ltr">
                          {row.entityKey}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs" dir="ltr">
                      {[row.branchCode, row.brandCode].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2">{locale === 'en' ? row.categoryLabelEn : row.categoryLabelAr}</td>
                    <td className="px-3 py-2 text-xs text-mist-300" dir="ltr">
                      {row.updates.join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.status === 'SKIPPED'
                            ? 'bg-amber-100 text-amber-900'
                            : row.status === 'REVIEW'
                              ? 'bg-slate-100 text-mist-200'
                              : 'bg-emerald-100 text-emerald-300'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
