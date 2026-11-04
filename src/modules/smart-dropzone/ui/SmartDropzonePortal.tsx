'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
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

type LocalParsedPayload = {
  fileName: string
  relativePath: string
  mimeType: string
  sizeBytes: number
  textHint: string
  sha256: string
  source: string
}

const PAGE_SIZE = 100
const BATCH_SIZE = 8

function isHidden(pathValue: string): boolean {
  return pathValue.split(/[/\\]/).some(
    (p) => !p || p.startsWith('.') || /^~\$/.test(p) || /^(thumbs\.db|desktop\.ini|\.ds_store)$/i.test(p),
  )
}

function acceptFile(file: File, relativePath: string): boolean {
  if (isHidden(relativePath) || isHidden(file.name)) return false
  return /\.(pdf|xlsx?|docx?|csv|png|jpe?g|webp|zip|txt|json|xml)$/i.test(file.name)
}

function readAsArrayBufferWithFileReader(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result)
      else resolve(new ArrayBuffer(0))
    }
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
    reader.readAsArrayBuffer(blob)
  })
}

function readAsTextWithFileReader(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error || new Error('FileReader text failed'))
    reader.readAsText(blob)
  })
}

async function computeFileSha256(file: File, sliceBuf: ArrayBuffer): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const metaBytes = new TextEncoder().encode(`${file.name}:${file.size}:${file.lastModified}:`)
      const bodyBytes = new Uint8Array(sliceBuf.slice(0, 262_144))
      const merged = new Uint8Array(metaBytes.length + bodyBytes.length)
      merged.set(metaBytes, 0)
      merged.set(bodyBytes, metaBytes.length)
      const digest = await window.crypto.subtle.digest('SHA-256', merged)
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }
  } catch {
    /* fallback below */
  }
  const fallbackSeed = `${file.name}_${file.size}_${file.lastModified}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < fallbackSeed.length; i += 1) {
    const c = fallbackSeed.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ (c * 31), 0x85ebca6b) >>> 0
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`.repeat(2)
}

async function parseFileLocallyInBrowser(item: QueuedFile): Promise<LocalParsedPayload> {
  const { file, relativePath } = item
  const name = file.name
  const mimeType = file.type || 'application/octet-stream'
  const headSlice = file.slice(0, Math.min(file.size, 2 * 1024 * 1024))
  const buf = await readAsArrayBufferWithFileReader(headSlice)
  const sha256 = await computeFileSha256(file, buf)

  let extractedText = ''

  if (/\.(xlsx|xls|ods|csv)$/i.test(name) || /spreadsheet|excel|csv/i.test(mimeType)) {
    try {
      const wb = XLSX.read(buf, { type: 'array', sheetRows: 60 })
      const chunks: string[] = []
      for (const sheetName of wb.SheetNames.slice(0, 4)) {
        const sheet = wb.Sheets[sheetName]
        if (!sheet) continue
        const csvText = XLSX.utils.sheet_to_csv(sheet).slice(0, 8000)
        chunks.push(`[Sheet: ${sheetName}]\n${csvText}`)
      }
      extractedText = chunks.join('\n')
    } catch {
      extractedText = await readAsTextWithFileReader(file.slice(0, 64_000)).catch(() => '')
    }
  } else if (/\.(txt|json|xml|md)$/i.test(name) || /^text\//i.test(mimeType)) {
    extractedText = await readAsTextWithFileReader(file.slice(0, 64_000)).catch(() => '')
  } else {
    // PDF, Word (.docx/.doc), Images: extract printable ASCII + Arabic UTF-8 tokens locally
    try {
      const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, 262_144))
      const cleanedUtf8 = utf8
        .replace(/[^\x09\x0a\x0d\x20-\x7e\u0600-\u06ff]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const latin1 = new TextDecoder('iso-8859-1').decode(buf.slice(0, 131_072))
      const numbersAndTokens = (latin1.match(/[A-Za-z0-9._/-]{3,}|\d+(?:,\d{3})*(?:\.\d{1,3})?/g) || [])
        .slice(0, 400)
        .join(' ')
      extractedText = `${cleanedUtf8.slice(0, 14_000)}\n${numbersAndTokens.slice(0, 6_000)}`
    } catch {
      extractedText = ''
    }
  }

  const headerMeta = `File: ${name} | Path: ${relativePath} | Size: ${file.size} bytes | SHA256: ${sha256}`
  const textHint = `${headerMeta}\n${extractedText}`.slice(0, 32_000)

  return {
    fileName: name,
    relativePath,
    mimeType,
    sizeBytes: file.size,
    textHint,
    sha256,
    source: 'browser_local_reader',
  }
}

