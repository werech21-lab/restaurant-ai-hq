'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
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

const CHUNK = 8
const MAX_INLINE = 350_000

function fileToBase64(file: File): Promise<string> {
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

async function expandZip(file: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const out: File[] = []
  const entries = Object.values(zip.files)
  for (const entry of entries) {
    if (entry.dir) continue
    const blob = await entry.async('blob')
    const name = entry.name.split('/').pop() || entry.name
    out.push(new File([blob], name, { type: blob.type || 'application/octet-stream' }))
    Object.defineProperty(out[out.length - 1], 'webkitRelativePath', {
      value: entry.name,
      configurable: true,
    })
  }
  return out
}

export function SmartFolderUploadClient({ employees: initialEmployees, locale }: Props) {
  const { t, dir } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [employees, setEmployees] = useState(initialEmployees)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [batchId, setBatchId] = useState<string | null>(null)
  const [rows, setRows] = useState<ResultRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reviewRows = useMemo(() => rows.filter((r) => r.status === 'REVIEW'), [rows])
  const matchedRows = useMemo(() => rows.filter((r) => r.status !== 'REVIEW'), [rows])

  const label = useCallback(
    (ar: string, en: string) => (locale === 'en' ? en : ar),
    [locale],
  )

  async function refreshEmployees() {
    const res = await fetch('/api/hr/ingest-folder', { credentials: 'same-origin' })
    if (!res.ok) return
    const json = (await res.json()) as { data?: { employees?: Emp[] } }
    if (json.data?.employees) setEmployees(json.data.employees)
  }

  async function processFiles(fileList: File[]) {
    if (fileList.length === 0) return
    setBusy(true)
    setError(null)
    setNotice(null)
    setRows([])
    const expanded: File[] = []
    for (const file of fileList) {
      if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
        try {
          expanded.push(...(await expandZip(file)))
        } catch {
          expanded.push(file)
        }
      } else {
        expanded.push(file)
      }
    }
    const batch = `batch_${Date.now().toString(36)}`
    setBatchId(batch)
    setProgress({ done: 0, total: expanded.length })
    const collected: ResultRow[] = []
    try {
      for (let i = 0; i < expanded.length; i += CHUNK) {
        const slice = expanded.slice(i, i + CHUNK)
        const payloadFiles = []
        for (const file of slice) {
          const relativePath =
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
          const sizeBytes = file.size
          let contentBase64: string | undefined
          let textHint: string | undefined
          if (sizeBytes <= MAX_INLINE) {
            contentBase64 = await fileToBase64(file)
          } else if (/\.(txt|csv|json|md)$/i.test(file.name)) {
            textHint = (await file.text()).slice(0, 15000)
          } else {
            // metadata-only for oversized binaries
            textHint = `${relativePath} ${file.name}`
          }
          payloadFiles.push({
            relativePath,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes,
            contentBase64,
            textHint,
          })
        }
        const res = await fetch('/api/hr/ingest-folder', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId: batch, files: payloadFiles }),
        })
        const json = (await res.json()) as { data?: { rows?: ResultRow[] }; error?: { message?: string } }
        if (!res.ok) throw new Error(json.error?.message || 'ingest_failed')
        collected.push(...(json.data?.rows || []))
        setRows([...collected])
        setProgress({ done: Math.min(expanded.length, i + slice.length), total: expanded.length })
      }
      setNotice(
        label(
          `اكتمل التوزيع: ${collected.length} ملف · مطابق ${collected.filter((r) => r.status !== 'REVIEW').length} · مراجعة ${collected.filter((r) => r.status === 'REVIEW').length}`,
          `Distribution done: ${collected.length} files · matched ${collected.filter((r) => r.status !== 'REVIEW').length} · review ${collected.filter((r) => r.status === 'REVIEW').length}`,
        ),
      )
      await refreshEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const list = event.target.files ? Array.from(event.target.files) : []
    void processFiles(list)
    event.target.value = ''
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault()
    setDragging(false)
    const items = Array.from(event.dataTransfer.files || [])
    void processFiles(items)
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
    if (json.data) {
      setRows((prev) => prev.map((row) => (row.id === documentId ? json.data! : row)))
    }
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
          dragging ? 'border-emerald-500 bg-emerald-50' : 'border-emerald-300 bg-white'
        }`}
      >
        <p className="text-lg font-bold text-emerald-900">
          {label('اسحب وأفلت مجلد الموظفين أو ZIP / Excel / PDF / صور هنا', 'Drag & drop HR folder, ZIP, Excel, PDF, or images')}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {label(
            'المعالجة على دفعات تلقائية — يدعم المجلدات الفرعية عبر webkitdirectory',
            'Chunked batch processing — full subfolders via webkitdirectory',
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
            className="rounded-xl border border-emerald-600 px-5 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
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
          onChange={onInputChange}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.json,.zip,.txt"
          {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      </div>

      {busy || progress.total > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-800">
              {label('التقدم اللحظي', 'Live progress')}
              {batchId ? ` · ${batchId}` : ''}
            </span>
            <span dir="ltr">
              {progress.done}/{progress.total} ({pct}%)
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      {matchedRows.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-900">{label('جدول التوزيع التلقائي', 'Auto-distribution table')}</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 text-start">{label('الملف', 'File')}</th>
                  <th className="px-3 py-2 text-start">{label('الموظف', 'Employee')}</th>
                  <th className="px-3 py-2 text-start">{label('القسم', 'Category')}</th>
                  <th className="px-3 py-2 text-start">{label('التحديثات', 'Updates')}</th>
                  <th className="px-3 py-2 text-start">{label('الحالة', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {matchedRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{row.fileName}</p>
                      <p className="text-xs text-slate-500" dir="ltr">
                        {row.relativePath}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      {row.employeeName ? (
                        <span>
                          {row.employeeName}
                          <span className="mt-0.5 block text-xs text-slate-500" dir="ltr">
                            {row.employeeCode}
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">{locale === 'en' ? row.categoryLabelEn : row.categoryLabelAr}</td>
                    <td className="px-3 py-2 text-xs text-slate-600" dir="ltr">
                      {row.updates.join(', ') || '—'}
                      {row.expiryDate ? ` · exp ${row.expiryDate}` : ''}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {reviewRows.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/40">
          <header className="border-b border-amber-200 px-4 py-3">
            <h2 className="font-semibold text-amber-950">
              {label('ملفات تحتاج لتأكيدك السريع (Unmatched / Review Queue)', 'Files needing quick confirmation (Review Queue)')}
            </h2>
          </header>
          <ul className="divide-y divide-amber-100">
            {reviewRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-[200px] flex-1">
                  <p className="font-medium text-slate-900">{row.fileName}</p>
                  <p className="text-xs text-slate-500" dir="ltr">
                    {row.relativePath}
                  </p>
                  <p className="text-xs text-amber-800">{locale === 'en' ? row.categoryLabelEn : row.categoryLabelAr}</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  {label('تعيين للموظف', 'Assign employee')}
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) void assign(row.id, e.target.value)
                    }}
                  >
                    <option value="">{label('اختر…', 'Select…')}</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.code})
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-slate-500">
        {t('nav.hr')} · {label('الخزائن الرقمية تظهر داخل بطاقة كل موظف بعد الربط', 'Digital dossiers appear on each employee card after matching')}
      </p>
    </div>
  )
}
