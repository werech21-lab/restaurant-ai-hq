'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { useI18n } from '@/lib/i18n'

type Emp = { id: string; name: string; code: string; department: string }
type ResultRow = {
  id: string
  fileName: string
  relativePath: string
  category: string
  categoryLabelAr: string
  categoryLabelEn: string
  employeeId: string | null
  employeeName: string | null
  employeeCode: string | null
  matchScore: number
  status: 'MATCHED' | 'REVIEW' | 'APPLIED' | 'SKIPPED'
  updates: string[]
  expiryDate: string | null
  civilId: string | null
}

type Props = { employees: Emp[]; locale: 'ar' | 'en' }

const CONCURRENCY = 3
/** ~750KB binary → ~1MB base64 — safely under Vercel 4.5MB with JSON wrapper. */
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
  if (/\.zip$/i.test(base)) return false // zip handled separately then filtered
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

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>, shouldPause: () => boolean) {
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

export function SmartFolderUploadClient({ employees: initialEmployees, locale }: Props) {
  const { t, dir } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const pauseRef = useRef(false)
  const [employees, setEmployees] = useState(initialEmployees)

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.removeAttribute('accept')
      folderInputRef.current.setAttribute('webkitdirectory', '')
      folderInputRef.current.setAttribute('directory', '')
      folderInputRef.current.setAttribute('mozdirectory', '')
    }
  }, [])
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

  const reviewRows = useMemo(() => rows.filter((r) => r.status === 'REVIEW'), [rows])
  const matchedRows = useMemo(() => rows.filter((r) => r.status !== 'REVIEW'), [rows])
  const label = useCallback((ar: string, en: string) => (locale === 'en' ? en : ar), [locale])

  async function refreshEmployees() {
    const res = await fetch('/api/hr/ingest-folder', { credentials: 'same-origin' })
    if (!res.ok) return
    const json = (await res.json()) as { data?: { employees?: Emp[] } }
    if (json.data?.employees) setEmployees(json.data.employees)
  }

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
          // ignore broken zip
        }
      } else {
        expanded.push(file)
      }
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
        `تم العثور على ${accepted.length} ملف موظف صالح للرفع (وتم تجاهل ${ignored} ملف نظام غير ذي صلة)`,
        `Found ${accepted.length} valid HR files (ignored ${ignored} system/junk files)`,
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
        // Extra safety: drop if base64 would blow the soft limit
        if (contentBase64.length > 1_050_000) {
          contentBase64 = undefined
          textHint = `${relativePath} ${file.name} (metadata-only: oversized)`
        }
      } else if (/\.(txt|csv)$/i.test(file.name)) {
        textHint = (await file.text()).slice(0, 15000)
      } else {
        textHint = `${relativePath} ${file.name}`
      }

      const res = await fetch('/api/hr/ingest-folder', {
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
      const json = (await res.json()) as { data?: { rows?: ResultRow[] }; error?: { message?: string } }
      if (!res.ok) return { rows: [], failed: file.name }
      const out = json.data?.rows || []
      if (out.every((r) => r.status === 'SKIPPED')) return { rows: out, failed: file.name }
      return { rows: out }
    } catch {
      return { rows: [], failed: raw.name }
    }
  }

  async function startDistribution() {
    if (pending.length === 0 || busy) return
    setBusy(true)
    setError(null)
    pauseRef.current = false
    setPaused(false)
    const batch = `batch_${Date.now().toString(36)}`
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
        `اكتمل التوزيع: ${collected.length} ملف · فشل/تخطّي ${failed.length} · مطابق ${collected.filter((r) => r.status !== 'REVIEW').length}`,
        `Done: ${collected.length} processed · failed/skipped ${failed.length} · matched ${collected.filter((r) => r.status !== 'REVIEW').length}`,
      ),
    )
    if (failed.length) {
      setError(
        label(
          `تم تخطي ${failed.length} ملفاً دون إيقاف الباقي. يمكن إعادة المحاولة لاحقاً.`,
          `${failed.length} files skipped without stopping the rest. Retry later if needed.`,
        ),
      )
    }
    await refreshEmployees()
    setBusy(false)
  }

  function togglePause() {
    pauseRef.current = !pauseRef.current
    setPaused(pauseRef.current)
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const list = event.target.files ? Array.from(event.target.files) : []
    void prepareSelection(list)
    event.target.value = ''
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault()
    setDragging(false)
    const collected = await collectFilesFromDroppedItems(event.dataTransfer)
    void prepareSelection(collected)
  }

  async function assign(documentId: string, employeeId: string) {
    const res = await fetch('/api/hr/ingest-folder', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, employeeId }),
    })
    const json = (await res.json()) as { data?: ResultRow; error?: { message?: string } }
    if (!res.ok) {
      setError(json.error?.message || 'assign_failed')
      return
    }
    if (json.data) setRows((prev) => prev.map((row) => (row.id === documentId ? json.data! : row)))
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="space-y-6" dir={dir}>
      <div
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => void onDrop(e)}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragging ? 'border-emerald-500 bg-emerald-950/20' : 'border-emerald-300 bg-[#11161f]'
        }`}
      >
        <p className="text-lg font-bold text-emerald-300">
          {label('اسحب وأفلت مجلد الموظفين أو ZIP / Excel / PDF / صور هنا', 'Drag & drop HR folder, ZIP, Excel, PDF, or images')}
        </p>
        <p className="mt-2 text-sm text-mist-300">
          {label(
            'فلترة تلقائية لملفات النظام · رفع متوازٍ (3) · ملف واحد لكل طلب تحت حد Vercel',
            'Auto junk filter · parallel pool (3) · 1 file per request under Vercel limits',
          )}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
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
            {label('اختيار مجلد كامل', 'Choose full folder')}
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-emerald-600 px-5 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-950/20 disabled:opacity-60"
            onClick={() => {
              if (!fileInputRef.current) return
              fileInputRef.current.multiple = true
              fileInputRef.current.click()
            }}
          >
            {label('اختيار ملفات / ZIP', 'Choose files / ZIP')}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={onInputChange}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
        />
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={onInputChange}
        />
      </div>

      {pending.length > 0 || ignoredCount > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#11161f] p-4">
          <p className="text-sm font-semibold text-white">
            {label(
              `تم العثور على ${pending.length} ملف موظف صالح للرفع (وتم تجاهل ${ignoredCount} ملف نظام غير ذي صلة)`,
              `Found ${pending.length} valid HR files (ignored ${ignoredCount} system/junk files)`,
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
              <button type="button" onClick={togglePause} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-mist-100">
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
              {paused ? ` · ${label('متوقف مؤقتاً', 'paused')}` : ''}
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
          <summary className="cursor-pointer font-semibold">{label('إعادة المحاولة التلقائية / المتخطاة', 'Auto-retry / skipped list')}</summary>
          <ul className="mt-2 max-h-40 list-disc overflow-auto ps-5" dir="ltr">
            {failedNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {matchedRows.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#11161f]">
          <header className="border-b border-white/10 px-4 py-3">
            <h2 className="font-semibold text-white">{label('جدول التوزيع التلقائي', 'Auto-distribution table')}</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-mist-400">
                  <th className="px-3 py-2 text-start">{label('الملف', 'File')}</th>
                  <th className="px-3 py-2 text-start">{label('الموظف', 'Employee')}</th>
                  <th className="px-3 py-2 text-start">{label('القسم', 'Category')}</th>
                  <th className="px-3 py-2 text-start">{label('التحديثات', 'Updates')}</th>
                  <th className="px-3 py-2 text-start">{label('الحالة', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {matchedRows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="px-3 py-2">
                      <p className="font-medium text-white">{row.fileName}</p>
                      <p className="text-xs text-mist-400" dir="ltr">
                        {row.relativePath}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      {row.employeeName ? (
                        <span>
                          {row.employeeName}
                          <span className="mt-0.5 block text-xs text-mist-400" dir="ltr">
                            {row.employeeCode}
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">{locale === 'en' ? row.categoryLabelEn : row.categoryLabelAr}</td>
                    <td className="px-3 py-2 text-xs text-mist-300" dir="ltr">
                      {row.updates.join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-300">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {reviewRows.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-50/40">
          <header className="border-b border-amber-500/30 px-4 py-3">
            <h2 className="font-semibold text-amber-300">
              {label('ملفات تحتاج لتأكيدك السريع (Unmatched / Review Queue)', 'Files needing quick confirmation (Review Queue)')}
            </h2>
          </header>
          <ul className="divide-y divide-amber-100">
            {reviewRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-[200px] flex-1">
                  <p className="font-medium text-white">{row.fileName}</p>
                  <p className="text-xs text-mist-400" dir="ltr">
                    {row.relativePath}
                  </p>
                </div>
                <select
                  className="rounded-lg border border-white/15 bg-[#11161f] px-2 py-1.5 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) void assign(row.id, e.target.value)
                  }}
                >
                  <option value="">{label('اختر الموظف…', 'Select employee…')}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code})
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-mist-400">
        {t('nav.hr')} · {label('الخزائن الرقمية تظهر داخل بطاقة كل موظف بعد الربط', 'Digital dossiers appear on each employee card after matching')}
      </p>
    </div>
  )
}
