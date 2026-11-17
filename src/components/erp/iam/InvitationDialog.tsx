'use client'

import { useState } from 'react'
import { useRunner } from '@/components/erp/actions'
import { apiRequest } from '@/components/erp/api'
import {
  CatalogNote,
  FormIssues,
  IamFact,
  IamField,
  InvitationStatusBadge,
  RequestFailure,
  fieldIssue,
  formatIamDateTime,
  iamDangerBtn,
  iamInputClass,
  iamPrimaryBtn,
  iamSecondaryBtn,
  type Catalog,
} from '@/components/erp/iam/shared'
import { useCan } from '@/components/erp/permissions'
import { permissions } from '@/lib/auth/permissions'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { createInvitationSchema, revokeInvitationSchema } from '@/lib/iam/schemas'
import type { Invitation, Role } from '@/lib/iam/types'

type Props = {
  invitation?: Invitation
  roles: Catalog<Role>
  onSaved: (message: MessageKey) => void
  onCancel: () => void
  onReload: () => void
}

type Issued = { invitation: Invitation; token: string }

const issuesFor: Record<string, MessageKey> = {
  email: 'iam.err.form.email',
  roleId: 'iam.err.form.role',
  expiresInDays: 'iam.err.form.days',
}

/** An invitation. The token comes back only from the create call. The route does not ask for an idempotency key. */
export function InvitationDialog({ invitation, roles, onSaved, onCancel, onReload }: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const canInvite = useCan(permissions.iamMemberInvite)
  const canReadRoles = useCan(permissions.iamRoleRead)
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [days, setDays] = useState('')
  const [issued, setIssued] = useState<Issued | null>(null)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [confirming, setConfirming] = useState(false)
  const [issues, setIssues] = useState<MessageKey[]>([])
  const { pending, failure, run } = useRunner()
  const showRoleList = canReadRoles && (roles.phase !== 'error' || roles.rows.length > 0)

  function create() {
    setIssues([])
    const expiresInDays = days.trim() === '' ? undefined : Number(days)
    const parsed = createInvitationSchema.safeParse(
      expiresInDays === undefined ? { email, roleId } : { email, roleId, expiresInDays },
    )
    if (!parsed.success) {
      setIssues(
        Array.from(new Set(parsed.error.issues.map((issue) => fieldIssue(issue.path, issuesFor)))),
      )
      return
    }
    void run(async () => {
      const created = await apiRequest<{ data: Invitation; token: string }>(
        '/api/v1/iam/invitations',
        { method: 'POST', body: parsed.data },
      )
      setLink(`${window.location.origin}/erp/iam/accept?token=${encodeURIComponent(created.token)}`)
      setIssued({ invitation: created.data, token: created.token })
      onSaved('iam.msg.invited')
    })
  }

  function revoke() {
    if (!invitation) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    setIssues([])
    const parsed = revokeInvitationSchema.safeParse({ version: invitation.version })
    if (!parsed.success) {
      setIssues(['iam.err.form.generic'])
      return
    }
    void run(async () => {
      await apiRequest(`/api/v1/iam/invitations/${invitation.id}/revoke`, {
        method: 'POST',
        body: parsed.data,
      })
      onSaved('iam.msg.revoked')
      onCancel()
    })
  }

  async function copyLink() {
    const value = link || issued?.token
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied('copied')
    } catch {
      setCopied('failed')
    }
  }

  if (issued) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--ds-text-secondary)]">{t('iam.inv.tokenHint')}</p>
        <IamField label={t('iam.inv.token')}>
          <input value={issued.token} readOnly dir="ltr" spellCheck={false} className={iamInputClass} />
        </IamField>
        <IamField label={t('iam.inv.link')}>
          <input value={link} readOnly dir="ltr" spellCheck={false} className={iamInputClass} />
        </IamField>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--ds-border-hairline)] pt-4">
          {copied === 'copied' ? (
            <span className="text-sm font-medium text-[var(--ds-positive)]">{t('iam.inv.copied')}</span>
          ) : null}
          {copied === 'failed' ? (
            <span className="text-sm font-medium text-[var(--ds-negative)]">{t('iam.inv.copyFailed')}</span>
          ) : null}
          <button type="button" onClick={() => void copyLink()} className={iamSecondaryBtn}>
            {t('iam.inv.copyLink')}
          </button>
          <button type="button" onClick={onCancel} className={iamPrimaryBtn}>
            {t('erp.close')}
          </button>
        </div>
      </div>
    )
  }

  if (invitation) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <IamFact label={t('iam.inv.email')}>
            <span dir="ltr" className="font-mono text-xs">
              {invitation.email}
            </span>
          </IamFact>
          <IamFact label={t('iam.inv.role')}>{invitation.roleName}</IamFact>
          <IamFact label={t('iam.inv.status')}>
            <InvitationStatusBadge status={invitation.status} />
          </IamFact>
          <IamFact label={t('iam.inv.expires')}>
            <span dir="ltr" className="ds-num tabular-nums">
              {formatIamDateTime(invitation.expiresAt, fmtLocale)}
            </span>
          </IamFact>
          <IamFact label={t('iam.inv.created')}>
            <span dir="ltr" className="ds-num tabular-nums">
              {formatIamDateTime(invitation.createdAt, fmtLocale)}
            </span>
          </IamFact>
          {invitation.acceptedAt ? (
            <IamFact label={t('iam.inv.acceptedAt')}>
              <span dir="ltr" className="ds-num tabular-nums">
                {formatIamDateTime(invitation.acceptedAt, fmtLocale)}
              </span>
            </IamFact>
          ) : null}
          {invitation.revokedAt ? (
            <IamFact label={t('iam.inv.revokedAt')}>
              <span dir="ltr" className="ds-num tabular-nums">
                {formatIamDateTime(invitation.revokedAt, fmtLocale)}
              </span>
            </IamFact>
          ) : null}
        </div>
        <p className="text-xs text-[var(--ds-text-muted)]">{t('iam.inv.tokenOnce')}</p>
        {confirming ? (
          <p className="text-sm font-medium text-[var(--ds-text-primary)]">{t('iam.inv.confirmRevoke')}</p>
        ) : null}
        <FormIssues issues={issues} />
        <RequestFailure failure={failure} onReload={onReload} />
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ds-border-hairline)] pt-4">
          {canInvite && invitation.status === 'pending' ? (
            <button type="button" onClick={revoke} disabled={pending} className={iamDangerBtn}>
              {pending ? t('erp.loading') : t(confirming ? 'iam.inv.revokeNow' : 'iam.inv.revoke')}
            </button>
          ) : null}
          <button type="button" onClick={onCancel} className={iamSecondaryBtn}>
            {t('erp.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <IamField label={t('iam.inv.email')}>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          maxLength={254}
          dir="ltr"
          autoComplete="email"
          className={iamInputClass}
        />
      </IamField>
      {showRoleList ? (
        <IamField label={t('iam.inv.role')}>
          <select
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            className={iamInputClass}
          >
            <option value="">
              {roles.phase === 'loading' ? t('erp.loading') : t('iam.pickRole')}
            </option>
            {roles.rows.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <CatalogNote catalog={roles} />
        </IamField>
      ) : (
        <IamField label={t('iam.roleId')}>
          <input
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            className={iamInputClass}
          />
          {canReadRoles ? (
            <CatalogNote catalog={roles} />
          ) : (
            <span className="mt-1 block text-xs text-[var(--ds-text-muted)]">
              {t('iam.noRoleRead')}
            </span>
          )}
        </IamField>
      )}
      <IamField label={t('iam.inv.days')}>
        <input
          value={days}
          onChange={(event) => setDays(event.target.value)}
          inputMode="numeric"
          dir="ltr"
          className={iamInputClass}
        />
        <span className="mt-1 block text-xs text-[var(--ds-text-muted)]">
          {t('iam.inv.daysHint')}
        </span>
      </IamField>
      <FormIssues issues={issues} />
      <RequestFailure failure={failure} onReload={onReload} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ds-border-hairline)] pt-4">
        {canInvite ? (
          <button type="button" onClick={create} disabled={pending} className={iamPrimaryBtn}>
            {pending ? t('erp.loading') : t('iam.inv.new')}
          </button>
        ) : null}
        <button type="button" onClick={onCancel} className={iamSecondaryBtn}>
          {t('erp.cancel')}
        </button>
      </div>
    </div>
  )
}