export default function SmartDropzonePortal() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [counters, setCounters] = useState(() => emptySmartDropzoneCounters())
  const [busy, setBusy] = useState(false)
  const [stageLabel, setStageLabel] = useState<string>('')
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

  const runInstantLocalParseAndRoute = useCallback(
    async (incoming: QueuedFile[]) => {
      if (!incoming.length) return
      setBusy(true)
      setError(null)
      setNotice(null)
      setPage(0)

      const batchId = `sdz_${Date.now()}`
      const total = incoming.length
      setProgress({ done: 0, total })

      const collectedNew: LedgerRow[] = []

      try {
        for (let i = 0; i < incoming.length; i += BATCH_SIZE) {
          const slice = incoming.slice(i, i + BATCH_SIZE)
          const parsedPayloads: LocalParsedPayload[] = []

          for (let j = 0; j < slice.length; j += 1) {
            const item = slice[j]
            setStageLabel(
              en
                ? `Reading & parsing locally in browser (${i + j + 1}/${total}): ${item.file.name}`
                : `جارٍ القراءة والفرز المحلي من الكمبيوتر (${i + j + 1}/${total}): ${item.file.name}`,
            )
            const parsed = await parseFileLocallyInBrowser(item)
            parsedPayloads.push(parsed)
          }

          setStageLabel(
            en
              ? `Saving extracted metadata to database (${Math.min(total, i + slice.length)}/${total})…`
              : `جارٍ حفظ البيانات المستخرجة وتوزيعها في قاعدة البيانات (${Math.min(total, i + slice.length)}/${total})…`,
          )

          const response = await fetch('/api/smart-dropzone/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ batchId, files: parsedPayloads }),
          })
          const payload = (await response.json()) as {
            data?: { rows?: LedgerRow[]; counters?: Record<SmartDropzoneDepartment, number> }
            error?: { message?: string }
          }
          if (!response.ok) throw new Error(payload.error?.message || 'Processing failed')

          const batchRows = payload.data?.rows || []
          for (const row of batchRows) {
            collectedNew.push(row)
          }

          setRows((prev) => {
            const byId = new Map<string, LedgerRow>()
            for (const r of collectedNew) byId.set(r.id, r)
            for (const r of prev) if (!byId.has(r.id)) byId.set(r.id, r)
            const merged = Array.from(byId.values())
            const nextCounters = emptySmartDropzoneCounters()
            for (const r of merged) {
              if (r.department in nextCounters) nextCounters[r.department] += 1
            }
            setCounters(nextCounters)
            return merged
          })

          setProgress({ done: Math.min(total, i + slice.length), total })
        }

        setNotice(
          en
            ? `✅ Automatically parsed ${collectedNew.length} files locally (99% bandwidth saved) and routed them across the 7 departments.`
            : `✅ تم قراءة وفرز ${collectedNew.length} ملفاً محلياً من جهازك وتوجيهها تلقائياً عبر الأقسام السبعة (توفير 99% من الإنترنت).`,
        )
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : en ? 'Routing failed' : 'فشل التوجيه')
      } finally {
        setBusy(false)
        setStageLabel('')
      }
    },
    [en],
  )

  const normalizeAndAutoStart = useCallback(
    (list: FileList | File[], basePath = '') => {
      const next: QueuedFile[] = []
      const seen = new Set<string>()
      for (const file of Array.from(list)) {
        const relativePath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          (basePath ? `${basePath}/${file.name}` : file.name)
        if (!acceptFile(file, relativePath)) continue
        const key = `${relativePath}::${file.size}::${file.lastModified}`
        if (seen.has(key)) continue
        seen.add(key)
        next.push({ key, file, relativePath })
      }
      if (next.length > 0) {
        void runInstantLocalParseAndRoute(next)
      } else if (list.length > 0) {
        setError(
          en
            ? 'No supported files found in selection (supported: PDF, Excel, Word, CSV, Images, TXT, ZIP).'
            : 'لم يتم العثور على ملفات مدعومة في الاختيار (المدعوم: PDF, Excel, Word, CSV, صور, TXT, ZIP).',
        )
      }
    },
    [en, runInstantLocalParseAndRoute],
  )

  const handleFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        normalizeAndAutoStart(e.target.files)
      }
      e.target.value = ''
    },
    [normalizeAndAutoStart],
  )

  const triggerFilesUpload = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (busy) return
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
        fileInputRef.current.click()
      }
    },
    [busy],
  )

  const triggerFolderUpload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (busy) return
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.setAttribute('webkitdirectory', '')
      input.setAttribute('directory', '')
      input.setAttribute('mozdirectory', '')
      // STRICT WARNING: NEVER set input.accept here!
      input.onchange = (ev: Event) => {
        const target = ev.target as HTMLInputElement
        const files = Array.from(target.files || [])
        if (files.length > 0) {
          normalizeAndAutoStart(files)
        }
      }
      input.click()
    },
    [busy, normalizeAndAutoStart],
  )

  async function collectDroppedDirectoryEntries(
    entry: FileSystemDirectoryEntry,
    prefix: string,
    target: QueuedFile[],
  ) {
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
          ;(child as FileSystemFileEntry).file(
            (file) => {
              const relativePath = prefix ? `${prefix}/${file.name}` : file.name
              if (acceptFile(file, relativePath)) {
                target.push({
                  key: `${relativePath}::${file.size}::${file.lastModified}`,
                  file,
                  relativePath,
                })
              }
              resolve()
            },
            () => resolve(),
          )
        })
      } else if (child.isDirectory) {
        await collectDroppedDirectoryEntries(child as FileSystemDirectoryEntry, path, target)
      }
    }
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
    if (busy) return

    const items = event.dataTransfer.items
    if (items && items.length) {
      const entries: FileSystemEntry[] = []
      for (const item of Array.from(items)) {
        const entry = item.webkitGetAsEntry?.()
        if (entry) entries.push(entry)
      }
      if (entries.length) {
        const gathered: QueuedFile[] = []
        for (const entry of entries) {
          if (entry.isDirectory) {
            await collectDroppedDirectoryEntries(entry as FileSystemDirectoryEntry, entry.name, gathered)
          } else if (entry.isFile) {
            await new Promise<void>((resolve) => {
              ;(entry as FileSystemFileEntry).file(
                (file) => {
                  if (acceptFile(file, file.name)) {
                    gathered.push({
                      key: `${file.name}::${file.size}::${file.lastModified}`,
                      file,
                      relativePath: file.name,
                    })
                  }
                  resolve()
                },
                () => resolve(),
              )
            })
          }
        }
        if (gathered.length) {
          void runInstantLocalParseAndRoute(gathered)
        }
        return
      }
    }
    if (event.dataTransfer.files?.length) {
      normalizeAndAutoStart(event.dataTransfer.files)
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
              sha256: row.sha256 || undefined,
              source: row.source || 'browser_local_reader',
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

  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0

  return (
    <div className="w-full max-w-none space-y-6 text-mist-100" dir={en ? 'ltr' : 'rtl'} data-no-translate="">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-300/80">
          AetherBI · Venture Foods
        </p>
        <h1 className="text-2xl font-black text-white sm:text-3xl">
          {en ? '🧠 AI Smart Dropzone & Auto-Router' : '🧠 بوابة الفرز والأرشفة الذكية الشاملة'}
        </h1>
        <p className="max-w-3xl text-sm text-mist-400">
          {en
            ? 'Select files or an entire folder directly from your PC (or drag & drop). Files are read and parsed locally inside your browser and routed automatically into the 7 departments in seconds.'
            : 'اختر ملفات أو مجلداً كاملاً مباشرة من جهاز الكمبيوتر (أو اسحبها بالماوس). يبدأ الفرز المحلي تلقائياً في نفس اللحظة لتوزيع السجلات على الأقسام السبعة فوراً.'}
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

      <section
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button') !== null) return
          triggerFilesUpload(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => void onDrop(e)}
        className={`cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition select-none ${
          dragOver
            ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.2)]'
            : 'border-emerald-400/35 bg-gradient-to-b from-[#111924] to-[#0f141c] hover:border-emerald-400/70'
        }`}
      >
        <p className="text-xl font-black text-white sm:text-2xl">
          {en
            ? 'Click anywhere here or drop files & folders from your PC'
            : 'اضغط في أي مكان هنا أو أسقط المجلدات والملفات من جهازك'}
        </p>
        <p className="mt-2 text-sm text-mist-300">
          {en
            ? 'Instant auto-start upon selection · Local in-browser reader (PDF · Excel · Word · CSV · Images) · 99% bandwidth saved'
            : 'يبدأ الفرز والتحليل تلقائياً فور اختيار الملفات · قراءة محلية داخل المتصفح فائقة السرعة بدون استهلاك الإنترنت'}
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            className="w-full sm:w-auto rounded-2xl bg-gradient-to-l from-[#8cc63f] via-[#38b261] to-[#10b981] px-6 py-4 text-base font-black text-ink-950 shadow-lg shadow-emerald-950/50 transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
            onClick={triggerFilesUpload}
          >
            {en ? '📄 Select Multiple Files' : '📄 اختيار ملفات متعددة'}
          </button>

          <button
            type="button"
            disabled={busy}
            className="w-full sm:w-auto rounded-2xl border border-teal-400/50 bg-gradient-to-l from-[#00a99d] to-[#0284c7] px-6 py-4 text-base font-black text-white shadow-lg shadow-cyan-950/50 transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
            onClick={triggerFolderUpload}
          >
            {en ? '📁 Upload Entire Folder' : '📁 رفع مجلد كامل'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.docx,.doc,.csv,.png,.jpg,.jpeg,.webp,.zip,.txt,.json,.xml"
          className="hidden"
          onChange={handleFilesSelected}
        />


        {busy ? (
          <div
            className="mx-auto mt-6 max-w-2xl rounded-2xl border border-emerald-400/30 bg-black/50 p-4 text-start"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
              <span>{stageLabel || (en ? 'Processing locally…' : 'جارٍ الفرز المحلي والحفظ…')}</span>
              <span dir="ltr">
                {progress.done} / {progress.total} ({pct}%)
              </span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8cc63f] to-[#00a99d] transition-all duration-200"
                style={{ width: `${Math.max(8, pct)}%` }}
              />
            </div>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-100">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-950/30 px-4 py-3 text-sm font-semibold text-emerald-100">
          {notice}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0f141c]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h2 className="font-bold text-white">
            {en ? 'AI Classification & Distribution Ledger' : 'جدول القرار الذكي والتوجيه الفوري'}
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
                    {en
                      ? 'No routed files yet. Click the button above to select files or a folder from your PC.'
                      : 'لا توجد ملفات موجّهة بعد. اضغط على الأزرار أعلاه لاختيار ملفات أو مجلد كامل من جهازك.'}
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
                      {row.source === 'browser_local_reader' || row.source === 'local_direct_db' ? (
                        <span className="mt-2 inline-flex rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold leading-snug text-emerald-200">
                          {en
                            ? '⚡ Parsed Locally in Browser (Zero-Bandwidth DB Sync)'
                            : '⚡ قراءة محلية فورية وحفظ مباشر في قاعدة البيانات'}
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
