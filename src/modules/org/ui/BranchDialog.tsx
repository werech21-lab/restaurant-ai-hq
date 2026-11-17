'use client'

import { useState } from 'react'
import { useRunner } from '@/components/erp/actions'
import { apiRequest } from '@/components/erp/api'
import { useCan } from '@/components/erp/permissions'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import {
  createBranchSchema,
  orgStatuses,
  updateBranchSchema,
  type Branch,
  type Brand,
  type OrgStatus,
} from '@/modules/org/client'
import {
  CatalogNote,
  FormIssues,
  OrgFact,
  OrgField,
  RequestFailure,
  fieldIssue,
  orgInputClass,
  orgPrimaryBtn,
  orgSecondaryBtn,
  type Catalog,
} from '@/modules/org/ui/shared'

type Props = {
  branch?: Branch
  brands: Catalog<Brand>
  onSaved: (message: MessageKey) => void
  onCancel: () => void
  onReload: () => void
}

const issuesFor: Record<string, MessageKey> = {
  code: 'org.err.form.code',
  name: 'org.err.form.name',
  brandId: 'org.err.form.brand',
  timezone: 'org.err.form.timezone',
}

/**
 * A branch. The brand and the code stay as they were created. An active branch needs an active brand, which the API checks again.
 */
export function BranchDialog({ branch, brands, onSaved, onCancel, onReload }: Props) {
  const { t } = useI18n()
  const canManage = useCan(permissions.orgBranchManage)
  const canReadBrands = useCan(permissions.orgBrandRead)
  const [brandId, setBrandId] = useState(branch?.brandId ?? '')
  const [code, setCode] = useState(branch?.code ?? '')
  const [name, setName] = useState(branch?.name ?? '')
  const [timezone, setTimezone] = useState(branch?.timezone ?? 'Asia/Kuwait')
  const [status, setStatus] = useState<OrgStatus>(branch?.status ?? 'active')
  const [issues, setIssues] = useState<MessageKey[]>([])
  const { pending, failure, run } = useRunner()

  function save() {
    setIssues([])
    const chosen = brands.rows.find((row) => row.id === (branch?.brandId ?? brandId))
    if (
      chosen &&
      chosen.status !== 'active' &&
      status === 'active' &&
      (!branch || branch.status !== 'active')
    ) {
      setIssues(['org.err.brand_inactive'])
      return
    }
    const parsed = branch
      ? updateBranchSchema.safeParse({ version: branch.version, name, timezone, status })
      : createBranchSchema.safeParse({ brandId, code, name, timezone, status })
    if (!parsed.success) {
      setIssues(
        Array.from(new Set(parsed.error.issues.map((issue) => fieldIssue(issue.path, issuesFor)))),
      )
      return
    }
    void run(async () => {
      await apiRequest(branch ? `/api/v1/org/branches/${branch.id}` : '/api/v1/org/branches', {
        method: branch ? 'PATCH' : 'POST',
        body: parsed.data,
      })
      onSaved(branch ? 'org.msg.branchSaved' : 'org.msg.branchCreated')
      onCancel()
    })
  }

  const showBrandList = canReadBrands && (brands.phase !== 'error' || brands.rows.length > 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {branch ? (
          <OrgFact label={t('org.branch.brand')}>{branch.brandName}</OrgFact>
        ) : showBrandList ? (
          <OrgField label={t('org.branch.brand')}>
            <select
              value={brandId}
              onChange={(event) => setBrandId(event.target.value)}
              disabled={brands.phase === 'loading' && brands.rows.length === 0}
              className={orgInputClass}
            >
              <option value="">
                {brands.phase === 'loading' ? t('erp.loading') : t('org.branch.pickBrand')}
              </option>
              {brands.rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} · {row.name}
                  {row.status === 'inactive' ? ` (${t('org.status.inactive')})` : ''}
                </option>
              ))}
            </select>
            <CatalogNote catalog={brands} />
            {brands.phase === 'ready' && brands.rows.length === 0 ? (
              <span className="mt-1 block text-xs text-[var(--ds-text-muted)]">
                {t('org.branch.noBrands')}
              </span>
            ) : null}
          </OrgField>
        ) : (
          <OrgField label={t('org.branch.brandId')}>
            <input
              value={brandId}
              onChange={(event) => setBrandId(event.target.value)}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              className={orgInputClass}
            />
            {canReadBrands ? (
              <CatalogNote catalog={brands} />
            ) : (
              <span className="mt-1 block text-xs text-[var(--ds-text-muted)]">
                {t('org.branch.noBrandRead')}
              </span>
            )}
          </OrgField>
        )}

        {branch ? (
          <OrgFact label={t('org.branch.code')}>
            <span dir="ltr" className="font-mono font-semibold text-[var(--ds-accent)]">
              {branch.code}
            </span>
          </OrgFact>
        ) : (
          <OrgField label={t('org.branch.code')}>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={20}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              className={orgInputClass}
            />
          </OrgField>
        )}

        <OrgField label={t('org.branch.name')}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={200}
            className={orgInputClass}
          />
        </OrgField>
        <OrgField label={t('org.branch.timezone')}>
          <input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            maxLength={64}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder="Asia/Kuwait"
            className={orgInputClass}
          />
        </OrgField>
        <OrgField label={t('org.branch.status')}>
          <select
            value={status}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'active' || value === 'inactive') setStatus(value)
            }}
            className={orgInputClass}
          >
            {orgStatuses.map((value) => (
              <option key={value} value={value}>
                {t(value === 'active' ? 'org.status.active' : 'org.status.inactive')}
              </option>
            ))}
          </select>
        </OrgField>
      </div>
      <p className="text-xs text-[var(--ds-text-muted)]">
        {t(branch ? 'org.branch.identity' : 'org.branch.codeHint')}
      </p>
      <p className="text-xs text-[var(--ds-text-muted)]">{t('org.branch.timezoneHint')}</p>
      <FormIssues issues={issues} />
      <RequestFailure failure={failure} onReload={onReload} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ds-border-hairline)] pt-4">
        {canManage ? (
          <button type="button" onClick={save} disabled={pending} className={orgPrimaryBtn}>
            {pending ? t('erp.loading') : t('erp.save')}
          </button>
        ) : null}
        <button type="button" onClick={onCancel} className={orgSecondaryBtn}>
          {t('erp.cancel')}
        </button>
      </div>
    </div>
  )
}
