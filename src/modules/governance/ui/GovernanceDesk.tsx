'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SmartIngestLink } from '@/components/SmartIngestLink'
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
import { parseKwdToMinor } from '@/lib/money'
import type {
  ConnectedDevice,
  ExecutiveTask,
  GovViolation,
  Investigation,
  MonitorEvent,
} from '@/modules/governance/client'

type Tab = 'violations' | 'inquiry' | 'monitor' | 'tasks' | 'gate'
const tabs: readonly Tab[] = ['violations', 'inquiry', 'monitor', 'tasks', 'gate']
type HrAlert = {
  id: string
  fullName: string
  residencyExpiry: string | null
  workLocation: string | null
}

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function hoursLeft(sla: string): number | null {
  const target = Date.parse(`${sla}T23:59:59.999Z`)
  if (!Number.isFinite(target)) return null
  return Math.floor((target - Date.now()) / 3_600_000)
}

const inputCls =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-[#0D1512] dark:text-slate-100 dark:placeholder:text-slate-500'
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300'
const primaryBtnCls =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryBtnCls =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-300/90 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:bg-white/[0.06]'
const noticeCls =
  'rounded-xl border border-emerald-500/30 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200'

export interface GovernanceDeskInitialData {
  violations?: GovViolation[]
  inquiries?: Investigation[]
  devices?: ConnectedDevice[]
  events?: MonitorEvent[]
  tasks?: ExecutiveTask[]
  hrAlerts?: HrAlert[]
}

function Workspace({
  initialTab,
  initialPhase,
  initialError,
  initialData,
}: {
  initialTab: string
  initialPhase?: 'loading' | 'ready' | 'error'
  initialError?: MessageKey
  initialData?: GovernanceDeskInitialData
}) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale === 'ar'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const canViolation = useCan(permissions.govViolationManage)
  const canInquiry = useCan(permissions.govInquiryManage)
  const canMonitor = useCan(permissions.govMonitorManage)
  const canTask = useCan(permissions.govTaskDispatch)

  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'violations')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>(initialPhase ?? 'loading')
  const [error, setError] = useState<MessageKey>(initialError ?? 'erp.err.generic')
  const [actionError, setActionError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [violations, setViolations] = useState<GovViolation[]>(initialData?.violations ?? [])
  const [inquiries, setInquiries] = useState<Investigation[]>(initialData?.inquiries ?? [])
  const [devices, setDevices] = useState<ConnectedDevice[]>(initialData?.devices ?? [])
  const [events, setEvents] = useState<MonitorEvent[]>(initialData?.events ?? [])
  const [tasks, setTasks] = useState<ExecutiveTask[]>(initialData?.tasks ?? [])
  const [hrAlerts, setHrAlerts] = useState<HrAlert[]>(initialData?.hrAlerts ?? [])

  const [statement, setStatement] = useState('')
  const [proof, setProof] = useState('archive:closure-proof')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [finding, setFinding] = useState('')
  const [ruling, setRuling] = useState('')
  const [assignee, setAssignee] = useState('')
  const [instruction, setInstruction] = useState('')
  const [due, setDue] = useState(new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState('')
  const [caseNumber, setCaseNumber] = useState('')
  const [subject, setSubject] = useState('')
  const [summary, setSummary] = useState('')
  const [noteName, setNoteName] = useState('')
  const [note, setNote] = useState('')
  const [number, setNumber] = useState('')
  const [kind, setKind] = useState('')
  const [fine, setFine] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [deadline, setDeadline] = useState(new Date().toISOString().slice(0, 10))
  const [reloadToken, setReloadToken] = useState(0)

  function load() {
    setReloadToken((current) => current + 1)
  }

  useEffect(() => {
    if (initialPhase !== undefined && reloadToken === 0) return
    const controller = new AbortController()
    setPhase('loading')
    const asOf = formatDate(new Date(), 'en')
    Promise.all([
      apiRequest<{ data: GovViolation[] }>('/api/v1/governance/violations', {
        signal: controller.signal,
      }),
      apiRequest<{ data: Investigation[] }>('/api/v1/governance/investigations', {
        signal: controller.signal,
      }),
      apiRequest<{ data: { devices: ConnectedDevice[]; events: MonitorEvent[] } }>(
        '/api/v1/governance/monitoring',
        { signal: controller.signal },
      ),
      apiRequest<{ data: ExecutiveTask[] }>('/api/v1/governance/tasks', {
        signal: controller.signal,
      }),
      apiRequest<{ data: HrAlert[] }>('/api/v1/hr/employees', {
        signal: controller.signal,
      }).catch(() => ({ data: [] as HrAlert[] })),
    ])
      .then(([violationPage, inquiryPage, monitorPage, taskPage, employeePage]) => {
        setViolations(violationPage.data)
        setInquiries(inquiryPage.data)
        setDevices(monitorPage.data.devices)
        setEvents(monitorPage.data.events)
        setTasks(taskPage.data)
        setHrAlerts(
          employeePage.data.filter(
            (row) => row.residencyExpiry && row.residencyExpiry <= asOf,
          ),
        )
        setActionError(null)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [initialPhase, reloadToken])

  async function post(path: string, body: unknown, idempotent: boolean) {
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      await apiRequest(path, {
        method: 'POST',
        body,
        idempotencyKey: idempotent ? newIdempotencyKey() : undefined,
      })
      setNotice(t('gov.saved'))
      load()
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  function addViolation(event: FormEvent) {
    event.preventDefault()
    const amount = parseKwdToMinor(fine)
    if (amount === null) {
      setActionError('erp.err.validation_failed')
      return
    }
    void post(
      '/api/v1/governance/violations',
      {
        violationNumber: number,
        issuingAuthority: 'بلدية الكويت',
        branchId: null,
        violationTypeAr: kind,
        fineAmountMinor: amount,
        assignedEmployeeName: ownerName,
        slaDeadline: deadline,
      },
      true,
    )
  }

  if (phase === 'loading') {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-none space-y-4">
        <StateBlock state="loading" locale={fmtLocale} skeletonRows={4} title={t('gov.loading')} />
      </div>
    )
  }

  if (phase === 'error') {
    const isForbidden = error === 'erp.err.forbidden' || error === 'erp.err.unauthenticated'
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-none space-y-4">
        <StateBlock
          state={isForbidden ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(error)}
          onRetry={isForbidden ? undefined : load}
        />
      </div>
    )
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-none min-w-0 space-y-5">
      <SectionCard
        locale={fmtLocale}
        icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        title={t('desk.title')}
        subtitle={t('desk.lead')}
        actions={<SmartIngestLink module="governance" />}
      >
        {notice ? (
          <p role="status" className={`${noticeCls} mb-4`}>
            {notice}
          </p>
        ) : null}
        {actionError ? (
          <div className="mb-4">
            <StateBlock
              state={actionError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
              compact
              locale={fmtLocale}
              title={t(actionError)}
            />
          </div>
        ) : null}

        <div
          role="tablist"
          aria-label={t('desk.title')}
          className="mb-5 flex flex-wrap gap-2 border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`desk-tab-${item}`}
              aria-selected={tab === item}
              aria-controls={`desk-panel-${item}`}
              onClick={() => setTab(item)}
              className={tab === item ? primaryBtnCls : secondaryBtnCls}
            >
              {t(`desk.tab.${item}` as MessageKey)}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`desk-panel-${tab}`} aria-labelledby={`desk-tab-${tab}`}>
          {tab === 'violations' ? (
            <div className="space-y-4">
              {canViolation ? (
                <form className="grid gap-3 sm:grid-cols-2" onSubmit={addViolation}>
                  <label className={labelCls}>
                    {t('desk.number')}
                    <input
                      className={inputCls}
                      required
                      value={number}
                      onChange={(event) => setNumber(event.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    {t('desk.kind')}
                    <input
                      className={inputCls}
                      required
                      value={kind}
                      onChange={(event) => setKind(event.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    {t('desk.employee')}
                    <input
                      className={inputCls}
                      required
                      value={ownerName}
                      onChange={(event) => setOwnerName(event.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    {t('desk.fine')}
                    <input
                      className={inputCls}
                      dir="ltr"
                      inputMode="decimal"
                      required
                      value={fine}
                      onChange={(event) => setFine(event.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    {t('desk.deadline')}
                    <input
                      className={inputCls}
                      dir="ltr"
                      type="date"
                      required
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                    />
                  </label>
                  <div className="flex items-end">
                    <button className={primaryBtnCls} type="submit" disabled={busy}>
                      {t('desk.register')}
                    </button>
                  </div>
                </form>
              ) : null}

              {violations.length === 0 ? (
                <StateBlock state="empty" compact locale={fmtLocale} title={t('gov.empty')} />
              ) : (
                <div className="divide-y divide-[var(--ds-border-hairline)]">
                  {violations.map((row) => {
                    const left = hoursLeft(row.slaDeadline)
                    const fineFormatted = Number.isSafeInteger(row.fineAmountMinor)
                      ? formatKwd(row.fineAmountMinor / 1000, { locale: fmtLocale })
                      : UNAVAILABLE_DASH
                    return (
                      <article
                        key={row.id}
                        className="py-3.5 text-sm text-slate-900 dark:text-slate-100"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <strong dir="ltr" className="ds-num">
                            {row.violationNumber}
                          </strong>
                          <span>{row.issuingAuthority}</span>
                          <span>{row.assignedEmployeeName}</span>
                          <span
                            dir="ltr"
                            title={
                              fineFormatted === UNAVAILABLE_DASH ? unavailableTooltip : undefined
                            }
                            className="ds-num rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800 dark:bg-white/[0.06] dark:text-slate-200"
                          >
                            {fineFormatted}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
                            {t(`desk.stage.${row.workflowStage}` as MessageKey)}
                          </span>
                          {row.neglected ? (
                            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-900 dark:bg-rose-950/70 dark:text-rose-200">
                              {t('desk.neglect')}
                            </span>
                          ) : null}
                          {row.workflowStage === 'closed_verified' ? null : (
                            <span dir="ltr" className="ds-num text-xs font-semibold">
                              {left === null
                                ? UNAVAILABLE_DASH
                                : left < 0
                                  ? t('desk.overdue')
                                  : `${formatInt(left, fmtLocale)} ${t('desk.hours')}`}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-slate-600 dark:text-slate-300">
                          {row.violationTypeAr}
                        </p>
                        {row.employeeStatementAr ? (
                          <p className="mt-1 text-slate-800 dark:text-slate-200">
                            {row.employeeStatementAr}
                          </p>
                        ) : null}
                        {row.closureProofDocUrl ? (
                          <p
                            dir="ltr"
                            className="mt-1 break-all text-xs text-slate-600 dark:text-slate-400"
                          >
                            {row.closureProofDocUrl}
                          </p>
                        ) : null}
                        {canViolation && row.workflowStage !== 'closed_verified' ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {row.workflowStage === 'assigned' ||
                            row.workflowStage === 'escalated_neglect' ? (
                              <>
                                <input
                                  className={`${inputCls} mt-0 sm:max-w-xs`}
                                  value={statement}
                                  onChange={(event) => setStatement(event.target.value)}
                                  placeholder={t('desk.statement')}
                                  aria-label={t('desk.statement')}
                                />
                                <button
                                  className={primaryBtnCls}
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void post(
                                      `/api/v1/governance/violations/${row.id}`,
                                      {
                                        action: 'statement',
                                        version: row.version,
                                        statementAr: statement,
                                      },
                                      false,
                                    )
                                  }
                                >
                                  {t('desk.statement')}
                                </button>
                              </>
                            ) : null}
                            {row.workflowStage === 'statement_submitted' ? (
                              <button
                                className={secondaryBtnCls}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void post(
                                    `/api/v1/governance/violations/${row.id}`,
                                    { action: 'remediate', version: row.version },
                                    false,
                                  )
                                }
                              >
                                {t('desk.remediate')}
                              </button>
                            ) : null}
                            {row.workflowStage === 'in_remediation' ? (
                              <>
                                <input
                                  className={`${inputCls} mt-0 sm:max-w-xs`}
                                  dir="ltr"
                                  value={proof}
                                  onChange={(event) => setProof(event.target.value)}
                                  aria-label={t('desk.proof')}
                                />
                                <button
                                  className={primaryBtnCls}
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void post(
                                      `/api/v1/governance/violations/${row.id}`,
                                      {
                                        action: 'proof',
                                        version: row.version,
                                        proofRef: proof,
                                      },
                                      false,
                                    )
                                  }
                                >
                                  {t('desk.proof')}
                                </button>
                              </>
                            ) : null}
                            {row.workflowStage === 'proof_uploaded' ? (
                              <button
                                className={primaryBtnCls}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void post(
                                    `/api/v1/governance/violations/${row.id}`,
                                    { action: 'close', version: row.version },
                                    false,
                                  )
                                }
                              >
                                {t('desk.close')}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {tab === 'inquiry' ? (
            <div className="space-y-4">
              {canInquiry ? (
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void post(
                      '/api/v1/governance/investigations',
                      {
                        caseNumber,
                        sourceType: 'manager_referral',
                        sourceReferenceId: null,
                        subjectEmployeeName: subject,
                        investigatorName: 'لجنة التقصي الداخلية',
                        incidentSummaryAr: summary,
                        evidenceRef: null,
                      },
                      true,
                    )
                  }}
                >
                  <label className={labelCls}>
                    {t('desk.case')}
                    <input
                      className={inputCls}
                      required
                      value={caseNumber}
                      onChange={(event) => setCaseNumber(event.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    {t('desk.subject')}
                    <input
                      className={inputCls}
                      required
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                    />
                  </label>
                  <label className={`${labelCls} sm:col-span-2`}>
                    {t('desk.summary')}
                    <input
                      className={inputCls}
                      required
                      value={summary}
                      onChange={(event) => setSummary(event.target.value)}
                    />
                  </label>
                  <div className="flex items-end">
                    <button className={primaryBtnCls} type="submit" disabled={busy}>
                      {t('desk.open')}
                    </button>
                  </div>
                </form>
              ) : null}

              {inquiries.length === 0 ? (
                <StateBlock state="empty" compact locale={fmtLocale} title={t('gov.empty')} />
              ) : (
                <div className="divide-y divide-[var(--ds-border-hairline)]">
                  {inquiries.map((row) => (
                    <article
                      key={row.id}
                      className="py-3.5 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <div className="flex flex-wrap gap-3">
                        <strong dir="ltr" className="ds-num">
                          {row.caseNumber}
                        </strong>
                        <span>{row.subjectEmployeeName}</span>
                        <span>{row.investigatorName}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
                          {t(`desk.inquiry.${row.status}` as MessageKey)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-slate-600 dark:text-slate-300">
                        {row.incidentSummaryAr}
                      </p>
                      {row.statements.map((item) => (
                        <p key={item.questionAr} className="mt-1">
                          {item.questionAr} — {item.answerAr}
                        </p>
                      ))}
                      {row.legalFindingAr ? (
                        <p className="mt-1">
                          {row.legalFindingAr} — {row.recommendedDisciplinaryActionAr}
                        </p>
                      ) : null}
                      {row.managerFinalDecision ? (
                        <p className="mt-1 font-medium">{row.managerFinalDecision}</p>
                      ) : null}
                      {canInquiry && row.status !== 'closed_enforced' ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {row.status === 'open_summons' ||
                          row.status === 'hearing_in_progress' ? (
                            <>
                              <input
                                className={`${inputCls} mt-0 sm:max-w-xs`}
                                value={question}
                                onChange={(event) => setQuestion(event.target.value)}
                                placeholder={t('desk.question')}
                                aria-label={t('desk.question')}
                              />
                              <input
                                className={`${inputCls} mt-0 sm:max-w-xs`}
                                value={answer}
                                onChange={(event) => setAnswer(event.target.value)}
                                placeholder={t('desk.answer')}
                                aria-label={t('desk.answer')}
                              />
                              <button
                                className={secondaryBtnCls}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void post(
                                    `/api/v1/governance/investigations/${row.id}`,
                                    {
                                      action: 'statement',
                                      version: row.version,
                                      questionAr: question,
                                      answerAr: answer,
                                    },
                                    false,
                                  )
                                }
                              >
                                {t('desk.ask')}
                              </button>
                            </>
                          ) : null}
                          {row.status === 'hearing_in_progress' ? (
                            <>
                              <input
                                className={`${inputCls} mt-0 sm:max-w-xs`}
                                value={finding}
                                onChange={(event) => setFinding(event.target.value)}
                                placeholder={t('desk.finding')}
                                aria-label={t('desk.finding')}
                              />
                              <button
                                className={primaryBtnCls}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void post(
                                    `/api/v1/governance/investigations/${row.id}`,
                                    {
                                      action: 'finding',
                                      version: row.version,
                                      legalFindingAr: finding,
                                      recommendedDisciplinaryActionAr: 'إنذار كتابي',
                                    },
                                    false,
                                  )
                                }
                              >
                                {t('desk.finding')}
                              </button>
                            </>
                          ) : null}
                          {row.status === 'awaiting_manager_ruling' ? (
                            <>
                              <input
                                className={`${inputCls} mt-0 sm:max-w-xs`}
                                value={ruling}
                                onChange={(event) => setRuling(event.target.value)}
                                placeholder={t('desk.ruling')}
                                aria-label={t('desk.ruling')}
                              />
                              <button
                                className={primaryBtnCls}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void post(
                                    `/api/v1/governance/investigations/${row.id}`,
                                    {
                                      action: 'ruling',
                                      version: row.version,
                                      managerFinalDecision: ruling,
                                    },
                                    false,
                                  )
                                }
                              >
                                {t('desk.ruling')}
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === 'monitor' ? (
            <div className="space-y-4">
              {devices.length === 0 ? (
                <StateBlock state="empty" compact locale={fmtLocale} title={t('gov.empty')} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="ds-surface-subtle rounded-xl p-3 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <p className="font-semibold">{device.deviceName}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {t(`desk.device.${device.deviceType}` as MessageKey)} —{' '}
                        {device.status === 'online' ? t('desk.online') : t('desk.offline')}
                      </p>
                      <p
                        dir="ltr"
                        className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400"
                      >
                        {device.ipOrStreamUrl}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {canMonitor && devices[0] ? (
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void post(
                      '/api/v1/governance/monitoring',
                      {
                        deviceId: devices[0].id,
                        employeeName: noteName,
                        violationCategory: 'uniform_violation',
                        aiConfidenceScore: 80,
                        snapshotEvidenceRef: 'archive:supervisor-note',
                        noteAr: note,
                      },
                      true,
                    )
                  }}
                >
                  <label className={labelCls}>
                    {t('desk.employee')}
                    <input
                      className={inputCls}
                      required
                      value={noteName}
                      onChange={(event) => setNoteName(event.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    {t('desk.note')}
                    <input
                      className={inputCls}
                      required
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>
                  <div className="flex items-end">
                    <button className={secondaryBtnCls} type="submit" disabled={busy}>
                      {t('desk.log')}
                    </button>
                  </div>
                </form>
              ) : null}

              {events.length === 0 ? (
                <StateBlock state="empty" compact locale={fmtLocale} title={t('gov.empty')} />
              ) : (
                <div className="divide-y divide-[var(--ds-border-hairline)]">
                  {events.map((row) => (
                    <article
                      key={row.id}
                      className="flex flex-wrap items-center gap-3 py-3 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <span className="font-semibold">{row.employeeName}</span>
                      <span>{t(`desk.cat.${row.violationCategory}` as MessageKey)}</span>
                      <span dir="ltr" className="ds-num text-xs font-semibold">
                        {formatInt(row.aiConfidenceScore, fmtLocale)}
                      </span>
                      <span>{row.deviceName}</span>
                      <span>{row.autoActionTakenAr}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
                        {t(`desk.event.${row.status}` as MessageKey)}
                      </span>
                      {canInquiry && row.status === 'detected' ? (
                        <button
                          className={primaryBtnCls}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void post(
                              `/api/v1/governance/monitoring/${row.id}/convert`,
                              {
                                version: row.version,
                                investigatorName: 'لجنة التقصي الداخلية',
                              },
                              true,
                            )
                          }
                        >
                          {t('desk.convert')}
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === 'tasks' ? (
            tasks.length === 0 ? (
              <StateBlock state="empty" compact locale={fmtLocale} title={t('gov.empty')} />
            ) : (
              <div className="divide-y divide-[var(--ds-border-hairline)]">
                {tasks.map((row) => (
                  <article
                    key={row.id}
                    className="py-3.5 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <strong>{row.titleAr}</strong>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                        {t(`desk.severity.${row.severity}` as MessageKey)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
                        {t(`desk.task.${row.status}` as MessageKey)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-slate-600 dark:text-slate-300">
                      {row.aiRecommendationAr}
                    </p>
                    <p className="mt-1">{row.taskInstructionAr}</p>
                    {row.assignedToEmployee ? (
                      <p className="mt-1">
                        {row.assignedToEmployee} —{' '}
                        <span dir="ltr" className="ds-num">
                          {formatDate(row.dueDate, fmtLocale)}
                        </span>
                      </p>
                    ) : null}
                    {row.employeeCompletionReportAr ? (
                      <p className="mt-1">{row.employeeCompletionReportAr}</p>
                    ) : null}
                    {canTask && row.status !== 'completed_verified' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.status === 'alert_pending' ? (
                          <>
                            <input
                              className={`${inputCls} mt-0 sm:max-w-xs`}
                              value={assignee}
                              onChange={(event) => setAssignee(event.target.value)}
                              placeholder={t('desk.assignee')}
                              aria-label={t('desk.assignee')}
                            />
                            <input
                              className={`${inputCls} mt-0 sm:max-w-xs`}
                              value={instruction}
                              onChange={(event) => setInstruction(event.target.value)}
                              placeholder={t('desk.instruction')}
                              aria-label={t('desk.instruction')}
                            />
                            <input
                              className={`${inputCls} mt-0 sm:max-w-[11rem]`}
                              dir="ltr"
                              type="date"
                              value={due}
                              onChange={(event) => setDue(event.target.value)}
                              aria-label={t('desk.deadline')}
                            />
                            <button
                              className={primaryBtnCls}
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void post(
                                  `/api/v1/governance/tasks/${row.id}`,
                                  {
                                    action: 'dispatch',
                                    version: row.version,
                                    assignedToEmployee: assignee,
                                    taskInstructionAr: instruction,
                                    dueDate: due,
                                  },
                                  false,
                                )
                              }
                            >
                              {t('desk.dispatch')}
                            </button>
                          </>
                        ) : null}
                        {row.status === 'task_dispatched' ? (
                          <button
                            className={secondaryBtnCls}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void post(
                                `/api/v1/governance/tasks/${row.id}`,
                                { action: 'progress', version: row.version },
                                false,
                              )
                            }
                          >
                            {t('desk.progress')}
                          </button>
                        ) : null}
                        {row.status === 'in_progress' ? (
                          <>
                            <input
                              className={`${inputCls} mt-0 sm:max-w-xs`}
                              value={report}
                              onChange={(event) => setReport(event.target.value)}
                              placeholder={t('desk.report')}
                              aria-label={t('desk.report')}
                            />
                            <button
                              className={primaryBtnCls}
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void post(
                                  `/api/v1/governance/tasks/${row.id}`,
                                  {
                                    action: 'complete',
                                    version: row.version,
                                    employeeCompletionReportAr: report,
                                  },
                                  false,
                                )
                              }
                            >
                              {t('desk.finish')}
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )
          ) : null}

          {tab === 'gate' ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">
                {t('gov.tab.gatekeeper')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {t('gov.gate.residency')}
              </p>
              {hrAlerts.length === 0 ? (
                <StateBlock state="empty" compact locale={fmtLocale} title={t('gov.empty')} />
              ) : (
                <div className="divide-y divide-rose-500/20">
                  {hrAlerts.slice(0, 50).map((row) => (
                    <p
                      key={row.id}
                      className="py-2 text-sm text-rose-900 dark:text-rose-200"
                    >
                      {row.fullName} — {t('gov.gate.expired')}{' '}
                      <span dir="ltr" className="ds-num">
                        {row.residencyExpiry
                          ? formatDate(row.residencyExpiry, fmtLocale)
                          : UNAVAILABLE_DASH}
                      </span>
                      {row.workLocation ? ` · ${row.workLocation}` : ''}
                    </p>
                  ))}
                </div>
              )}

              <p className="mt-4 text-xs text-slate-600 dark:text-slate-300">
                {t('gov.gate.license')}
              </p>
              {violations
                .filter((row) =>
                  /رخص|license|فرع|بلدية/i.test(`${row.violationTypeAr} ${row.issuingAuthority}`),
                )
                .slice(0, 12)
                .map((row) => (
                  <p
                    key={row.id}
                    className="border-t border-amber-500/20 py-2 text-sm text-amber-900 dark:text-amber-200"
                  >
                    <span dir="ltr" className="ds-num font-semibold">
                      {row.violationNumber}
                    </span>{' '}
                    — {row.violationTypeAr} · {row.issuingAuthority}
                  </p>
                ))}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  )
}

export default function GovernanceDesk({
  permissions: held,
  initialTab,
  initialPhase,
  initialError,
  initialData,
}: {
  permissions: readonly string[]
  initialTab: string
  initialPhase?: 'loading' | 'ready' | 'error'
  initialError?: MessageKey
  initialData?: GovernanceDeskInitialData
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace
        initialTab={initialTab}
        initialPhase={initialPhase}
        initialError={initialError}
        initialData={initialData}
      />
    </PermissionProvider>
  )
}
