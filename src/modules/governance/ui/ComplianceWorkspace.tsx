'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, apiRequest, errorKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { BlockedAttempt, Circular, EnforcementRule, LearningMemory } from '@/modules/governance/client'

type Tab = 'laws' | 'gate' | 'memory'
const tabs: readonly Tab[] = ['laws', 'gate', 'memory']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

type ActionType = 'delivery.assign_driver' | 'hr.attendance.hours' | 'hr.expense.cash'

function Workspace({ initialTab }: { initialTab: string }) {
  const { t } = useI18n()
  const canEnforce = useCan(permissions.govComplianceEnforce)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'laws')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [circulars, setCirculars] = useState<Circular[]>([])
  const [rules, setRules] = useState<EnforcementRule[]>([])
  const [blocks, setBlocks] = useState<BlockedAttempt[]>([])
  const [memory, setMemory] = useState<LearningMemory[]>([])
  const [action, setAction] = useState<ActionType>('delivery.assign_driver')

  function load() {
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: Circular[] }>('/api/v1/governance/circulars', { signal: controller.signal }),
      apiRequest<{ data: EnforcementRule[] }>('/api/v1/governance/rules', { signal: controller.signal }),
      apiRequest<{ data: BlockedAttempt[] }>('/api/v1/governance/blocks', { signal: controller.signal }),
      apiRequest<{ data: LearningMemory[] }>('/api/v1/governance/memory', { signal: controller.signal }),
    ])
      .then(([circularPage, rulePage, blockPage, memoryPage]) => {
        setCirculars(circularPage.data)
        setRules(rulePage.data)
        setBlocks(blockPage.data)
        setMemory(memoryPage.data)
        setError(null)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }

  useEffect(() => load(), [])

  async function enforce(circular: Circular) {
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/governance/circulars/${circular.id}/enforce`, { method: 'POST', body: { version: circular.version } })
      setNotice(t('gov.saved'))
      load()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function simulate(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    const body = action === 'delivery.assign_driver'
      ? { actionType: action, licenseExpiry: '2020-01-01' }
      : action === 'hr.attendance.hours'
        ? { actionType: action, workedMinutes: 9 * 60 }
        : { actionType: action, cashMinor: 80_000 }
    try {
      await apiRequest('/api/v1/governance/compliance/simulate', { method: 'POST', body })
      setNotice(t('gov.allowed'))
      load()
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'compliance_blocked') {
        setNotice(caught.message)
        load()
      } else {
        setError(errorKey(caught))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-50">{t('hub.compliance')}</h1>
      </header>
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} type="button" className={item === tab ? primaryButton : 'rounded-md px-3 py-2 text-sm text-gray-300'} onClick={() => setTab(item)}>{t(`gov.tab.${item}` as MessageKey)}</button>
        ))}
      </div>
      {phase === 'loading' ? <p className="text-sm text-gray-400">{t('gov.loading')}</p> : null}
      {error ? <p className={errorClass}>{t(error)}</p> : null}
      {notice ? <p className={noticeClass} role="alert">{notice}</p> : null}
      {phase === 'ready' && tab === 'laws' ? (
        <section className={panelClass}>
          {circulars.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : circulars.map((circular) => (
            <article key={circular.id} className="border-t border-[#30363d] py-3 text-sm text-gray-100">
              <p>{circular.authorityName} — {circular.regulationCode}</p>
              <p>{circular.titleAr}</p>
              <p className="text-gray-400">{t('gov.department')}: {circular.targetDepartment}</p>
              <p>{circular.aiRecommendationAr}</p>
              <p>{circular.status}</p>
              {canEnforce && circular.status === 'pending' ? (
                <button className={`${primaryButton} mt-2`} type="button" disabled={busy} onClick={() => void enforce(circular)}>{t('gov.enforce')}</button>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
      {phase === 'ready' && tab === 'gate' ? (
        <section className={panelClass}>
          {canEnforce ? (
            <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(event) => void simulate(event)}>
              <label className={labelClass}>{t('gov.rule')}
                <select className={inputClass} value={action} onChange={(event) => setAction(event.target.value as ActionType)}>
                  <option value="delivery.assign_driver">{t('gov.action.license')}</option>
                  <option value="hr.attendance.hours">{t('gov.action.hours')}</option>
                  <option value="hr.expense.cash">{t('gov.action.cash')}</option>
                </select>
              </label>
              <button className={primaryButton} type="submit" disabled={busy}>{t('gov.simulate')}</button>
            </form>
          ) : null}
          {rules.map((rule) => (
            <p key={rule.id} className="text-sm text-gray-100">{rule.ruleCode} — {rule.ruleType} — {rule.ruleType === 'cash_ceiling_kwd' ? `${formatMinor(rule.thresholdValue)} ${t('currency')}` : rule.thresholdValue} — {rule.isActive ? t('gov.active') : t('gov.inactive')}</p>
          ))}
          <div className="mt-4">
            {blocks.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : blocks.map((block) => (
              <p key={block.id} className="border-t border-[#30363d] py-2 text-sm text-gray-100">{block.actorName} — {block.blockMessageAr}</p>
            ))}
          </div>
        </section>
      ) : null}
      {phase === 'ready' && tab === 'memory' ? (
        <section className={panelClass}>
          {memory.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : memory.map((row) => (
            <article key={row.id} className="border-t border-[#30363d] py-3 text-sm text-gray-100">
              <p>{row.contextDomain} — {row.confidenceScore}</p>
              <p>{row.managerDecisionPattern}</p>
              <p className="text-gray-400">{row.recurringIssueDetected}</p>
              <p>{row.learnedWeightAdjustment}</p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  )
}

export default function ComplianceWorkspace({ permissions: held, initialTab }: { permissions: readonly string[]; initialTab: string }) {
  return <PermissionProvider permissions={held}><Workspace initialTab={initialTab} /></PermissionProvider>
}
