'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { SmartIngestLink } from '@/components/SmartIngestLink'
import { ApiError, apiRequest, errorKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type {
  BlockedAttempt,
  Circular,
  EnforcementRule,
  LearningMemory,
} from '@/modules/governance/client'

type Tab = 'laws' | 'gate' | 'memory'
const tabs: readonly Tab[] = ['laws', 'gate', 'memory']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

type ActionType =
  | 'delivery.assign_driver'
  | 'hr.attendance.hours'
  | 'hr.expense.cash'
  | 'hr.residency.check'
type HrAlert = {
  id: string
  fullName: string
  residencyExpiry: string | null
  workLocation: string | null
}

const inputClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)]'
const labelClass = 'block text-sm font-medium text-[var(--ds-text-secondary)]'
const primaryBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
const secondaryBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] transition hover:bg-[var(--ds-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'
const noticeClass =
  'rounded-xl border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-positive)]'
const errorClass =
  'rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-negative)]'

function Workspace({ initialTab }: { initialTab: string }) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const canEnforce = useCan(permissions.govComplianceEnforce)

  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'laws')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey | null>(null)
  const [actionError, setActionError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [circulars, setCirculars] = useState<Circular[]>([])
  const [rules, setRules] = useState<EnforcementRule[]>([])
  const [blocks, setBlocks] = useState<BlockedAttempt[]>([])
  const [memory, setMemory] = useState<LearningMemory[]>([])
  const [hrAlerts, setHrAlerts] = useState<HrAlert[]>([])
  const [action, setAction] = useState<ActionType>('delivery.assign_driver')
  const [reloadTick, setReloadTick] = useState(0)

  const reload = useCallback(() => {
    setReloadTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const asOf = formatDate(new Date(), 'en')
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: Circular[] }>('/api/v1/governance/circulars', {
        signal: controller.signal,
      }),
      apiRequest<{ data: EnforcementRule[] }>('/api/v1/governance/rules', {
        signal: controller.signal,
      }),
      apiRequest<{ data: BlockedAttempt[] }>('/api/v1/governance/blocks', {
        signal: controller.signal,
      }),
      apiRequest<{ data: LearningMemory[] }>('/api/v1/governance/memory', {
        signal: controller.signal,
      }),
      apiRequest<{ data: HrAlert[] }>('/api/v1/hr/employees', {
        signal: controller.signal,
      }).catch(() => ({ data: [] as HrAlert[] })),
    ])
      .then(([circularPage, rulePage, blockPage, memoryPage, employeePage]) => {
        setCirculars(circularPage.data)
        setRules(rulePage.data)
        setBlocks(blockPage.data)
        setMemory(memoryPage.data)
        setHrAlerts(
          employeePage.data.filter(
            (row) => row.residencyExpiry && row.residencyExpiry <= asOf,
          ),
        )
        setError(null)
        setActionError(null)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [reloadTick])

  async function enforce(circular: Circular) {
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      await apiRequest(`/api/v1/governance/circulars/${circular.id}/enforce`, {
        method: 'POST',
        body: { version: circular.version },
      })
      setNotice(t('gov.saved'))
      reload()
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function simulate(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    setActionError(null)
    const body =
      action === 'delivery.assign_driver'
        ? { actionType: action, licenseExpiry: '2020-01-01' }
        : action === 'hr.attendance.hours'
          ? { actionType: action, workedMinutes: 9 * 60 }
          : action === 'hr.residency.check'
            ? { actionType: action, residencyExpiry: '2020-01-01' }
            : { actionType: action, cashMinor: 80_000 }
    try {
      await apiRequest('/api/v1/governance/compliance/simulate', { method: 'POST', body })
      setNotice(t('gov.allowed'))
      reload()
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'compliance_blocked') {
        setNotice(
          isAr
            ? 'تم الإيقاف بواسطة بوابة الامتثال الرقابية.'
            : 'Action blocked by active compliance gate.',
        )
        reload()
      } else {
        setActionError(errorKey(caught))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <SectionCard
        title={t('hub.compliance')}
        subtitle={
          isAr
            ? 'التعاميم الكويتية، بوابة الإيقاف الصارم، ومحرك التعلم الذاتي'
            : 'Kuwait regulatory circulars, strict compliance gate, and learning memory'
        }
        locale={fmtLocale}
        actions={<SmartIngestLink module="governance" />}
      >
        <div
          role="tablist"
          aria-label={t('hub.compliance')}
          className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((item) => {
            const active = item === tab
            return (
              <button
                key={item}
                type="button"
                role="tab"
                id={`compliance-tab-${item}`}
                aria-selected={active}
                aria-controls={`compliance-panel-${item}`}
                className={`shrink-0 whitespace-nowrap ${active ? primaryBtnClass : secondaryBtnClass}`}
                onClick={() => setTab(item)}
              >
                {t(`gov.tab.${item}` as MessageKey)}
              </button>
            )
          })}
        </div>

        {notice ? (
          <p className={`${noticeClass} mt-4`} role="alert">
            {notice}
          </p>
        ) : null}
        {actionError ? (
          <p className={`${errorClass} mt-4`} role="alert">
            {t(actionError)}
          </p>
        ) : null}
      </SectionCard>

      {phase === 'loading' ? (
        <SectionCard locale={fmtLocale}>
          <StateBlock state="loading" locale={fmtLocale} title={t('gov.loading')} skeletonRows={4} />
        </SectionCard>
      ) : null}

      {phase === 'error' && error ? (
        <SectionCard locale={fmtLocale}>
          <StateBlock
            state={error === 'erp.err.forbidden' ? 'forbidden' : 'error'}
            locale={fmtLocale}
            title={t(error)}
            onRetry={error === 'erp.err.forbidden' ? undefined : reload}
          />
        </SectionCard>
      ) : null}

      {phase === 'ready' ? (
        <div
          role="tabpanel"
          id={`compliance-panel-${tab}`}
          aria-labelledby={`compliance-tab-${tab}`}
        >
          {tab === 'laws' ? (
            <SectionCard title={t('gov.tab.laws')} locale={fmtLocale}>
              {circulars.length === 0 ? (
                <StateBlock state="empty" locale={fmtLocale} title={t('gov.empty')} />
              ) : (
                <div className="divide-y divide-[var(--ds-border-hairline)]">
                  {circulars.map((circular) => (
                    <article key={circular.id} className="space-y-1.5 py-3.5 text-sm">
                      <p className="font-semibold text-[var(--ds-text-primary)]">
                        {circular.authorityName} —{' '}
                        <span dir="ltr" className="font-mono text-xs">
                          {circular.regulationCode}
                        </span>
                      </p>
                      <p className="text-[var(--ds-text-primary)]">{circular.titleAr}</p>
                      <p className="text-xs text-[var(--ds-text-muted)]">
                        {t('gov.department')}: {circular.targetDepartment}
                      </p>
                      <p className="text-[var(--ds-text-secondary)]">{circular.aiRecommendationAr}</p>
                      <p className="text-xs font-semibold text-[var(--ds-text-muted)]">
                        {circular.status}
                      </p>
                      {canEnforce && circular.status === 'pending' ? (
                        <button
                          className={`${primaryBtnClass} mt-2`}
                          type="button"
                          disabled={busy}
                          onClick={() => void enforce(circular)}
                        >
                          {t('gov.enforce')}
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}

          {tab === 'gate' ? (
            <SectionCard title={t('gov.tab.gatekeeper')} locale={fmtLocale}>
              <div className="mb-5 space-y-2.5">
                <p className="text-xs font-bold text-[var(--ds-text-secondary)]">
                  {t('gov.gate.residency')}
                </p>
                {hrAlerts.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('gov.empty')} />
                ) : (
                  <div className="space-y-2">
                    {hrAlerts.slice(0, 40).map((row) => (
                      <p
                        key={row.id}
                        className="rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-negative)]"
                      >
                        {row.fullName} — {t('gov.gate.expired')}{' '}
                        <span dir="ltr" className="ds-num tabular-nums">
                          {formatDate(row.residencyExpiry, fmtLocale)}
                        </span>
                        {row.workLocation ? ` · ${row.workLocation}` : ''}
                      </p>
                    ))}
                  </div>
                )}

                <p className="pt-2 text-xs font-bold text-[var(--ds-text-secondary)]">
                  {t('gov.gate.license')}
                </p>
                <div className="space-y-2">
                  {circulars
                    .filter(
                      (row) =>
                        row.regulationCode.includes('2026-01') ||
                        row.titleAr.includes('رخص') ||
                        row.titleAr.includes('فرع'),
                    )
                    .slice(0, 8)
                    .map((row) => (
                      <p
                        key={row.id}
                        className="rounded-xl border border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-warning)]"
                      >
                        <span dir="ltr" className="font-mono text-xs">
                          {row.regulationCode}
                        </span>{' '}
                        — {row.titleAr}
                      </p>
                    ))}
                </div>
              </div>

              {canEnforce ? (
                <form
                  className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-4"
                  onSubmit={(event) => void simulate(event)}
                >
                  <label className={`${labelClass} min-w-[14rem] flex-1 sm:max-w-sm`}>
                    {t('gov.rule')}
                    <select
                      className={inputClass}
                      value={action}
                      onChange={(event) => setAction(event.target.value as ActionType)}
                    >
                      <option value="delivery.assign_driver">{t('gov.action.license')}</option>
                      <option value="hr.attendance.hours">{t('gov.action.hours')}</option>
                      <option value="hr.expense.cash">{t('gov.action.cash')}</option>
                      <option value="hr.residency.check">{t('gov.action.residency')}</option>
                    </select>
                  </label>
                  <button className={primaryBtnClass} type="submit" disabled={busy}>
                    {t('gov.simulate')}
                  </button>
                </form>
              ) : null}

              <div className="space-y-2">
                {rules.map((rule) => (
                  <p
                    key={rule.id}
                    className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--ds-text-primary)]"
                  >
                    <span dir="ltr" className="font-mono text-xs font-semibold">
                      {rule.ruleCode}
                    </span>{' '}
                    — {rule.ruleType} —{' '}
                    <span dir="ltr" className="ds-num font-semibold tabular-nums">
                      {rule.ruleType === 'cash_ceiling_kwd'
                        ? formatKwd(rule.thresholdValue / 1000, fmtLocale)
                        : formatInt(rule.thresholdValue, fmtLocale)}
                    </span>{' '}
                    — {rule.isActive ? t('gov.active') : t('gov.inactive')}
                  </p>
                ))}
              </div>

              <div className="mt-4">
                {blocks.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('gov.empty')} />
                ) : (
                  <div className="divide-y divide-[var(--ds-border-hairline)] rounded-xl border border-[var(--ds-border-hairline)]">
                    {blocks.map((block) => (
                      <p key={block.id} className="px-3.5 py-2.5 text-sm text-[var(--ds-text-primary)]">
                        {block.actorName} — {block.blockMessageAr}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          ) : null}

          {tab === 'memory' ? (
            <SectionCard title={t('gov.tab.memory')} locale={fmtLocale}>
              {memory.length === 0 ? (
                <StateBlock state="empty" locale={fmtLocale} title={t('gov.empty')} />
              ) : (
                <div className="divide-y divide-[var(--ds-border-hairline)]">
                  {memory.map((row) => (
                    <article key={row.id} className="space-y-1 py-3.5 text-sm">
                      <p className="font-semibold text-[var(--ds-text-primary)]">
                        {row.contextDomain} —{' '}
                        <span dir="ltr" className="ds-num tabular-nums">
                          {typeof row.confidenceScore === 'number' &&
                          Number.isFinite(row.confidenceScore)
                            ? formatInt(row.confidenceScore, fmtLocale)
                            : (
                                <span
                                  dir="ltr"
                                  title={unavailableTooltip}
                                  aria-label={unavailableTooltip}
                                  data-unavailable="true"
                                  style={{ color: 'var(--ds-unavailable)' }}
                                >
                                  {UNAVAILABLE_DASH}
                                </span>
                              )}
                        </span>
                      </p>
                      <p className="text-[var(--ds-text-primary)]">{row.managerDecisionPattern}</p>
                      <p className="text-[var(--ds-text-muted)]">{row.recurringIssueDetected}</p>
                      <p className="text-[var(--ds-text-secondary)]">{row.learnedWeightAdjustment}</p>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function ComplianceWorkspace({
  permissions: held,
  initialTab,
}: {
  permissions: readonly string[]
  initialTab: string
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} />
    </PermissionProvider>
  )
}
