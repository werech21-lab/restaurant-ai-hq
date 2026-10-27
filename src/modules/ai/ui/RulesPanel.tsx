'use client'

import { useEffect, useState } from 'react'
import { ApiError, apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { Phase } from '@/components/erp/common'
import { errorClass, inputClass, labelClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Badge } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { AutomationRule } from '@/modules/ai/client'
import { actionLabels } from '@/modules/ai/ui/labels'

function conditionText(rule: AutomationRule): string {
  return JSON.stringify(rule.conditionJson, null, 2)
}

type RowProps = {
  rule: AutomationRule
  onSaved: (rule: AutomationRule) => void
  onStale: () => void
}

function RuleRow({ rule, onSaved, onStale }: RowProps) {
  const { t } = useI18n()
  const [name, setName] = useState(rule.name)
  const [active, setActive] = useState(rule.isActive)
  const [condition, setCondition] = useState(conditionText(rule))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // A newer version of the rule (after a save or a reload) replaces what is typed.
  useEffect(() => {
    setName(rule.name)
    setActive(rule.isActive)
    setCondition(conditionText(rule))
  }, [rule])

  const dirty = name !== rule.name || active !== rule.isActive || condition !== conditionText(rule)

  async function save() {
    let parsed: unknown
    try {
      parsed = JSON.parse(condition)
    } catch {
      setError(t('ai.rules.jsonInvalid'))
      return
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setError(t('ai.rules.jsonInvalid'))
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const result = await apiRequest<{ data: AutomationRule }>(`/api/v1/ai/rules/${rule.id}`, {
        method: 'PUT',
        body: { version: rule.version, name: name.trim(), isActive: active, conditionJson: parsed },
      })
      setSaved(true)
      onSaved(result.data)
    } catch (failure) {
      // The server's text says which limit is wrong. Every other failure uses the standard messages.
      if (failure instanceof ApiError && failure.code === 'condition_invalid') {
        setError(`${t('ai.err.condition_invalid')} ${failure.message}`)
      } else {
        setError(t(errorKey(failure)))
        if (failure instanceof ApiError && failure.code === 'version_conflict') onStale()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="rounded-xl border border-[#30363d] bg-[#1c2128] p-4" data-rule-key={rule.ruleKey}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{t(actionLabels[rule.actionType])}</Badge>
        <span dir="ltr" className="text-xs text-gray-500">
          {rule.ruleKey}
        </span>
      </div>
      <p className="mt-2 text-sm leading-7 text-gray-400">{rule.descriptionAr}</p>
      <p className="mt-1 text-xs text-gray-500">
        {t('ai.rules.trigger')}: <span dir="ltr">{rule.triggerEvent}</span>
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className={labelClass}>
          {t('ai.rules.name')}
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} className={inputClass} disabled={saving} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-gray-200">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={saving} className="h-4 w-4" />
          {t('ai.rules.active')}
        </label>
      </div>
      <label className={`${labelClass} mt-3 block`}>
        {t('ai.rules.condition')}
        <textarea
          dir="ltr"
          value={condition}
          onChange={(event) => setCondition(event.target.value)}
          rows={Math.min(10, condition.split('\n').length + 1)}
          spellCheck={false}
          disabled={saving}
          className={`${inputClass} font-mono text-xs`}
        />
      </label>

      {error ? (
        <p role="alert" className={`${errorClass} mt-3`}>
          {error}
        </p>
      ) : null}
      {saved && !dirty ? (
        <p role="status" className={`${noticeClass} mt-3`}>
          {t('ai.rules.saved')}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={saving || !dirty || name.trim() === ''} onClick={() => void save()} className={primaryButton}>
          {t('ai.rules.save')}
        </button>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={() => {
            setName(rule.name)
            setActive(rule.isActive)
            setCondition(conditionText(rule))
            setError(null)
          }}
          className={secondaryButton}
        >
          {t('ai.rules.reset')}
        </button>
      </div>
    </li>
  )
}

/** The automation rules of this business with their thresholds. A save checks the thresholds on the server. */
export function RulesPanel() {
  const { t } = useI18n()
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setPhase((current) => (current === 'ready' ? 'ready' : 'loading'))
    apiRequest<{ data: AutomationRule[] }>('/api/v1/ai/rules', { signal: controller.signal })
      .then((payload) => {
        setRules(payload.data)
        setPhase('ready')
      })
      .catch((failure: unknown) => {
        if (isAbort(failure)) return
        setError(errorKey(failure))
        setPhase('error')
      })
    return () => controller.abort()
  }, [reload])

  return (
    <section aria-label={t('ai.rules.title')} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">{t('ai.rules.title')}</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('ai.rules.subtitle')}</p>
      </div>

      {phase === 'loading' ? <p className="py-8 text-center text-sm text-gray-400">{t('ai.loading')}</p> : null}

      {phase === 'error' ? (
        <div className="space-y-3 rounded-xl border border-[#30363d] bg-[#1c2128] py-8 text-center">
          <p role="alert" className={`${errorClass} inline-block`}>
            {t(error)}
          </p>
          <div>
            <button type="button" onClick={() => setReload((value) => value + 1)} className={secondaryButton}>
              {t('ai.retry')}
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'ready' && rules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#30363d] px-4 py-10 text-center text-sm text-gray-400">{t('ai.rules.empty')}</p>
      ) : null}

      {phase === 'ready' && rules.length > 0 ? (
        <ul className="space-y-3">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onSaved={(updated) => setRules((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)))}
              onStale={() => setReload((value) => value + 1)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
