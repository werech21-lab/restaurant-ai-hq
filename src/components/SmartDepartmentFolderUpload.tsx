'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import JSZip from 'jszip'
import { SectionCard, StateBlock } from '@/components/ui'
import { isExcludedOdooEntity } from '@/lib/aether/period-delta'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'
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

async function collectFilesFromDroppedItems(dataTransfer: DataTransfer): Promise<File[]> {
  const items = dataTransfer.items
  if (!items || !items.length) {
    return Array.from(dataTransfer.files || [])
  }
  const entries: FileSystemEntry[] = []
  for (const item of Array.from(items)) {
    const entry = item.webkitGetAsEntry?.()
    if (entry) entries.push(entry)
  }
  if (!entries.length) {
    return Array.from(dataTransfer.files || [])
  }
  const files: File[] = []
  async function traverse(entry: FileSystemEntry) {
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        ;(entry as FileSystemFileEntry).file(
          (f) => {
            files.push(f)
            resolve()
          },
          () => resolve(),
        )
      })
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const readBatch = () =>
        new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject)
        })
      for (;;) {
        const batch = await readBatch()
        if (!batch.length) break
        for (const child of batch) {
          await traverse(child)
        }
      }
    }
  }
  for (const entry of entries) {
    await traverse(entry)
  }
  return files.length ? files : Array.from(dataTransfer.files || [])
}

function UnavailableMarker({ tooltip }: { tooltip: string }) {
  return (
    <span
      dir="ltr"
      title={tooltip}
      aria-label={tooltip}
      data-unavailable="true"
      className="ds-num tabular-nums"
      style={{ color: 'var(--ds-unavailable)' }}
    >
      {UNAVAILABLE_DASH}
    </span>
  )
}

