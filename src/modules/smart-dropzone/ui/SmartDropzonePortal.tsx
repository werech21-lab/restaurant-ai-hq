'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import {
  emptySmartDropzoneCounters,
  SMART_DROPZONE_DEPT_CARDS,
  type SmartDropzoneDepartment,
} from '@/modules/smart-dropzone/domain/departments'

type LedgerRow = {
  id: string
  fileName: string
  relativePath: string
  mimeType: string
  department: SmartDropzoneDepartment
  departmentLabelAr: string
  departmentLabelEn: string
  href: string
  archiveHref: string
  entityLabel: string | null
  brandCode: string | null
  branchCode: string | null
  amountKwd: number | null
  matchScore: number
  status: string
  updates: string[]
  updatesEn: string[]
  fileUrl: string | null
  previewUrl: string | null
  overridden: boolean
  source?: string
  sha256?: string | null
  createdAt?: string
}

type QueuedFile = {
  key: string
  file: File
  relativePath: string
}

const PAGE_SIZE = 100
const BATCH_SIZE = 4

function isHidden(pathValue: string): boolean {
  return pathValue.split(/[/\\]/).some(
    (p) => !p || p.startsWith('.') || /^~\$/.test(p) || /^(thumbs\.db|desktop\.ini|\.ds_store)$/i.test(p),
  )
}

function acceptFile(file: File, relativePath: string): boolean {
  if (isHidden(relativePath) || isHidden(file.name)) return false
  return /\.(pdf|xlsx?|docx?|csv|png|jpe?g|webp|zip|txt)$/i.test(file.name)
}

