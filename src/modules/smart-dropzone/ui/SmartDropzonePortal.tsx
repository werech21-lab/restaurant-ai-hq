'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { FolderUp, FileUp, Sparkles } from 'lucide-react'
import { SectionCard, StateBlock } from '@/components/ui'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'
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
  const fmtLocale = locale === 'en' ? 'en' : 'ar'
  const en = fmtLocale === 'en'
  const unavailableTip = getUnavailableTooltip(fmtLocale)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<LedgerRow[]>([])
  const [counters, setCounters] = useState(() => emptySmartDropzoneCounters())
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [stageLabel, setStageLabel] = useState<string>('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [page, setPage] = useState(0)
  const [errorCode, setErrorCode] = useState<'none' | 'unsupported' | 'routing_failed' | 'override_failed'>('none')
  const [noticeCount, setNoticeCount] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, page])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  useEffect(() => {
    const controller = new AbortController()
    setInitialLoading(true)
    setLoadFailed(false)
    void fetch('/api/smart-dropzone/list?limit=300', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status !== 401 && response.status !== 403) {
            setLoadFailed(true)
          }
          return
        }
        const payload = (await response.json()) as { data?: { rows?: LedgerRow[] } }
        const existing = payload.data?.rows || []
        setRows(existing)
        const next = emptySmartDropzoneCounters()
        for (const row of existing) {
          if (row.department in next) next[row.department] += 1
        }
        setCounters(next)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setLoadFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setInitialLoading(false)
        }
      })
    return () => controller.abort()
  }, [reloadCount])

  const runInstantLocalParseAndRoute = useCallback(
    async (incoming: QueuedFile[]) => {
      if (!incoming.length) return
      setBusy(true)
      setErrorCode('none')
      setNoticeCount(null)
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
                ? `Reading & parsing locally in browser (${formatInt(i + j + 1, 'en')}/${formatInt(total, 'en')}): ${item.file.name}`
                : `جارٍ القراءة والفرز المحلي من الجهاز (${formatInt(i + j + 1, 'ar')}/${formatInt(total, 'ar')}): ${item.file.name}`,
            )
            const parsed = await parseFileLocallyInBrowser(item)
            parsedPayloads.push(parsed)
          }

          setStageLabel(
            en
              ? `Saving extracted metadata to database (${formatInt(Math.min(total, i + slice.length), 'en')}/${formatInt(total, 'en')})…`
              : `جارٍ حفظ البيانات المستخرجة وتوزيعها في قاعدة البيانات (${formatInt(Math.min(total, i + slice.length), 'ar')}/${formatInt(total, 'ar')})…`,
          )

          const response = await fetch('/api/smart-dropzone/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ batchId, files: parsedPayloads }),
          })
          const payload = (await response.json()) as {
            data?: { rows?: LedgerRow[]; counters?: Record<SmartDropzoneDepartment, number> }
          }
          if (!response.ok) {
            throw new Error('process_failed')
          }

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

        setNoticeCount(collectedNew.length)
      } catch {
        setErrorCode('routing_failed')
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
        setErrorCode('unsupported')
      }
    },
    [runInstantLocalParseAndRoute],
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
      const childPath = prefix ? `${prefix}/${child.name}` : child.name
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
        await collectDroppedDirectoryEntries(child as FileSystemDirectoryEntry, childPath, target)
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
    setErrorCode('none')
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
      if (!response.ok) {
        setErrorCode('override_failed')
        return
      }
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
    } catch {
      setErrorCode('override_failed')
    } finally {
      setBusy(false)
    }
  }

  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0

  const errorCopy =
    errorCode === 'unsupported'
      ? {
          title: en ? 'No supported files found in selection' : 'لم يتم العثور على ملفات مدعومة',
          description: en
            ? 'Supported formats: PDF, Excel, Word, CSV, Images, TXT, ZIP.'
            : 'الصيغ المدعومة: PDF، Excel، Word، CSV، الصور، TXT، ZIP.',
        }
      : errorCode === 'override_failed'
        ? {
            title: en ? 'Could not update department assignment' : 'تعذّر تحديث القسم المختار',
            description: en
              ? 'Please retry selecting the target department.'
              : 'يرجى إعادة المحاولة لاختيار القسم المطلوب.',
          }
        : {
            title: en ? 'Unable to process selected files' : 'تعذّر فرز الملفات المختارة حالياً',
            description: en
              ? 'A temporary issue occurred while routing files. Please try again.'
              : 'حدث خلل مؤقت أثناء توجيه الملفات. يرجى المحاولة مجدداً.',
          }

  return (
    <div
      className="w-full max-w-none min-w-0 space-y-6 text-slate-900 dark:text-slate-100"
      dir={en ? 'ltr' : 'rtl'}
      data-no-translate=""
    >
      <header className="space-y-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          <span>{en ? 'Venture Foods · Smart Classification' : 'فنتشر فودز · التصنيف الذكي'}</span>
        </p>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {en ? 'AI Smart Dropzone & Auto-Router' : 'بوابة الفرز والأرشفة الذكية الشاملة'}
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {en
            ? 'Select files or an entire folder directly from your PC (or drag & drop). Files are read and parsed locally inside your browser and routed automatically into the 7 departments.'
            : 'اختر ملفات أو مجلداً كاملاً مباشرة من جهازك (أو اسحبها بالماوس). يبدأ الفرز المحلي داخل المتصفح تلقائياً لتوزيع السجلات على الأقسام السبعة.'}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {SMART_DROPZONE_DEPT_CARDS.map((card) => (
          <article
            key={card.key}
            className="ds-surface min-w-0 rounded-2xl p-3.5 sm:p-4"
          >
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {card.icon} {en ? card.en : card.ar}
            </p>
            <p
              dir="ltr"
              className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400"
            >
              {formatInt(counters[card.key], fmtLocale)}
            </p>
          </article>
        ))}
      </div>

      <section
        tabIndex={-1}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => void onDrop(e)}
        className={`rounded-3xl border-2 border-dashed p-6 sm:p-8 text-center transition select-none ${
          dragOver
            ? 'border-emerald-500 bg-emerald-50/90 shadow-lg dark:border-emerald-400 dark:bg-emerald-500/10'
            : 'border-emerald-500/40 bg-white hover:border-emerald-500/75 dark:border-emerald-400/35 dark:bg-[#101C17] dark:hover:border-emerald-400/70'
        }`}
      >
        <p className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white">
          {en
            ? 'Drop files & folders from your PC or select below'
            : 'أسقط المجلدات والملفات من جهازك أو اخترها أدناه'}
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {en
            ? 'Instant local parsing in browser (PDF · Excel · Word · CSV · Images)'
            : 'قراءة وفرز محلي فوري داخل المتصفح (PDF · Excel · Word · CSV · صور)'}
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            className="inline-flex min-h-11 w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
            onClick={triggerFilesUpload}
          >
            <FileUp className="h-4 w-4 shrink-0" aria-hidden />
            <span>{en ? 'Select Multiple Files' : 'اختيار ملفات متعددة'}</span>
          </button>

          <button
            type="button"
            disabled={busy}
            className="inline-flex min-h-11 w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-600/30 bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50 dark:border-emerald-400/35 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:bg-emerald-900/60"
            onClick={triggerFolderUpload}
          >
            <FolderUp className="h-4 w-4 shrink-0" aria-hidden />
            <span>{en ? 'Upload Entire Folder' : 'رفع مجلد كامل'}</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          aria-label={en ? 'Select multiple files for routing' : 'اختيار ملفات متعددة للفرز'}
          accept=".pdf,.xlsx,.xls,.docx,.doc,.csv,.png,.jpg,.jpeg,.webp,.zip,.txt,.json,.xml"
          className="sr-only"
          onChange={handleFilesSelected}
        />

        {busy ? (
          <div
            className="mx-auto mt-6 max-w-2xl rounded-2xl border border-emerald-500/30 bg-emerald-50/80 p-4 text-start dark:border-emerald-400/30 dark:bg-[#0B1410]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <span>{stageLabel || (en ? 'Processing locally…' : 'جارٍ الفرز المحلي والحفظ…')}</span>
              <span dir="ltr" className="tabular-nums">
                {formatInt(progress.done, fmtLocale)} / {formatInt(progress.total, fmtLocale)} ({formatPct(pct, { locale: fmtLocale, decimals: 0 })})
              </span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-200 dark:bg-emerald-400"
                style={{ width: `${Math.max(8, pct)}%` }}
              />
            </div>
          </div>
        ) : null}
      </section>

      {errorCode !== 'none' ? (
        <StateBlock
          state="error"
          compact
          locale={fmtLocale}
          title={errorCopy.title}
          description={errorCopy.description}
        />
      ) : null}

      {noticeCount !== null ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          {en
            ? `Parsed ${formatInt(noticeCount, 'en')} files locally and routed them across the 7 departments.`
            : `تم قراءة وفرز ${formatInt(noticeCount, 'ar')} ملفاً محلياً وتوجيهها تلقائياً عبر الأقسام السبعة.`}
        </div>
      ) : null}

      <SectionCard
        locale={fmtLocale}
        title={en ? 'AI Classification & Distribution Ledger' : 'جدول القرار الذكي والتوجيه الفوري'}
        subtitle={
          en
            ? `Showing ${formatInt(pageRows.length, 'en')} of ${formatInt(rows.length, 'en')} (pages of ${formatInt(PAGE_SIZE, 'en')})`
            : `عرض ${formatInt(pageRows.length, 'ar')} من ${formatInt(rows.length, 'ar')} (صفحات من ${formatInt(PAGE_SIZE, 'ar')})`
        }
        state={initialLoading ? 'loading' : loadFailed ? 'error' : rows.length === 0 ? 'empty' : 'ready'}
        stateTitle={
          loadFailed
            ? en
              ? 'Unable to load routed documents'
              : 'تعذّر تحميل سجل الملفات الموجّهة'
            : en
              ? 'No routed files yet'
              : 'لا توجد ملفات موجّهة بعد'
        }
        stateDescription={
          loadFailed
            ? en
              ? 'A temporary issue occurred while fetching the ledger. Please try again.'
              : 'حدث خلل مؤقت أثناء تحميل السجل. يرجى المحاولة مجدداً.'
            : en
              ? 'Select files or a folder above to classify and route documents into their target departments.'
              : 'اختر ملفات أو مجلداً كاملاً أعلاه لفرز الوثائق وتوجيهها تلقائياً إلى الأقسام المعنية.'
        }
        onRetry={loadFailed ? () => setReloadCount((c) => c + 1) : undefined}
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-[#0B1410] dark:text-slate-300">
              <tr className="border-b border-slate-200 dark:border-emerald-500/15">
                <th className="px-4 py-3 text-start font-bold">{en ? 'File' : 'الملف'}</th>
                <th className="px-4 py-3 text-start font-bold">{en ? 'Department' : 'القسم'}</th>
                <th className="px-4 py-3 text-start font-bold">{en ? 'Linked record' : 'السجل المرتبط'}</th>
                <th className="px-4 py-3 text-start font-bold">{en ? 'Extracted / applied' : 'المستخرج / المنفَّذ'}</th>
                <th className="px-4 py-3 text-start font-bold">{en ? 'Actions' : 'إجراءات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {pageRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-emerald-50/40 dark:hover:bg-emerald-500/[0.04]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-white">{row.fileName}</p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300" dir="ltr">
                      {row.relativePath}
                    </p>
                    {row.createdAt ? (
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">
                        {formatDateTime(row.createdAt, { locale: fmtLocale })}
                      </p>
                    ) : null}
                    {row.source === 'browser_local_reader' || row.source === 'local_direct_db' ? (
                      <span className="mt-2 inline-flex rounded-lg border border-emerald-500/30 bg-emerald-50 px-2 py-1 text-xs font-bold leading-snug text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-950/60 dark:text-emerald-200">
                        {en
                          ? 'Parsed Locally in Browser'
                          : 'قراءة محلية فورية وحفظ مباشر'}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                      {en ? row.departmentLabelEn : row.departmentLabelAr}
                    </p>
                    <select
                      aria-label={
                        en
                          ? `Department for ${row.fileName}`
                          : `القسم للملف ${row.fileName}`
                      }
                      className="mt-2 min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-emerald-500/25 dark:bg-[#0B1410] dark:text-slate-100"
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
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {row.entityLabel || UNAVAILABLE_DASH}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300" dir="ltr">
                      {[row.brandCode, row.branchCode].filter(Boolean).join(' · ') || UNAVAILABLE_DASH}
                    </p>
                    {row.amountKwd != null ? (
                      <p
                        dir="ltr"
                        className="mt-1 text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-300"
                      >
                        {formatKwd(row.amountKwd, fmtLocale)}
                      </p>
                    ) : (
                      <p
                        dir="ltr"
                        title={unavailableTip}
                        className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400"
                      >
                        {UNAVAILABLE_DASH}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="list-disc space-y-1 ps-4 text-xs text-slate-700 dark:text-slate-200">
                      {(en ? row.updatesEn : row.updates).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      {row.previewUrl || row.fileUrl ? (
                        <a
                          className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-emerald-300"
                          href={row.previewUrl || row.fileUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {en ? 'Preview archived doc' : 'معاينة الوثيقة المؤرشفة'}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {en ? 'Metadata archived' : 'أُرشفت البيانات الوصفية'}
                        </span>
                      )}
                      <a
                        className="text-xs font-semibold text-sky-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-sky-300"
                        href={row.href}
                      >
                        {en ? 'Open department record' : 'الذهاب للسجل في القسم المعني'}
                      </a>
                      <a
                        className="text-xs font-semibold text-slate-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-slate-300"
                        href={row.archiveHref}
                      >
                        {en ? 'Central archive' : 'الأرشيف المركزي'}
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs dark:border-emerald-500/15">
            <button
              type="button"
              className="min-h-10 rounded-lg border border-slate-300 px-3.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 dark:border-emerald-500/20 dark:text-slate-200 dark:hover:bg-white/[0.06]"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {en ? 'Prev' : 'السابق'}
            </button>
            <span dir="ltr" className="tabular-nums font-semibold">
              {formatInt(page + 1, fmtLocale)} / {formatInt(pageCount, fmtLocale)}
            </span>
            <button
              type="button"
              className="min-h-10 rounded-lg border border-slate-300 px-3.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 dark:border-emerald-500/20 dark:text-slate-200 dark:hover:bg-white/[0.06]"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              {en ? 'Next' : 'التالي'}
            </button>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}
