'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor, parseKwdToMinor } from '@/lib/money'
import type { ConnectedDevice, ExecutiveTask, GovViolation, Investigation, MonitorEvent } from '@/modules/governance/client'

type Tab = 'violations' | 'inquiry' | 'monitor' | 'tasks'
const tabs: readonly Tab[] = ['violations', 'inquiry', 'monitor', 'tasks']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function hoursLeft(sla: string): number {
  return Math.floor((Date.parse(`${sla}T23:59:59.999Z`) - Date.now()) / 3_600_000)
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t } = useI18n()
  const canViolation = useCan(permissions.govViolationManage)
  const canInquiry = useCan(permissions.govInquiryManage)
  const canMonitor = useCan(permissions.govMonitorManage)
  const canTask = useCan(permissions.govTaskDispatch)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'violations')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [detail, setDetail] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [violations, setViolations] = useState<GovViolation[]>([])
  const [inquiries, setInquiries] = useState<Investigation[]>([])
  const [devices, setDevices] = useState<ConnectedDevice[]>([])
  const [events, setEvents] = useState<MonitorEvent[]>([])
  const [tasks, setTasks] = useState<ExecutiveTask[]>([])
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

  function fail(caught: unknown) {
    if (caught instanceof ApiError) {
      setDetail(caught.message)
      setError('erp.err.generic')
      return
    }
    setDetail(null)
    setError(errorKey(caught))
  }

  const [reloadToken, setReloadToken] = useState(0)

  function load() {
    setReloadToken((current) => current + 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: GovViolation[] }>('/api/v1/governance/violations', { signal: controller.signal }),
      apiRequest<{ data: Investigation[] }>('/api/v1/governance/investigations', { signal: controller.signal }),
      apiRequest<{ data: { devices: ConnectedDevice[]; events: MonitorEvent[] } }>('/api/v1/governance/monitoring', { signal: controller.signal }),
      apiRequest<{ data: ExecutiveTask[] }>('/api/v1/governance/tasks', { signal: controller.signal }),
    ])
      .then(([violationPage, inquiryPage, monitorPage, taskPage]) => {
        setViolations(violationPage.data)
        setInquiries(inquiryPage.data)
        setDevices(monitorPage.data.devices)
        setEvents(monitorPage.data.events)
        setTasks(taskPage.data)
        setPhase('ready')
        setDetail(null)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        if (caught instanceof ApiError) {
          setDetail(caught.message)
          setError('erp.err.generic')
        } else {
          setDetail(null)
          setError(errorKey(caught))
        }
        setPhase('error')
      })
    return () => controller.abort()
  }, [reloadToken])

  async function post(path: string, body: unknown, idempotent: boolean) {
    setBusy(true)
    setNotice(null)
    setDetail(null)
    try {
      await apiRequest(path, { method: 'POST', body, idempotencyKey: idempotent ? newIdempotencyKey() : undefined })
      setNotice(t('gov.saved'))
      load()
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
    }
  }

  function addViolation(event: FormEvent) {
    event.preventDefault()
    const amount = parseKwdToMinor(fine)
    if (amount === null) {
      setError('erp.err.generic')
      return
    }
    void post('/api/v1/governance/violations', {
      violationNumber: number,
      issuingAuthority: 'بلدية الكويت',
      branchId: null,
      violationTypeAr: kind,
      fineAmountMinor: amount,
      assignedEmployeeName: ownerName,
      slaDeadline: deadline,
    }, true)
  }

  const kwd = t('admin.kwd')
  if (phase === 'loading') return <p className="text-sm text-gray-400">{t('gov.loading')}</p>
  if (phase === 'error') return <p className={errorClass} role="alert">{detail ?? t(error)}</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('desk.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">{t('desk.lead')}</p>
      </header>
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      {detail ? <p className={errorClass} role="alert">{detail}</p> : null}
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} className={tab === item ? primaryButton : secondaryButton} type="button" onClick={() => setTab(item)}>{t(`desk.tab.${item}` as MessageKey)}</button>
        ))}
      </div>

      {tab === 'violations' ? (
        <section className={panelClass}>
          {canViolation ? (
            <form className="mb-4 grid gap-3 sm:grid-cols-2" onSubmit={addViolation}>
              <label className={labelClass}>{t('desk.number')}<input className={inputClass} required value={number} onChange={(event) => setNumber(event.target.value)} /></label>
              <label className={labelClass}>{t('desk.kind')}<input className={inputClass} required value={kind} onChange={(event) => setKind(event.target.value)} /></label>
              <label className={labelClass}>{t('desk.employee')}<input className={inputClass} required value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /></label>
              <label className={labelClass}>{t('desk.fine')}<input className={inputClass} required value={fine} onChange={(event) => setFine(event.target.value)} /></label>
              <label className={labelClass}>{t('desk.deadline')}<input className={inputClass} type="date" required value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
              <div className="flex items-end"><button className={primaryButton} type="submit" disabled={busy}>{t('desk.register')}</button></div>
            </form>
          ) : null}
          {violations.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : violations.map((row) => {
            const left = hoursLeft(row.slaDeadline)
            return (
              <article key={row.id} className="border-t border-[#30363d] py-3 text-sm text-gray-100">
                <div className="flex flex-wrap items-center gap-3">
                  <strong>{row.violationNumber}</strong>
                  <span>{row.issuingAuthority}</span>
                  <span>{row.assignedEmployeeName}</span>
                  <span>{formatMinor(row.fineAmountMinor)} {kwd}</span>
                  <span>{t(`desk.stage.${row.workflowStage}` as MessageKey)}</span>
                  {row.neglected ? <span className="rounded bg-red-900 px-2 py-1 text-red-100">{t('desk.neglect')}</span> : null}
                  {row.workflowStage === 'closed_verified' ? null : <span>{left < 0 ? t('desk.overdue') : `${left} ${t('desk.hours')}`}</span>}
                </div>
                <p className="mt-1 text-gray-400">{row.violationTypeAr}</p>
                {row.employeeStatementAr ? <p className="mt-1">{row.employeeStatementAr}</p> : null}
                {row.closureProofDocUrl ? <p className="mt-1 text-gray-400">{row.closureProofDocUrl}</p> : null}
                {canViolation && row.workflowStage !== 'closed_verified' ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.workflowStage === 'assigned' || row.workflowStage === 'escalated_neglect' ? (
                      <>
                        <input className={inputClass} value={statement} onChange={(event) => setStatement(event.target.value)} placeholder={t('desk.statement')} />
                        <button className={primaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/violations/${row.id}`, { action: 'statement', version: row.version, statementAr: statement }, false)}>{t('desk.statement')}</button>
                      </>
                    ) : null}
                    {row.workflowStage === 'statement_submitted' ? <button className={secondaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/violations/${row.id}`, { action: 'remediate', version: row.version }, false)}>{t('desk.remediate')}</button> : null}
                    {row.workflowStage === 'in_remediation' ? (
                      <>
                        <input className={inputClass} value={proof} onChange={(event) => setProof(event.target.value)} />
                        <button className={primaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/violations/${row.id}`, { action: 'proof', version: row.version, proofRef: proof }, false)}>{t('desk.proof')}</button>
                      </>
                    ) : null}
                    {row.workflowStage === 'proof_uploaded' ? <button className={primaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/violations/${row.id}`, { action: 'close', version: row.version }, false)}>{t('desk.close')}</button> : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </section>
      ) : null}

      {tab === 'inquiry' ? (
        <section className={panelClass}>
          {canInquiry ? (
            <form className="mb-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void post('/api/v1/governance/investigations', { caseNumber, sourceType: 'manager_referral', sourceReferenceId: null, subjectEmployeeName: subject, investigatorName: 'لجنة التقصي الداخلية', incidentSummaryAr: summary, evidenceRef: null }, true) }}>
              <label className={labelClass}>{t('desk.case')}<input className={inputClass} required value={caseNumber} onChange={(event) => setCaseNumber(event.target.value)} /></label>
              <label className={labelClass}>{t('desk.subject')}<input className={inputClass} required value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
              <label className={`${labelClass} sm:col-span-2`}>{t('desk.summary')}<input className={inputClass} required value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
              <div className="flex items-end"><button className={primaryButton} type="submit" disabled={busy}>{t('desk.open')}</button></div>
            </form>
          ) : null}
          {inquiries.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : inquiries.map((row) => (
            <article key={row.id} className="border-t border-[#30363d] py-3 text-sm text-gray-100">
              <div className="flex flex-wrap gap-3"><strong>{row.caseNumber}</strong><span>{row.subjectEmployeeName}</span><span>{row.investigatorName}</span><span>{t(`desk.inquiry.${row.status}` as MessageKey)}</span></div>
              <p className="mt-1 text-gray-400">{row.incidentSummaryAr}</p>
              {row.statements.map((item) => <p key={item.questionAr} className="mt-1">{item.questionAr} — {item.answerAr}</p>)}
              {row.legalFindingAr ? <p className="mt-1">{row.legalFindingAr} — {row.recommendedDisciplinaryActionAr}</p> : null}
              {row.managerFinalDecision ? <p className="mt-1">{row.managerFinalDecision}</p> : null}
              {canInquiry && row.status !== 'closed_enforced' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.status === 'open_summons' || row.status === 'hearing_in_progress' ? (
                    <>
                      <input className={inputClass} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t('desk.question')} />
                      <input className={inputClass} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={t('desk.answer')} />
                      <button className={secondaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/investigations/${row.id}`, { action: 'statement', version: row.version, questionAr: question, answerAr: answer }, false)}>{t('desk.ask')}</button>
                    </>
                  ) : null}
                  {row.status === 'hearing_in_progress' ? (
                    <>
                      <input className={inputClass} value={finding} onChange={(event) => setFinding(event.target.value)} placeholder={t('desk.finding')} />
                      <button className={primaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/investigations/${row.id}`, { action: 'finding', version: row.version, legalFindingAr: finding, recommendedDisciplinaryActionAr: 'إنذار كتابي' }, false)}>{t('desk.finding')}</button>
                    </>
                  ) : null}
                  {row.status === 'awaiting_manager_ruling' ? (
                    <>
                      <input className={inputClass} value={ruling} onChange={(event) => setRuling(event.target.value)} placeholder={t('desk.ruling')} />
                      <button className={primaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/investigations/${row.id}`, { action: 'ruling', version: row.version, managerFinalDecision: ruling }, false)}>{t('desk.ruling')}</button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {tab === 'monitor' ? (
        <section className={panelClass}>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {devices.map((device) => (
              <p key={device.id} className="rounded border border-[#30363d] p-3 text-sm text-gray-100">
                {device.deviceName}
                <span className="mt-1 block text-gray-400">{t(`desk.device.${device.deviceType}` as MessageKey)} — {device.status === 'online' ? t('desk.online') : t('desk.offline')}</span>
                <span className="mt-1 block text-gray-500">{device.ipOrStreamUrl}</span>
              </p>
            ))}
          </div>
          {canMonitor && devices[0] ? (
            <form className="mb-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void post('/api/v1/governance/monitoring', { deviceId: devices[0].id, employeeName: noteName, violationCategory: 'uniform_violation', aiConfidenceScore: 80, snapshotEvidenceRef: 'archive:supervisor-note', noteAr: note }, true) }}>
              <label className={labelClass}>{t('desk.employee')}<input className={inputClass} required value={noteName} onChange={(event) => setNoteName(event.target.value)} /></label>
              <label className={labelClass}>{t('desk.note')}<input className={inputClass} required value={note} onChange={(event) => setNote(event.target.value)} /></label>
              <div className="flex items-end"><button className={secondaryButton} type="submit" disabled={busy}>{t('desk.log')}</button></div>
            </form>
          ) : null}
          {events.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : events.map((row) => (
            <article key={row.id} className="flex flex-wrap items-center gap-3 border-t border-[#30363d] py-3 text-sm text-gray-100">
              <span>{row.employeeName}</span>
              <span>{t(`desk.cat.${row.violationCategory}` as MessageKey)}</span>
              <span>{row.aiConfidenceScore}</span>
              <span>{row.deviceName}</span>
              <span>{row.autoActionTakenAr}</span>
              <span>{t(`desk.event.${row.status}` as MessageKey)}</span>
              {canInquiry && row.status === 'detected' ? (
                <button className={primaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/monitoring/${row.id}/convert`, { version: row.version, investigatorName: 'لجنة التقصي الداخلية' }, true)}>{t('desk.convert')}</button>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {tab === 'tasks' ? (
        <section className={panelClass}>
          {tasks.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : tasks.map((row) => (
            <article key={row.id} className="border-t border-[#30363d] py-3 text-sm text-gray-100">
              <div className="flex flex-wrap gap-3"><strong>{row.titleAr}</strong><span>{t(`desk.severity.${row.severity}` as MessageKey)}</span><span>{t(`desk.task.${row.status}` as MessageKey)}</span></div>
              <p className="mt-1 text-gray-400">{row.aiRecommendationAr}</p>
              <p className="mt-1">{row.taskInstructionAr}</p>
              {row.assignedToEmployee ? <p className="mt-1">{row.assignedToEmployee} — {row.dueDate}</p> : null}
              {row.employeeCompletionReportAr ? <p className="mt-1">{row.employeeCompletionReportAr}</p> : null}
              {canTask && row.status !== 'completed_verified' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.status === 'alert_pending' ? (
                    <>
                      <input className={inputClass} value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder={t('desk.assignee')} />
                      <input className={inputClass} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={t('desk.instruction')} />
                      <input className={inputClass} type="date" value={due} onChange={(event) => setDue(event.target.value)} />
                      <button className={primaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/tasks/${row.id}`, { action: 'dispatch', version: row.version, assignedToEmployee: assignee, taskInstructionAr: instruction, dueDate: due }, false)}>{t('desk.dispatch')}</button>
                    </>
                  ) : null}
                  {row.status === 'task_dispatched' ? <button className={secondaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/tasks/${row.id}`, { action: 'progress', version: row.version }, false)}>{t('desk.progress')}</button> : null}
                  {row.status === 'in_progress' ? (
                    <>
                      <input className={inputClass} value={report} onChange={(event) => setReport(event.target.value)} placeholder={t('desk.report')} />
                      <button className={primaryButton} type="button" disabled={busy} onClick={() => void post(`/api/v1/governance/tasks/${row.id}`, { action: 'complete', version: row.version, employeeCompletionReportAr: report }, false)}>{t('desk.finish')}</button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  )
}

export default function GovernanceDesk({ permissions: held, initialTab }: { permissions: readonly string[]; initialTab: string }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} />
    </PermissionProvider>
  )
}
