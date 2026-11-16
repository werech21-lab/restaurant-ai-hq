'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { SuiteApp, SuiteBoard, SuiteRecord } from '@/modules/suite/client'
import {
  SuiteModal,
  SuiteMoney,
  SuiteUnavailableDash,
  kuwaitTodayMidnightMs,
  parseKuwaitDateMs,
  suiteErrorClass,
  suiteInputClass,
  suiteLabelClass,
  suiteNoticeClass,
  suitePanelClass,
  suitePrimaryBtn,
  suiteSecondaryBtn,
} from '@/modules/suite/ui/shared'

type View = 'kanban' | 'list' | 'gantt'
type FacetKey = 'department' | 'location' | 'brand'

function boardUrl(
  app: SuiteApp,
  page: number,
  facet: { kind: FacetKey; value: string } | null,
) {
  const params = new URLSearchParams({ page: String(page) })
  if (facet) {
    params.set('facetKind', facet.kind)
    params.set('facetValue', facet.value)
  }
  return `/api/v1/suite/${app}?${params.toString()}`
}

export default function SuperOdooBoard({
  app,
  title,
  canManage,
}: {
  app: SuiteApp
  title: MessageKey
  canManage: boolean
}) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const [board, setBoard] = useState<SuiteBoard | null>(null)
  const [view, setView] = useState<View>('kanban')
  const [page, setPage] = useState(1)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [actionError, setActionError] = useState<MessageKey | null>(null)
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
  const [reloadTick, setReloadTick] = useState(0)

  const reload = useCallback(() => {
    setReloadTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    apiRequest<{ data: SuiteBoard }>(boardUrl(app, page, facet), { signal: controller.signal })
      .then((payload) => {
        setBoard(payload.data)
        setStage(payload.data.stages[0] ?? 'new')
        setActionError(null)
        setPhase('ready')
      })
      .catch((caught) => {
        if (controller.signal.aborted) return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [app, page, facet, reloadTick])

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!board) return
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      await apiRequest(`/api/v1/suite/${app}`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: {
          title: titleValue.trim(),
          stage,
          brandName: brand.trim(),
          branchName: branch.trim(),
          department: department.trim(),
          assignee: assignee.trim(),
          amountMinor: 0,
        },
      })
      setOpenCreate(false)
      setTitleValue('')
      setNotice(t('suite.saved'))
      reload()
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function move(row: SuiteRecord, nextStage: string) {
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      await apiRequest(`/api/v1/suite/${app}/${row.id}`, {
        method: 'PATCH',
        idempotencyKey: newIdempotencyKey(),
        body: {
          title: row.title,
          stage: nextStage,
          brandName: row.brandName,
          branchName: row.branchName,
          department: row.department,
          assignee: row.assignee,
          amountMinor: row.amountMinor,
          startsOn: row.startsOn,
          endsOn: row.endsOn,
          version: row.version,
        },
      })
      setNotice(t('suite.saved'))
      reload()
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading' && !board) {
    return (
      <SectionCard title={t(title)} locale={fmtLocale}>
        <StateBlock state="loading" locale={fmtLocale} title={t('suite.loading')} skeletonRows={4} />
      </SectionCard>
    )
  }

  if (phase === 'error' && !board) {
    const forbidden = error === 'erp.err.forbidden'
    return (
      <SectionCard title={t(title)} locale={fmtLocale}>
        <StateBlock
          state={forbidden ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(error)}
          onRetry={forbidden ? undefined : reload}
        />
      </SectionCard>
    )
  }

  if (!board) return null

  const rows = board.records
  const totalPages = Math.max(1, Math.ceil(board.total / Math.max(1, board.pageSize)))
  const todayMs = kuwaitTodayMidnightMs()

  return (
    <SectionCard
      title={t(title)}
      subtitle={
        <span dir="ltr" className="ds-num tabular-nums">
          {formatInt(board.total, fmtLocale)} · {formatInt(board.page, fmtLocale)}/
          {formatInt(totalPages, fmtLocale)}
        </span>
      }
      locale={fmtLocale}
      actions={
        <div className="flex flex-wrap gap-2">
          {(['kanban', 'list', 'gantt'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={view === item ? suitePrimaryBtn : suiteSecondaryBtn}
              onClick={() => setView(item)}
            >
              {t(`suite.view.${item}` as MessageKey)}
            </button>
          ))}
          {canManage ? (
            <button
              type="button"
              className={suitePrimaryBtn}
              onClick={() => setOpenCreate(true)}
            >
              {t('suite.create')}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {notice ? (
          <p role="status" className={suiteNoticeClass}>
            {notice}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className={suiteErrorClass}>
            {t(actionError)}
          </p>
        ) : null}

        <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className={`${suitePanelClass} space-y-4`}>
            <button
              type="button"
              className={`${suiteSecondaryBtn} w-full`}
              onClick={() => {
                setFacet(null)
                setPage(1)
              }}
            >
              {t('suite.all')}
            </button>
            {(
              [
                ['department', board.facets.department, 'suite.facet.department'],
                ['location', board.facets.location, 'suite.facet.location'],
                ['brand', board.facets.brand, 'suite.facet.brand'],
              ] as const
            ).map(([kind, items, label]) => (
              <div key={kind} className="space-y-1">
                <p className="text-xs font-bold text-[var(--ds-text-muted)]">{t(label)}</p>
                {items.map((item) => {
                  const selected = facet?.kind === kind && facet.value === item.key
                  return (
                    <button
                      key={`${kind}-${item.key}`}
                      type="button"
                      className={`ds-focus-ring flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-start text-sm transition ${
                        selected
                          ? 'bg-[var(--ds-accent-soft)] font-semibold text-[var(--ds-accent)]'
                          : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)] hover:text-[var(--ds-text-primary)]'
                      }`}
                      onClick={() => {
                        setFacet({ kind, value: item.key })
                        setPage(1)
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                      <span dir="ltr" className="ds-num text-xs tabular-nums text-[var(--ds-text-muted)]">
                        ({formatInt(item.count, fmtLocale)})
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </aside>

          <div className={suitePanelClass}>
            {rows.length === 0 ? (
              <StateBlock state="empty" locale={fmtLocale} title={t('suite.empty')} />
            ) : null}

            {rows.length > 0 && view === 'kanban' ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {board.stages.map((column) => (
                  <div
                    key={column}
                    className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3"
                  >
                    <p className="mb-2 text-xs font-bold uppercase text-[var(--ds-text-secondary)]">
                      {column}{' '}
                      <span dir="ltr" className="ds-num tabular-nums">
                        ({formatInt(board.stageCounts[column] ?? 0, fmtLocale)})
                      </span>
                    </p>
                    <div className="space-y-2">
                      {rows
                        .filter((row) => row.stage === column)
                        .map((row) => (
                          <article
                            key={row.id}
                            className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] p-3 text-sm text-[var(--ds-text-primary)]"
                          >
                            <p className="font-semibold">{row.title}</p>
                            <p className="mt-1 text-xs text-[var(--ds-text-muted)]">
                              {row.brandName || UNAVAILABLE_DASH} · {row.branchName || UNAVAILABLE_DASH}
                            </p>
                            {row.amountMinor > 0 ? (
                              <p className="mt-1 text-xs font-semibold text-[var(--ds-accent)]">
                                <SuiteMoney minor={row.amountMinor} />
                              </p>
                            ) : null}
                            {canManage && board.stages.length > 1 ? (
                              <select
                                aria-label={`${row.title} — ${t('suite.facet.stage')}`}
                                className={`${suiteInputClass} mt-2`}
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

            {rows.length > 0 && view === 'list' ? (
              <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
                    <tr>
                      <th className="px-3.5 py-2.5 text-start">{t('suite.title')}</th>
                      <th className="px-3.5 py-2.5 text-start">{t('suite.facet.stage')}</th>
                      <th className="px-3.5 py-2.5 text-start">{t('suite.facet.brand')}</th>
                      <th className="px-3.5 py-2.5 text-start">{t('suite.facet.location')}</th>
                      <th className="px-3.5 py-2.5 text-start">{t('suite.assignee')}</th>
                      <th className="px-3.5 py-2.5 text-end">{t('suite.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ds-border-hairline)] text-[var(--ds-text-primary)]">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-[var(--ds-bg-hover)]">
                        <td className="px-3.5 py-2.5 font-medium">{row.title}</td>
                        <td className="px-3.5 py-2.5">{row.stage}</td>
                        <td className="px-3.5 py-2.5 text-[var(--ds-text-secondary)]">
                          {row.brandName || <SuiteUnavailableDash locale={fmtLocale} />}
                        </td>
                        <td className="px-3.5 py-2.5 text-[var(--ds-text-secondary)]">
                          {row.branchName || <SuiteUnavailableDash locale={fmtLocale} />}
                        </td>
                        <td className="px-3.5 py-2.5 text-[var(--ds-text-secondary)]">
                          {row.assignee || <SuiteUnavailableDash locale={fmtLocale} />}
                        </td>
                        <td className="px-3.5 py-2.5 text-end">
                          {row.amountMinor > 0 ? (
                            <SuiteMoney minor={row.amountMinor} />
                          ) : (
                            <span
                              dir="ltr"
                              title={unavailableTooltip}
                              aria-label={unavailableTooltip}
                              data-unavailable="true"
                              className="ds-num tabular-nums"
                              style={{ color: 'var(--ds-unavailable)' }}
                            >
                              {UNAVAILABLE_DASH}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {rows.length > 0 && view === 'gantt' ? (
              <div className="space-y-2.5">
                {rows.map((row) => {
                  const start = parseKuwaitDateMs(row.startsOn) ?? todayMs
                  const end = parseKuwaitDateMs(row.endsOn) ?? start + 7 * 86_400_000
                  const span = Math.max(1, Math.round((end - start) / 86_400_000))
                  const offset = Math.max(0, Math.round((start - todayMs) / 86_400_000) + 14)
                  const startLabel = row.startsOn
                    ? formatDate(row.startsOn, fmtLocale)
                    : UNAVAILABLE_DASH
                  const endLabel = row.endsOn ? formatDate(row.endsOn, fmtLocale) : UNAVAILABLE_DASH
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-1 items-center gap-2 text-sm sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3"
                    >
                      <p className="truncate font-medium text-[var(--ds-text-primary)]">
                        {row.title}
                      </p>
                      <div className="relative h-8 rounded-lg border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                        <div
                          className="absolute top-1 h-6 rounded-md bg-emerald-600/80 dark:bg-emerald-500/75"
                          style={{
                            insetInlineStart: `${Math.min(80, offset * 3)}%`,
                            width: `${Math.min(40, span * 3 + 8)}%`,
                          }}
                          title={`${startLabel} → ${endLabel}`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                className={suiteSecondaryBtn}
                disabled={page <= 1}
                aria-label={isAr ? 'السابق' : 'Previous'}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                {isAr ? 'السابق' : 'Previous'}
              </button>
              <span dir="ltr" className="ds-num text-xs font-semibold tabular-nums text-[var(--ds-text-muted)]">
                {formatInt(page, fmtLocale)} / {formatInt(totalPages, fmtLocale)}
              </span>
              <button
                type="button"
                className={suiteSecondaryBtn}
                disabled={page >= totalPages}
                aria-label={isAr ? 'التالي' : 'Next'}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                {isAr ? 'التالي' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {openCreate ? (
        <SuiteModal title={t('suite.create')} onClose={() => setOpenCreate(false)}>
          <form className="space-y-3" onSubmit={create}>
            <label className={suiteLabelClass}>
              {t('suite.title')}
              <input
                className={suiteInputClass}
                required
                value={titleValue}
                onChange={(event) => setTitleValue(event.target.value)}
              />
            </label>
            <label className={suiteLabelClass}>
              {t('suite.facet.stage')}
              <select
                className={suiteInputClass}
                value={stage}
                onChange={(event) => setStage(event.target.value)}
              >
                {board.stages.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className={suiteLabelClass}>
              {t('suite.facet.brand')}
              <input
                className={suiteInputClass}
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
              />
            </label>
            <label className={suiteLabelClass}>
              {t('suite.facet.location')}
              <input
                className={suiteInputClass}
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
              />
            </label>
            <label className={suiteLabelClass}>
              {t('suite.facet.department')}
              <input
                className={suiteInputClass}
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </label>
            <label className={suiteLabelClass}>
              {t('suite.assignee')}
              <input
                className={suiteInputClass}
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={suiteSecondaryBtn}
                onClick={() => setOpenCreate(false)}
              >
                {t('admin.cancel')}
              </button>
              <button type="submit" className={suitePrimaryBtn} disabled={busy}>
                {t('suite.save')}
              </button>
            </div>
          </form>
        </SuiteModal>
      ) : null}
    </SectionCard>
  )
}
