'use client'

import { useState } from 'react'
import { Fact, Field, useRunner } from '@/components/erp/actions'
import { apiRequest } from '@/components/erp/api'
import { useCan } from '@/components/erp/permissions'
import { inputClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { createBrandSchema, orgStatuses, updateBrandSchema, type Brand, type OrgStatus } from '@/modules/org/client'
import { fieldIssue, FormIssues, RequestFailure } from '@/modules/org/ui/shared'

type Props = {
  brand?: Brand
  onSaved: (message: MessageKey) => void
  onCancel: () => void
  onReload: () => void
}

const issuesFor: Record<string, MessageKey> = {
  code: 'org.err.form.code',
  name: 'org.err.form.name',
}

/**
 * A brand. The code is its identity: it is chosen once, stored in capitals, and the API refuses to change it afterwards.
 */
export function BrandDialog({ brand, onSaved, onCancel, onReload }: Props) {
  const { t } = useI18n()
  const canManage = useCan(permissions.orgBrandManage)
  const [code, setCode] = useState(brand?.code ?? '')
  const [name, setName] = useState(brand?.name ?? '')
  const [status, setStatus] = useState<OrgStatus>(brand?.status ?? 'active')
  const [issues, setIssues] = useState<MessageKey[]>([])
  const { pending, failure, run } = useRunner()

  function save() {
    setIssues([])
    const parsed = brand
      ? updateBrandSchema.safeParse({ version: brand.version, name, status })
      : createBrandSchema.safeParse({ code, name, status })
    if (!parsed.success) {
      setIssues(Array.from(new Set(parsed.error.issues.map((issue) => fieldIssue(issue.path, issuesFor)))))
      return
    }
    void run(async () => {
      await apiRequest(brand ? `/api/v1/org/brands/${brand.id}` : '/api/v1/org/brands', {
        method: brand ? 'PATCH' : 'POST',
        body: parsed.data,
      })
      onSaved(brand ? 'org.msg.brandSaved' : 'org.msg.brandCreated')
      onCancel()
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {brand ? (
          <Fact label={t('org.brand.code')}>
            <Num className="font-semibold text-blue-300">{brand.code}</Num>
          </Fact>
        ) : (
          <Field label={t('org.brand.code')}>
            <input value={code} onChange={(event) => setCode(event.target.value)} maxLength={20} dir="ltr" autoComplete="off" spellCheck={false} className={inputClass} />
          </Field>
        )}
        <Field label={t('org.brand.name')}>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} className={inputClass} />
        </Field>
        <Field label={t('org.brand.status')}>
          <select
            value={status}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'active' || value === 'inactive') setStatus(value)
            }}
            className={inputClass}
          >
            {orgStatuses.map((value) => (
              <option key={value} value={value}>
                {t(value === 'active' ? 'org.status.active' : 'org.status.inactive')}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-gray-500">{t('org.brand.codeHint')}</p>
      <FormIssues issues={issues} />
      <RequestFailure failure={failure} onReload={onReload} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#30363d] pt-4">
        {canManage ? (
          <button type="button" onClick={save} disabled={pending} className={primaryButton}>
            {pending ? t('erp.loading') : t('erp.save')}
          </button>
        ) : null}
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t('erp.cancel')}
        </button>
      </div>
    </div>
  )
}
