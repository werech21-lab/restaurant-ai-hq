'use client'

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { Modal, type ListPage, type Phase } from '@/components/erp/common'
import { errorClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Badge, Money, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { isClosedStage, leadStages, type Lead, type LeadStage, type StageSummary, type TeamMember } from '@/modules/crm/client'
import { memberName, minorText, stageLabels, todayUtc } from '@/modules/crm/ui/shared'

type Column = { leads: Lead[]; cursor: string | null }
type Columns = Record<LeadStage, Column>

const emptyColumns = (): Columns => ({
  new: { leads: [], cursor: null },
  contacted: { leads: [], cursor: null },
  qualified: { leads: [], cursor: null },
  proposal: { leads: [], cursor: null },
  won: { leads: [], cursor: null },
  lost: { leads: [], cursor: null },
})

const stageAccent: Record<LeadStage, string> = {
  new: 'border-t-sky-400/70',
  contacted: 'border-t-indigo-400/70',
  qualified: 'border-t-violet-400/70',
  proposal: 'border-t-amber-400/70',
  won: 'border-t-emerald-400/80',
  lost: 'border-t-rose-400/70',
}

const PAGE = 50

type Props = {
  team: TeamMember[]
  reloadToken: number
  onEdit: (lead: Lead) => void
  onQuote: (lead: Lead) => void
  onMoved: (message: MessageKey) => void
}

/**
 * The opportunity pipeline: one column per stage with its count and total expected revenue (over every lead of that
 * stage, not just the cards loaded). Cards can be dragged to another column or moved from a menu. Won and lost are final.
 */
export function PipelineBoard({ team, reloadToken, onEdit, onQuote, onMoved }: Props) {
  const { t } = useI18n()
  const [columns, setColumns] = useState<Columns>(emptyColumns)
  const [summary, setSummary] = useState<StageSummary[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [actionError, setActionError] = useState<MessageKey | null>(null)
  const [retry, setRetry] = useState(0)
  const [dragging, setDragging] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<LeadStage | null>(null)
  const [confirm, setConfirm] = useState<{ lead: Lead; to: 'won' | 'lost' } | null>(null)
  const [moving, setMoving] = useState(false)
  const [loadingMore, setLoadingMore] = useState<LeadStage | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    Promise.all([
      apiRequest<{ data: StageSummary[] }>('/api/v1/crm/leads/summary', { signal }),
      ...leadStages.map((stage) =>
        apiRequest<ListPage<Lead>>(`/api/v1/crm/leads?stage=${stage}&limit=${PAGE}&sort=createdAt&direction=desc`, { signal })
      ),
    ])
      .then(([totals, ...pages]) => {
        const next = emptyColumns()
        leadStages.forEach((stage, index) => {
          next[stage] = { leads: pages[index].data, cursor: pages[index].nextCursor }
        })
        setColumns(next)
        setSummary(totals.data)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [reloadToken, retry])

  const summaryByStage = useMemo(() => new Map(summary.map((entry) => [entry.stage, entry])), [summary])
  const allLeads = useMemo(() => leadStages.flatMap((stage) => columns[stage].leads), [columns])

  const moveTo = useCallback(
    async (lead: Lead, to: LeadStage) => {
      setActionError(null)
      setMoving(true)
      try {
        await apiRequest<{ data: Lead }>(`/api/v1/crm/leads/${lead.id}/stage`, {
          method: 'POST',
          body: { stage: to, version: lead.version },
        })
        setConfirm(null)
        onMoved('crm.msg.moved')
      } catch (error) {
        setConfirm(null)
        setActionError(errorKey(error))
        // A stale version means someone else changed the lead. Reloading shows the current state.
        setRetry((value) => value + 1)
      } finally {
        setMoving(false)
      }
    },
    [onMoved]
  )

  const requestMove = useCallback(
    (lead: Lead, to: LeadStage) => {
      if (isClosedStage(lead.stage) || lead.stage === to) return
      if (to === 'won' || to === 'lost') {
        setConfirm({ lead, to })
        return
      }
      void moveTo(lead, to)
    },
    [moveTo]
  )

  async function loadMore(stage: LeadStage) {
    const cursor = columns[stage].cursor
    if (!cursor) return
    setLoadingMore(stage)
    try {
      const page = await apiRequest<ListPage<Lead>>(
        `/api/v1/crm/leads?stage=${stage}&limit=${PAGE}&sort=createdAt&direction=desc&cursor=${encodeURIComponent(cursor)}`
      )
      setColumns((current) => ({
        ...current,
        [stage]: { leads: [...current[stage].leads, ...page.data], cursor: page.nextCursor },
      }))
    } catch (error) {
      setActionError(errorKey(error))
    } finally {
      setLoadingMore(null)
    }
  }

  function onDrop(event: DragEvent, stage: LeadStage) {
    event.preventDefault()
    setOverStage(null)
    const id = event.dataTransfer.getData('text/plain') || dragging
    setDragging(null)
    const lead = allLeads.find((candidate) => candidate.id === id)
    if (lead) requestMove(lead, stage)
  }

  if (phase === 'loading') return <p className="py-10 text-center text-sm text-gray-400">{t('erp.loading')}</p>

  if (phase === 'error') {
    return (
      <div className="space-y-3 py-8 text-center">
        <p role="alert" className={`${errorClass} inline-block`}>
          {t(loadError)}
        </p>
        <div>
          <button type="button" onClick={() => { setPhase('loading'); setRetry((value) => value + 1) }} className={secondaryButton}>
            {t('erp.retry')}
          </button>
        </div>
      </div>
    )
  }

  const today = todayUtc()

  return (
    <div>
      <p className="mb-3 text-xs text-gray-400">{t('crm.pipe.hint')}</p>
      {actionError ? (
        <p role="alert" className={`${errorClass} mb-3`}>
          {t(actionError)}
        </p>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-3" data-testid="pipeline-board">
        {leadStages.map((stage) => {
          const entry = summaryByStage.get(stage)
          const count = entry?.count ?? columns[stage].leads.length
          const total = entry?.expectedRevenueMinor ?? 0
          const highlighted = overStage === stage && dragging !== null
          return (
            <section
              key={stage}
              data-stage={stage}
              aria-label={t(stageLabels[stage])}
              onDragOver={(event) => {
                if (dragging === null) return
                event.preventDefault()
                if (overStage !== stage) setOverStage(stage)
              }}
              onDragLeave={() => setOverStage((current) => (current === stage ? null : current))}
              onDrop={(event) => onDrop(event, stage)}
              className={`w-72 min-w-[18rem] shrink-0 rounded-xl border border-t-2 border-[#30363d] ${stageAccent[stage]} bg-[#161b22] p-3 transition ${
                highlighted ? 'ring-2 ring-blue-500/60' : ''
              }`}
            >
              <header className="mb-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-100">{t(stageLabels[stage])}</h3>
                  <Badge tone="neutral">
                    <Num>{count.toLocaleString('en-US')}</Num>
                    <span className="ms-1">{t('crm.pipe.deals')}</span>
                  </Badge>
                </div>
                <p className="mt-1.5 flex items-center justify-between text-xs text-gray-400">
                  <span>{t('crm.pipe.total')}</span>
                  <Money value={minorText(total)} className="text-sm font-semibold text-gray-100" />
                </p>
              </header>

              <div className="space-y-2.5">
                {columns[stage].leads.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#30363d] px-3 py-6 text-center text-xs text-gray-500">
                    {t('crm.pipe.empty')}
                  </p>
                ) : null}
                {columns[stage].leads.map((lead) => {
                  const closed = isClosedStage(lead.stage)
                  const assignee = memberName(team, lead.assignedTo)
                  const overdue = !closed && lead.expectedCloseDate !== null && lead.expectedCloseDate < today
                  return (
                    <article
                      key={lead.id}
                      data-lead={lead.id}
                      draggable={!closed}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', lead.id)
                        event.dataTransfer.effectAllowed = 'move'
                        setDragging(lead.id)
                      }}
                      onDragEnd={() => {
                        setDragging(null)
                        setOverStage(null)
                      }}
                      className={`rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-sm ${
                        closed ? 'opacity-80' : 'cursor-grab active:cursor-grabbing'
                      } ${dragging === lead.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-100">{lead.title}</p>
                        {closed ? <Badge tone={lead.stage === 'won' ? 'good' : 'bad'}>{t('crm.pipe.closedCard')}</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">{lead.customerName}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Money value={minorText(lead.expectedRevenueMinor)} className="font-semibold text-blue-300" />
                        <span className="text-xs text-gray-400">
                          {t('crm.pipe.probability')} <Num>{lead.probability}%</Num>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#30363d]" aria-hidden="true">
                        <div className="h-full bg-blue-500" style={{ width: `${lead.probability}%` }} />
                      </div>
                      <dl className="mt-2 space-y-0.5 text-xs text-gray-400">
                        <div className="flex justify-between gap-2">
                          <dt>{t('crm.lead.assignee')}</dt>
                          <dd className="text-gray-300">{assignee ?? t('crm.pipe.unassigned')}</dd>
                        </div>
                        {lead.expectedCloseDate ? (
                          <div className="flex justify-between gap-2">
                            <dt>{t('crm.pipe.closeDate')}</dt>
                            <dd className={overdue ? 'text-amber-300' : 'text-gray-300'}>
                              <Num>{lead.expectedCloseDate}</Num>
                              {overdue ? <span className="ms-1">· {t('crm.pipe.overdue')}</span> : null}
                            </dd>
                          </div>
                        ) : null}
                      </dl>

                      {closed ? null : (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <select
                            aria-label={`${t('crm.pipe.moveTo')}: ${lead.title}`}
                            value=""
                            disabled={moving}
                            onChange={(event) => requestMove(lead, event.target.value as LeadStage)}
                            className="min-w-0 flex-1 rounded-lg border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500"
                          >
                            <option value="">{t('crm.pipe.moveTo')}…</option>
                            {leadStages
                              .filter((candidate) => candidate !== lead.stage)
                              .map((candidate) => (
                                <option key={candidate} value={candidate}>
                                  {t(stageLabels[candidate])}
                                </option>
                              ))}
                          </select>
                          <button type="button" onClick={() => onQuote(lead)} className="text-xs text-blue-400 hover:text-blue-300">
                            {t('crm.pipe.newQuote')}
                          </button>
                          <button type="button" onClick={() => onEdit(lead)} className="text-xs text-gray-300 hover:text-white">
                            {t('erp.edit')}
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })}
                {columns[stage].cursor ? (
                  <button
                    type="button"
                    disabled={loadingMore === stage}
                    onClick={() => void loadMore(stage)}
                    className={`${secondaryButton} w-full`}
                  >
                    {loadingMore === stage ? t('erp.loading') : t('erp.loadMore')}
                  </button>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>

      {confirm ? (
        <Modal title={t('crm.pipe.confirmTitle')} onClose={() => setConfirm(null)}>
          <p className="text-sm font-semibold text-gray-100">{confirm.lead.title}</p>
          <p className="mt-2 text-sm text-gray-300">{confirm.to === 'won' ? t('crm.pipe.confirmWon') : t('crm.pipe.confirmLost')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={moving} onClick={() => void moveTo(confirm.lead, confirm.to)} className={primaryButton}>
              {moving ? t('erp.working') : t('crm.pipe.confirm')}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className={secondaryButton}>
              {t('erp.cancel')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