async function fileToBase64(file: File): Promise<string | undefined> {
  if (file.size > 900_000) return undefined
  const buf = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export default function SmartDropzonePortal() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const inputRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [counters, setCounters] = useState(() => emptySmartDropzoneCounters())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [page, setPage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, page])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/smart-dropzone/list?limit=300', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) return
        const payload = (await response.json()) as { data?: { rows?: LedgerRow[] } }
        const existing = payload.data?.rows || []
        if (!existing.length) return
        setRows(existing)
        const next = emptySmartDropzoneCounters()
        for (const row of existing) {
          if (row.department in next) next[row.department] += 1
        }
        setCounters(next)
      })
      .catch(() => {
        /* ignore abort / auth soft-fail on first paint */
      })
    return () => controller.abort()
  }, [])

  const addFiles = useCallback((list: FileList | File[], basePath = '') => {
    const next: QueuedFile[] = []
    for (const file of Array.from(list)) {
      const relativePath =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        (basePath ? `${basePath}/${file.name}` : file.name)
      if (!acceptFile(file, relativePath)) continue
      next.push({
        key: `${relativePath}::${file.size}::${file.lastModified}`,
        file,
        relativePath,
      })
    }
    setQueue((prev) => {
      const seen = new Set(prev.map((p) => p.key))
      const merged = [...prev]
      for (const item of next) {
        if (seen.has(item.key)) continue
        seen.add(item.key)
        merged.push(item)
      }
      return merged
    })
    setPage(0)
  }, [])

  async function readDirectoryEntries(entry: FileSystemDirectoryEntry, prefix: string) {
    const reader = entry.createReader()
    const all: FileSystemEntry[] = []
    const readBatch = () =>
      new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject)
      })
    for (;;) {
      const batch = await readBatch()
      if (!batch.length) break
      all.push(...batch)
    }
    for (const child of all) {
      const path = prefix ? `${prefix}/${child.name}` : child.name
      if (child.isFile) {
        await new Promise<void>((resolve) => {
          ;(child as FileSystemFileEntry).file((file) => {
            addFiles([file], prefix)
            resolve()
          }, () => resolve())
        })
      } else if (child.isDirectory) {
        await readDirectoryEntries(child as FileSystemDirectoryEntry, path)
      }
    }
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault()
    setDragOver(false)
    const items = event.dataTransfer.items
    if (items && items.length) {
      const entries: FileSystemEntry[] = []
      for (const item of Array.from(items)) {
        const entry = item.webkitGetAsEntry?.()
        if (entry) entries.push(entry)
      }
      if (entries.length) {
        for (const entry of entries) {
          if (entry.isDirectory) await readDirectoryEntries(entry as FileSystemDirectoryEntry, entry.name)
          else if (entry.isFile) {
            await new Promise<void>((resolve) => {
              ;(entry as FileSystemFileEntry).file((file) => {
                addFiles([file])
                resolve()
              }, () => resolve())
            })
          }
        }
        return
      }
    }
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files)
  }

  async function processQueue() {
    if (!queue.length || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const batchId = `sdz_${Date.now()}`
    const total = queue.length
    setProgress({ done: 0, total })
    const localCounters = emptySmartDropzoneCounters()
    const collected: LedgerRow[] = []

    try {
      for (let i = 0; i < queue.length; i += BATCH_SIZE) {
        const slice = queue.slice(i, i + BATCH_SIZE)
        const files = []
        for (const item of slice) {
          const contentBase64 = await fileToBase64(item.file)
          files.push({
            fileName: item.file.name,
            relativePath: item.relativePath,
            mimeType: item.file.type || 'application/octet-stream',
            sizeBytes: item.file.size,
            contentBase64,
          })
        }
        const response = await fetch('/api/smart-dropzone/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ batchId, files }),
        })
        const payload = (await response.json()) as {
          data?: { rows?: LedgerRow[]; counters?: Record<SmartDropzoneDepartment, number> }
          error?: { message?: string }
        }
        if (!response.ok) throw new Error(payload.error?.message || 'Processing failed')
        for (const row of payload.data?.rows || []) {
          collected.push(row)
          localCounters[row.department] += 1
        }
        setCounters({ ...localCounters })
        setRows([...collected])
        setProgress({ done: Math.min(total, i + slice.length), total })
      }
      setNotice(
        en
          ? `Routed ${collected.length} files across 7 departments. Open archive or department records from the ledger.`
          : `تم توجيه ${collected.length} ملفاً عبر الأقسام السبعة. افتح الأرشيف أو سجل القسم من الجدول.`,
      )
      setQueue([])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : en ? 'Routing failed' : 'فشل التوجيه')
    } finally {
      setBusy(false)
    }
  }

  async function overrideDepartment(row: LedgerRow, department: SmartDropzoneDepartment) {
    setBusy(true)
    try {
      const response = await fetch('/api/smart-dropzone/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          batchId: `override_${Date.now()}`,
          files: [
            {
              fileName: row.fileName,
              relativePath: row.relativePath,
              mimeType: row.mimeType,
              forceDepartment: department,
              textHint: row.updates.join(' '),
            },
          ],
        }),
      })
      const payload = (await response.json()) as { data?: { rows?: LedgerRow[] } }
      const next = payload.data?.rows?.[0]
      if (next) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...next, id: row.id } : r)))
        setCounters((prev) => {
          const c = { ...prev }
          c[row.department] = Math.max(0, c[row.department] - 1)
          c[department] += 1
          return c
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 text-mist-100" dir={en ? 'ltr' : 'rtl'} data-no-translate="">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-300/80">
          AetherBI · Venture Foods
        </p>
        <h1 className="text-2xl font-black text-white sm:text-3xl">
          {en ? '🧠 AI Smart Dropzone & Auto-Router' : '🧠 بوابة الفرز والأرشفة الذكية الشاملة'}
        </h1>
        <p className="max-w-3xl text-sm text-mist-400">
          {en
            ? 'Drop one nested folder or hundreds of mixed files. The deterministic classifier routes each document into HR, Finance, Purchases, Inventory/Recipes, Sales/Aggregators, Governance, or CRM — then archives it with a live ledger.'
            : 'ارمِ مجلداً متداخلاً أو مئات الملفات المختلطة. يصنّف المحرك كل وثيقة ويوزعها على الموارد البشرية، المالية، المشتريات، المخزون/الوصفات، المبيعات/المنصات، الحوكمة، أو الكاترينج — مع أرشفة وربط فوري.'}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {SMART_DROPZONE_DEPT_CARDS.map((card) => (
          <article
            key={card.key}
            className="rounded-2xl border border-white/10 bg-[#0f141c] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <p className="text-[11px] font-semibold text-mist-400">
              {card.icon} {en ? card.en : card.ar}
            </p>
            <p className="mt-2 text-2xl font-black text-gold-300">{counters[card.key]}</p>
          </article>
        ))}
      </div>

      <section className="rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-950/40 via-[#0f141c] to-[#0f141c] p-5">
        <h2 className="text-base font-bold text-emerald-200">
          {en
            ? '⚡ Zero-Bandwidth Local Direct-DB Ingest'
            : '⚡ الحقن المحلي المباشر في قاعدة البيانات (Zero-Bandwidth)'}
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-mist-300">
          {en
            ? 'Managers: drop files into the project folder local-dropzone (or drag a folder onto Direct-DB-Ingest.bat). Run npm run ingest:direct on this PC. The CLI parses Excel/Word/PDF locally, classifies into the 7 departments, and upserts extracted records into the database with SHA-256 idempotency — without uploading raw binaries by default (≈99% less bandwidth). Optional: --upload-binaries.'
            : 'للمدير: ألقِ الملفات في مجلد local-dropzone داخل المشروع (أو اسحب مجلداً فوق Direct-DB-Ingest.bat). شغّل npm run ingest:direct على هذا الجهاز. يقرأ السكربت Excel/Word/PDF محلياً، يصنّفها للأقسام السبعة، ويحقن السجلات المستخرجة مباشرة في قاعدة البيانات ببصمة SHA-256 دون رفع الملفات الخام افتراضياً (توفير إنترنت ≈99%). اختياري: --upload-binaries.'}
        </p>
        <p className="mt-3 font-mono text-xs text-emerald-300/90" dir="ltr">
          npm run ingest:direct · npm run ingest:desktop · Direct-DB-Ingest.bat
        </p>
      </section>

      <section
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => void onDrop(e)}
        className={`rounded-3xl border-2 border-dashed p-8 text-center transition ${
          dragOver ? 'border-gold-300 bg-gold-400/10' : 'border-white/15 bg-[#0f141c]'
        }`}
      >
        <p className="text-lg font-bold text-white">
          {en ? 'Drop folders or files here' : 'أسقط المجلدات أو الملفات هنا'}
        </p>
        <p className="mt-2 text-sm text-mist-400">
          PDF · Excel · Word · CSV · PNG/JPG · ZIP · nested folders (webkitdirectory)
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="rounded-xl bg-gradient-to-l from-[#8cc63f] to-[#00a99d] px-4 py-2.5 text-sm font-bold text-ink-950"
            onClick={() => inputRef.current?.click()}
          >
            {en ? 'Select files' : 'اختيار ملفات'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-mist-100"
            onClick={() => folderRef.current?.click()}
          >
            {en ? 'Select entire folder' : 'اختيار مجلد كامل'}
          </button>
          <button
            type="button"
            disabled={!queue.length || busy}
            className="rounded-xl border border-gold-300/40 bg-gold-400/10 px-4 py-2.5 text-sm font-bold text-gold-200 disabled:opacity-40"
            onClick={() => void processQueue()}
          >
            {busy
              ? en
                ? `Routing… ${progress.done}/${progress.total}`
                : `جارٍ الفرز… ${progress.done}/${progress.total}`
              : en
                ? `Start AI routing (${queue.length})`
                : `بدء الفرز الذكي (${queue.length})`}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.xlsx,.xls,.docx,.doc,.csv,.png,.jpg,.jpeg,.webp,.zip,.txt"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={folderRef}
          type="file"
          className="hidden"
          multiple
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </section>

      {error ? <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">{error}</p> : null}
      {notice ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">{notice}</p>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0f141c]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h2 className="font-bold text-white">
            {en ? 'AI Classification & Distribution Ledger' : 'جدول القرار الذكي والتوجيه'}
          </h2>
          <p className="text-xs text-mist-400">
            {en
              ? `Showing ${pageRows.length} of ${rows.length} (virtualized pages of ${PAGE_SIZE})`
              : `عرض ${pageRows.length} من ${rows.length} (صفحات افتراضية ${PAGE_SIZE})`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="bg-black/30 text-mist-400">
              <tr>
                <th className="px-3 py-2 text-start">{en ? 'File' : 'الملف'}</th>
                <th className="px-3 py-2 text-start">{en ? 'Department' : 'القسم'}</th>
                <th className="px-3 py-2 text-start">{en ? 'Linked record' : 'السجل المرتبط'}</th>
                <th className="px-3 py-2 text-start">{en ? 'Extracted / applied' : 'المستخرج / المنفَّذ'}</th>
                <th className="px-3 py-2 text-start">{en ? 'Actions' : 'إجراءات'}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-mist-500">
                    {en ? 'No routed files yet.' : 'لا توجد ملفات موجّهة بعد.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id} className="border-t border-white/5 align-top">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-white">{row.fileName}</p>
                      <p className="text-xs text-mist-500" dir="ltr">
                        {row.relativePath}
                      </p>
                      {row.source === 'local_direct_db' ? (
                        <span className="mt-2 inline-flex rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold leading-snug text-emerald-200">
                          {en
                            ? '⚡ Direct DB inject (Zero-Bandwidth Local Ingest)'
                            : '⚡ محقون مباشرة عبر قاعدة البيانات (Zero-Bandwidth Local Ingest)'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-gold-200">
                        {en ? row.departmentLabelEn : row.departmentLabelAr}
                      </p>
                      <select
                        className="mt-2 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs"
                        value={row.department}
                        disabled={busy}
                        onChange={(e) =>
                          void overrideDepartment(row, e.target.value as SmartDropzoneDepartment)
                        }
                      >
                        {SMART_DROPZONE_DEPT_CARDS.map((d) => (
                          <option key={d.key} value={d.key}>
                            {en ? d.en : d.ar}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <p>{row.entityLabel || '—'}</p>
                      <p className="text-xs text-mist-500" dir="ltr">
                        {[row.brandCode, row.branchCode].filter(Boolean).join(' · ') || '—'}
                      </p>
                      {row.amountKwd != null ? (
                        <p className="text-xs text-emerald-300" dir="ltr">
                          {row.amountKwd.toFixed(3)} KWD
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <ul className="list-disc space-y-1 ps-4 text-xs text-mist-300">
                        {(en ? row.updatesEn : row.updates).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        {row.previewUrl || row.fileUrl ? (
                          <a
                            className="text-xs font-semibold text-emerald-300 underline-offset-2 hover:underline"
                            href={row.previewUrl || row.fileUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {en ? '👁️ Preview archived doc' : '👁️ معاينة الوثيقة المؤرشفة'}
                          </a>
                        ) : (
                          <span className="text-xs text-mist-500">
                            {en ? 'Metadata archived' : 'أُرشفت البيانات الوصفية'}
                          </span>
                        )}
                        <a
                          className="text-xs font-semibold text-gold-300 underline-offset-2 hover:underline"
                          href={row.href}
                        >
                          {en ? '↗️ Open department record' : '↗️ الذهاب للسجل في القسم المعني'}
                        </a>
                        <a
                          className="text-xs font-semibold text-mist-300 underline-offset-2 hover:underline"
                          href={row.archiveHref}
                        >
                          {en ? 'Central archive' : 'الأرشيف المركزي'}
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs">
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-1 disabled:opacity-40"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {en ? 'Prev' : 'السابق'}
            </button>
            <span>
              {page + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-1 disabled:opacity-40"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              {en ? 'Next' : 'التالي'}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
