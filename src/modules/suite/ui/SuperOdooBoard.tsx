'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { SuiteApp, SuiteBoard, SuiteRecord } from '@/modules/suite/client'

type View = 'kanban' | 'list' | 'gantt'
type FacetKey = 'department' | 'location' | 'brand'

export default function SuperOdooBoard({ app, title, canManage }: { app: SuiteApp; title: MessageKey; canManage: boolean }) {
  const { t } = useI18n()
  const [board, setBoard] = useState<SuiteBoard | null>(null)
  const [view, setView] = useState<View>('kanban')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [facet, setFacet] = useState<{ kind: FacetKey; value: string } | null>(null)
  const [titleValue, setTitleValue] = useState('')
  const [stage, setStage] = useState('')
  const [brand, setBrand] = useState('')
  const [branch, setBranch] = useState('')
  const [department, setDepartment] = useState('')
  const [assignee, setAssignee] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    apiRequest<{ data: SuiteBoard }>(`/api/v1/suite/${app}`, { signal: controller.signal })
      .then((page) => {
        setBoard(page.data)
        setStage(page.data.stages[0] ?? 'new')
        setPhase('ready')
      })
      .catch((caught) => {
        if (controller.signal.aborted) return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [app])

  function reload() {
    setPhase('loading')
    apiRequest<{ data: SuiteBoard }>(`/api/v1/suite/${app}`)
      .then((page) => {
        setBoard(page.data)
        setStage(page.data.stages[0] ?? 'new')
        setPhase('ready')
      })
      .catch((caught) => {
        setError(errorKey(caught))
        setPhase('error')
      })
  }

  const rows = useMemo(() => {
    if (!board) return []
    if (!facet) return board.records
    return board.records.filter((row) => {
      if (facet.kind === 'department') return row.department === facet.value
      if (facet.kind === 'location') return row.branchName === facet.value
      return row.brandName === facet.value
    })
  }, [board, facet])

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!board) return
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/suite/${app}`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: {
          title: titleValue,
          stage,
          brandName: brand,
          branchName: branch,
          department,
          assignee,
          amountMinor: 0,
          startsOn: new Date().toISOString().slice(0, 10),
          endsOn: null,
        },
      })
      setOpenCreate(false)
      setTitleValue('')
      setNotice(t('suite.saved'))
      reload()
    } catch (caught) {
      setError(errorKey(caught))
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  async function move(row: SuiteRecord, nextStage: string) {
    setBusy(true)
    try {
      await apiRequest(`/api/v1/suite/${app}/${row.id}`, {
        method: 'PATCH',
        body: {
          version: row.version,
          title: row.title,
          stage: nextStage,
          brandName: row.brandName,
          branchName: row.branchName,
          department: row.department,
          assignee: row.assignee,
          amountMinor: row.amountMinor,
          startsOn: row.startsOn,
          endsOn: row.endsOn,
        },
      })
      setNotice(t('suite.saved'))
      reload()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') return <p className="text-sm text-gray-400">{t('suite.loading')}</p>
  if (phase === 'error' || !board) return <p className={errorClass} role="alert">{t(error)}</p>

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{t(title)}</h2>
        <div className="flex flex-wrap gap-2">
          {(['kanban', 'list', 'gantt'] as const).map((item) => (
            <button key={item} type="button" className={view === item ? primaryButton : secondaryButton} onClick={() => setView(item)}>
              {t(`suite.view.${item}` as MessageKey)}
            </button>
          ))}
          {canManage ? (
            <button type="button" className={primaryButton} onClick={() => setOpenCreate(true)} disabled={busy}>
              {t('suite.create')}
            </button>
          ) : null}
        </div>
      </header>
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className={`${panelClass} space-y-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('suite.filters')}</p>
          <button type="button" className={!facet ? primaryButton : secondaryButton} onClick={() => setFacet(null)}>
            {t('suite.all')} ({board.records.length})
          </button>
          {(
            [
              ['department', board.facets.department, 'suite.facet.department'],
              ['location', board.facets.location, 'suite.facet.location'],
              ['brand', board.facets.brand, 'suite.facet.brand'],
            ] as const
          ).map(([kind, items, label]) => (
            <div key={kind} className="space-y-1">
              <p className="text-xs text-gray-400">{t(label)}</p>
              {items.map((item) => (
                <button
                  key={`${kind}-${item.key}`}
                  type="button"
                  className={`block w-full rounded-lg px-2 py-1 text-start text-sm ${
                    facet?.kind === kind && facet.value === item.key ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:bg-white/5'
                  }`}
                  onClick={() => setFacet({ kind, value: item.key })}
                >
                  {item.label} <span className="text-gray-500">({item.count})</span>
                </button>
              ))}
            </div>
          ))}
        </aside>
        <div className={panelClass}>
          {rows.length === 0 ? <p className="text-sm text-gray-400">{t('suite.empty')}</p> : null}
          {view === 'kanban' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {board.stages.map((column) => (
                <div key={column} className="rounded-xl border border-[#30363d] bg-black/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-400">
                    {column} ({rows.filter((row) => row.stage === column).length})
                  </p>
                  <div className="space-y-2">
                    {rows
                      .filter((row) => row.stage === column)
                      .map((row) => (
                        <article key={row.id} className="rounded-lg border border-[#30363d] bg-[#161b22] p-3 text-sm text-gray-100">
                          <p className="font-semibold">{row.title}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {row.brandName || '—'} · {row.branchName || '—'}
                          </p>
                          {row.amountMinor > 0 ? <p className="mt-1 text-xs text-gold-300">{formatMinor(row.amountMinor)} د.ك</p> : null}
                          {canManage && board.stages.length > 1 ? (
                            <select
                              className={`${inputClass} mt-2`}
                              value={row.stage}
                              disabled={busy}
                              onChange={(event) => void move(row, event.target.value)}
                            >
                              {board.stages.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </article>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {view === 'list' ? (
            <table className="w-full text-sm">
              <thead className="text-gray-400">
                <tr>
                  <th className="px-2 py-2 text-start">{t('suite.title')}</th>
                  <th className="px-2 py-2 text-start">{t('suite.facet.stage')}</th>
                  <th className="px-2 py-2 text-start">{t('suite.facet.brand')}</th>
                  <th className="px-2 py-2 text-start">{t('suite.facet.location')}</th>
                  <th className="px-2 py-2 text-start">{t('suite.assignee')}</th>
                  <th className="px-2 py-2 text-start">{t('suite.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#30363d]">
                    <td className="px-2 py-2">{row.title}</td>
                    <td className="px-2 py-2">{row.stage}</td>
                    <td className="px-2 py-2">{row.brandName || '—'}</td>
                    <td className="px-2 py-2">{row.branchName || '—'}</td>
                    <td className="px-2 py-2">{row.assignee || '—'}</td>
                    <td className="px-2 py-2">{row.amountMinor > 0 ? `${formatMinor(row.amountMinor)} د.ك` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {view === 'gantt' ? (
            <div className="space-y-2">
              {rows.map((row) => {
                const start = row.startsOn ? Date.parse(row.startsOn) : Date.now()
                const end = row.endsOn ? Date.parse(row.endsOn) : start + 7 * 86400000
                const span = Math.max(1, Math.round((end - start) / 86400000))
                const offset = Math.max(0, Math.round((start - Date.now()) / 86400000) + 14)
                return (
                  <div key={row.id} className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-3 text-sm">
                    <p className="truncate text-gray-200">{row.title}</p>
                    <div className="relative h-8 rounded bg-[#0d1117]">
                      <div
                        className="absolute top-1 h-6 rounded bg-blue-500/70"
                        style={{ insetInlineStart: `${Math.min(80, offset * 3)}%`, width: `${Math.min(40, span * 3 + 8)}%` }}
                        title={`${row.startsOn ?? '—'} → ${row.endsOn ?? '—'}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
      {openCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form className={`${panelClass} w-full max-w-lg space-y-3`} onSubmit={create}>
            <h3 className="text-base font-semibold text-white">{t('suite.create')}</h3>
            <label className={labelClass}>
              {t('suite.title')}
              <input className={inputClass} required value={titleValue} onChange={(event) => setTitleValue(event.target.value)} />
            </label>
            <label className={labelClass}>
              {t('suite.facet.stage')}
              <select className={inputClass} value={stage} onChange={(event) => setStage(event.target.value)}>
                {board.stages.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {t('suite.facet.brand')}
              <input className={inputClass} value={brand} onChange={(event) => setBrand(event.target.value)} />
            </label>
            <label className={labelClass}>
              {t('suite.facet.location')}
              <input className={inputClass} value={branch} onChange={(event) => setBranch(event.target.value)} />
            </label>
            <label className={labelClass}>
              {t('suite.facet.department')}
              <input className={inputClass} value={department} onChange={(event) => setDepartment(event.target.value)} />
            </label>
            <label className={labelClass}>
              {t('suite.assignee')}
              <input className={inputClass} value={assignee} onChange={(event) => setAssignee(event.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButton} onClick={() => setOpenCreate(false)}>
                {t('admin.cancel')}
              </button>
              <button type="submit" className={primaryButton} disabled={busy}>
                {t('suite.save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}