export function SmartDepartmentFolderUpload({ module, locale }: Props) {
  const meta = SMART_INGEST_META[module]
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const label = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr])
  const unavailableTooltip = getUnavailableTooltip(locale)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const pauseRef = useRef(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.removeAttribute('accept')
      folderInputRef.current.setAttribute('webkitdirectory', '')
      folderInputRef.current.setAttribute('directory', '')
      folderInputRef.current.setAttribute('mozdirectory', '')
    }
  }, [])

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
          // Skip unreadable zip entry
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
        `تم العثور على ${formatInt(accepted.length, locale)} ملف صالح لهذا القسم (وتم تجاهل ${formatInt(ignored, locale)} ملف نظام غير ذي صلة)`,
        `Found ${formatInt(accepted.length, locale)} valid files for this department (ignored ${formatInt(ignored, locale)} junk/system files)`,
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

    const matchedCount = collected.filter((r) => r.status !== 'REVIEW' && r.status !== 'SKIPPED').length
    setNotice(
      label(
        `اكتمل التوزيع: ${formatInt(collected.length, locale)} · فشل/تخطّي ${formatInt(failed.length, locale)} · مطابق ${formatInt(matchedCount, locale)}`,
        `Done: ${formatInt(collected.length, locale)} · failed/skipped ${formatInt(failed.length, locale)} · matched ${formatInt(matchedCount, locale)}`,
      ),
    )
    if (failed.length) {
      setError(
        label(
          `تم تخطي ${formatInt(failed.length, locale)} ملفاً دون إيقاف الباقي.`,
          `${formatInt(failed.length, locale)} files skipped without stopping the rest.`,
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
    <div className="min-w-0 space-y-6" dir={dir}>
      <div className="ae-hero-emerald-card overflow-hidden rounded-2xl p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-90">
          {label('التوزيع الذكي لملفات القسم', 'Smart Department Document Distribution')}
        </p>
        <h2 className="mt-2 text-xl font-bold">{isAr ? meta.titleAr : meta.titleEn}</h2>
        <p className="mt-2 max-w-3xl text-sm opacity-90">{isAr ? meta.descAr : meta.descEn}</p>
        <p className="ae-hero-pill mt-3 inline-block rounded-xl px-3 py-2 text-xs font-medium">
          {isAr ? meta.acceptsAr : meta.acceptsEn}
        </p>
      </div>

      <div
        role="region"
        aria-label={label('منطقة سحب وإفلات ملفات القسم', 'Department folder dropzone')}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setDragging(false)
          const files = await collectFilesFromDroppedItems(e.dataTransfer)
          void prepareSelection(files)
        }}
        style={{
          backgroundColor: dragging ? 'var(--ds-accent-soft)' : 'var(--ds-bg-surface)',
          borderColor: dragging ? 'var(--ds-accent)' : 'var(--ds-border-accent)',
        }}
        className="rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-8"
      >
        <p className="text-lg font-bold text-[var(--ds-text-primary)]">
          {label('اسحب وأفلت مجلد القسم أو ZIP / Excel / PDF / صور', 'Drag & drop department folder, ZIP, Excel, PDF, or images')}
        </p>
        <p className="ds-caption mt-2">
          {label(
            'فلترة نظام تلقائية · رفع متوازٍ (3) · ملف واحد لكل طلب · تخزين آمن',
            'Auto junk filter · parallel upload (3) · 1 file/request · encrypted storage',
          )}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            disabled={busy}
            className="ds-focus-ring btn-colored cursor-pointer rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (busy) return
              const input = document.createElement('input')
              input.type = 'file'
              input.multiple = true
              input.setAttribute('webkitdirectory', '')
              input.setAttribute('directory', '')
              input.setAttribute('mozdirectory', '')
              input.onchange = (ev: Event) => {
                const target = ev.target as HTMLInputElement
                const files = Array.from(target.files || [])
                if (files.length > 0) {
                  void prepareSelection(files)
                }
              }
              input.click()
            }}
          >
            {label('رفع مجلد كامل', 'Upload Entire Folder')}
          </button>
          <button
            type="button"
            disabled={busy}
            className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-accent)] bg-[var(--ds-accent-soft)] px-5 py-3 text-sm font-bold text-[var(--ds-text-primary)] hover:brightness-95 disabled:opacity-60"
            onClick={() => {
              if (!fileInputRef.current) return
              fileInputRef.current.multiple = true
              fileInputRef.current.click()
            }}
          >
            {label('اختيار ملفات متعددة', 'Select Multiple Files')}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          aria-label={label('اختيار ملفات القسم للرفع', 'Select department files to upload')}
          className="hidden"
          multiple
          onChange={(e) => {
            void prepareSelection(e.target.files ? Array.from(e.target.files) : [])
            e.target.value = ''
          }}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
        />
        <input
          ref={folderInputRef}
          type="file"
          aria-label={label('اختيار مجلد القسم للرفع', 'Select department folder to upload')}
          className="hidden"
          multiple
          onChange={(e) => {
            void prepareSelection(e.target.files ? Array.from(e.target.files) : [])
            e.target.value = ''
          }}
        />
      </div>

      {pending.length > 0 || ignoredCount > 0 ? (
        <div className="ds-surface rounded-2xl p-4">
          <p className="text-sm font-semibold text-[var(--ds-text-primary)]">
            {label(
              `تم العثور على ${formatInt(pending.length, locale)} ملف صالح (وتم تجاهل ${formatInt(ignoredCount, locale)} ملف نظام)`,
              `Found ${formatInt(pending.length, locale)} valid files (ignored ${formatInt(ignoredCount, locale)} system files)`,
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || pending.length === 0}
              onClick={() => void startDistribution()}
              className="ds-focus-ring btn-colored cursor-pointer rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {label('بدء التوزيع الذكي الآن', 'Start smart distribution now')}
            </button>
            {busy ? (
              <button
                type="button"
                onClick={togglePause}
                className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-4 py-2.5 text-sm font-bold text-[var(--ds-text-primary)]"
              >
                {paused ? label('استئناف', 'Resume') : label('إيقاف مؤقت', 'Pause')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {busy || progress.total > 0 ? (
        <div className="ds-surface rounded-2xl p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-[var(--ds-text-primary)]">
              {label('حالة التقدم', 'Upload progress')}
              {batchId ? ` · ${batchId}` : ''}
              {paused ? ` · ${label('متوقف', 'paused')}` : ''}
            </span>
            <span dir="ltr" className="ds-num font-semibold tabular-nums text-[var(--ds-text-secondary)]">
              {formatInt(progress.done, locale)}/{formatInt(progress.total, locale)} ({formatPct(pct, { locale, decimals: 0 })}) · fail{' '}
              {formatInt(progress.failed, locale)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label('تقدم رفع ملفات القسم', 'Department upload progress')}
            className="h-3 overflow-hidden rounded-full bg-[var(--ds-bg-subtle)]"
          >
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: 'var(--ds-positive-bg)',
            borderColor: 'var(--ds-positive-border)',
            color: 'var(--ds-positive)',
          }}
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <StateBlock
          state="error"
          compact
          locale={locale}
          title={label('تنبيه أثناء المعالجة', 'Processing notice')}
          description={error}
        />
      ) : null}

      {failedNames.length > 0 ? (
        <details className="ds-surface rounded-xl p-3 text-xs text-[var(--ds-text-secondary)]">
          <summary className="ds-focus-ring cursor-pointer font-semibold text-[var(--ds-text-primary)]">
            {label('قائمة المتخطاة / إعادة المحاولة', 'Skipped / retry list')} ({formatInt(failedNames.length, locale)})
          </summary>
          <ul className="mt-2 max-h-40 list-disc overflow-auto ps-5" dir="ltr">
            {failedNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {rows.length === 0 && !busy && pending.length === 0 ? (
        <StateBlock
          state="empty"
          compact
          locale={locale}
          title={label('بانتظار رفع ملفات القسم', 'Ready for department files')}
          description={label(
            'اسحب مجلد القسم أو اختر ملفات Excel / PDF / الصور لربطها تلقائياً.',
            'Drop a department folder or choose Excel / PDF / image files to classify and route.',
          )}
        />
      ) : null}

      {rows.length > 0 ? (
        <SectionCard
          title={label('جدول التوزيع التلقائي', 'Auto-distribution table')}
          locale={locale}
          padded={false}
        >
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('الملف', 'File')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('الربط', 'Matched entity')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('فرع / براند', 'Branch / Brand')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('المبلغ', 'Amount')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('التصنيف', 'Category')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('الانتهاء', 'Expiry')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('التحديثات', 'Updates')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('الحالة', 'Status')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {rows.map((row) => {
                  const safeEntity =
                    row.entityLabel && !isExcludedOdooEntity(row.entityLabel) ? row.entityLabel : null
                  const safeBranch =
                    row.branchCode && !isExcludedOdooEntity(row.branchCode) ? row.branchCode : null
                  const safeBrand =
                    row.brandCode && !isExcludedOdooEntity(row.brandCode) ? row.brandCode : null
                  const formattedExpiry = row.expiryDate ? formatDate(row.expiryDate, locale) : UNAVAILABLE_DASH

                  const badgeStyle =
                    row.status === 'SKIPPED'
                      ? {
                          backgroundColor: 'var(--ds-warning-bg)',
                          borderColor: 'var(--ds-warning-border)',
                          color: 'var(--ds-warning)',
                        }
                      : row.status === 'REVIEW'
                        ? {
                            backgroundColor: 'var(--ds-unavailable-bg)',
                            borderColor: 'var(--ds-unavailable-border)',
                            color: 'var(--ds-unavailable)',
                          }
                        : {
                            backgroundColor: 'var(--ds-positive-bg)',
                            borderColor: 'var(--ds-positive-border)',
                            color: 'var(--ds-positive)',
                          }

                  return (
                    <tr key={row.id} className="hover:bg-[var(--ds-bg-hover)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--ds-text-primary)]">{row.fileName}</p>
                        <p className="ds-caption" dir="ltr">
                          {row.relativePath}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[var(--ds-text-primary)]">
                        {safeEntity || <UnavailableMarker tooltip={unavailableTooltip} />}
                        {row.entityKey ? (
                          <span className="ds-caption ds-num mt-0.5 block tabular-nums" dir="ltr">
                            {row.entityKey}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--ds-text-secondary)]" dir="ltr">
                        {[safeBranch, safeBrand].filter(Boolean).join(' · ') || (
                          <UnavailableMarker tooltip={unavailableTooltip} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {row.amountKwd != null && Number.isFinite(row.amountKwd) ? (
                          <span dir="ltr" className="ds-num font-semibold tabular-nums text-[var(--ds-text-primary)]">
                            {formatKwd(row.amountKwd, locale)}
                          </span>
                        ) : (
                          <UnavailableMarker tooltip={unavailableTooltip} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--ds-text-primary)]">
                        {isAr ? row.categoryLabelAr : row.categoryLabelEn}
                      </td>
                      <td className="px-4 py-3">
                        {formattedExpiry === UNAVAILABLE_DASH ? (
                          <UnavailableMarker tooltip={unavailableTooltip} />
                        ) : (
                          <span dir="ltr" className="ds-num tabular-nums text-[var(--ds-text-primary)]">
                            {formattedExpiry}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--ds-text-secondary)]" dir="ltr">
                        {row.updates.join(', ') || UNAVAILABLE_DASH}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          style={badgeStyle}
                          className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}
