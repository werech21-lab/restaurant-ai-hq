'use client'

import { useEffect, useState } from 'react'
import { ApiError, apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { Phase } from '@/components/erp/common'
import { StateBlock } from '@/components/ui/state-block'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { AutomationRule } from '@/modules/ai/client'
import {
  AiPill,
  actionLabels,
  aiCardClass,
  aiErrorClass,
  aiInputClass,
  aiLabelClass,
  aiNoticeClass,
  aiPrimaryBtn,
  aiSecondaryBtn,
} from '@/modules/ai/ui/labels'

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

  const dirty =
    name !== rule.name || active !== rule.isActive || condition !== conditionText(rule)

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
      if (failure instanceof ApiError && failure.code === 'condition_invalid') {
        setError(t('ai.err.condition_invalid'))
      } else {
        setError(t(errorKey(failure)))
        if (failure instanceof ApiError && failure.code === 'version_conflict') onStale()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={aiCardClass} data-rule-key={rule.ruleKey}>
      <div className="flex flex-wrap items-center gap-2">
        <AiPill tone="info">{t(actionLabels[rule.actionType])}</AiPill>
        <span dir="ltr" className="font-mono text-xs text-[var(--ds-text-muted)]">
          {rule.ruleKey}
        </span>
      </div>
      <p className="mt-2 text-sm leading-7 text-[var(--ds-text-secondary)]">{rule.descriptionAr}</p>
      <p className="mt-1 text-xs text-[var(--ds-text-muted)]">
        {t('ai.rules.trigger')}:{' '}
        <span dir="ltr" className="font-mono">
          {rule.triggerEvent}
        </span>
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className={aiLabelClass}>
          {t('ai.rules.name')}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={200}
            className={aiInputClass}
            disabled={saving}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 self-end pb-2.5 text-sm font-medium text-[var(--ds-text-primary)]">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            disabled={saving}
            className="h-4 w-4 accent-emerald-600"
          />
          {t('ai.rules.active')}
        </label>
      </div>

      <label className={`${aiLabelClass} mt-3`}>
        {t('ai.rules.condition')}
        <textarea
          dir="ltr"
          value={condition}
          onChange={(event) => setCondition(event.target.value)}
          rows={Math.min(10, condition.split('\n').length + 1)}
          spellCheck={false}
          disabled={saving}
          className={`${aiInputClass} font-mono text-xs`}
        />
      </label>

      {error ? (
        <p role="alert" className={`${aiErrorClass} mt-3`}>
          {error}
        </p>
      ) : null}
      {saved && !dirty ? (
        <p role="status" className={`${aiNoticeClass} mt-3`}>
          {t('ai.rules.saved')}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || !dirty || name.trim() === ''}
          onClick={() => void save()}
          className={aiPrimaryBtn}
        >
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
          className={aiSecondaryBtn}
        >
          {t('ai.rules.reset')}
        </button>
      </div>
    </li>
  )
}

/** The automation rules of this business with their thresholds. A save checks the thresholds on the server. */
export function RulesPanel() {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
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
        <h2 className="text-lg font-semibold text-[var(--ds-text-primary)]">{t('ai.rules.title')}</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ds-text-muted)]">{t('ai.rules.subtitle')}</p>
      </div>

      {phase === 'loading' ? (
        <StateBlock state="loading" locale={fmtLocale} title={t('ai.loading')} skeletonRows={3} />
      ) : null}

      {phase === 'error' ? (
        <StateBlock
          state={error === 'erp.err.forbidden' ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(error)}
          onRetry={error === 'erp.err.forbidden' ? undefined : () => setReload((value) => value + 1)}
          retryLabel={t('ai.retry')}
        />
      ) : null}

      {phase === 'ready' && rules.length === 0 ? (
        <StateBlock state="empty" locale={fmtLocale} title={t('ai.rules.empty')} />
      ) : null}

      {phase === 'ready' && rules.length > 0 ? (
        <ul className="space-y-3">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onSaved={(updated) =>
                setRules((current) =>
                  current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
                )
              }
              onStale={() => setReload((value) => value + 1)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
