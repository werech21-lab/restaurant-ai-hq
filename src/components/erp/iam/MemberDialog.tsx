'use client'

import { useState } from 'react'
import { useRunner } from '@/components/erp/actions'
import { apiRequest } from '@/components/erp/api'
import {
  CatalogNote,
  FormIssues,
  IamFact,
  IamField,
  IamUnavailableDash,
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
import { changeMemberRoleSchema, removeMemberQuerySchema } from '@/lib/iam/schemas'
import type { Member, Role } from '@/lib/iam/types'

type Props = {
  member: Member
  userId: string
  roles: Catalog<Role>
  onSaved: (message: MessageKey) => void
  onCancel: () => void
  onReload: () => void
}

const issuesFor: Record<string, MessageKey> = {
  roleId: 'iam.err.form.role',
  expectedRoleId: 'iam.err.form.role',
}

function roleChoices(roles: readonly Role[], current: Member): { id: string; name: string }[] {
  const options = roles.map((role) => ({ id: role.id, name: role.name }))
  if (!options.some((option) => option.id === current.roleId)) {
    options.unshift({ id: current.roleId, name: current.roleName })
  }
  return options
}

/** A member. The current role is sent back so a stale screen gets a conflict instead of overwriting another edit. */
export function MemberDialog({ member, userId, roles, onSaved, onCancel, onReload }: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const canUpdate = useCan(permissions.iamMemberUpdate)
  const canRemove = useCan(permissions.iamMemberRemove)
  const canReadRoles = useCan(permissions.iamRoleRead)
  const isSelf = member.userId === userId
  const [roleId, setRoleId] = useState(member.roleId)
  const [confirming, setConfirming] = useState(false)
  const [issues, setIssues] = useState<MessageKey[]>([])
  const { pending, failure, run } = useRunner()
  const showRoleList = canReadRoles && (roles.phase !== 'error' || roles.rows.length > 0)

  function save() {
    setIssues([])
    if (roleId === member.roleId) {
      setIssues(['iam.err.role_unchanged'])
      return
    }
    const parsed = changeMemberRoleSchema.safeParse({ roleId, expectedRoleId: member.roleId })
    if (!parsed.success) {
      setIssues(
        Array.from(new Set(parsed.error.issues.map((issue) => fieldIssue(issue.path, issuesFor)))),
      )
      return
    }
    void run(async () => {
      await apiRequest(`/api/v1/iam/members/${member.userId}`, {
        method: 'PATCH',
        body: parsed.data,
      })
      onSaved('iam.msg.memberUpdated')
      onCancel()
    })
  }

  function remove() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setIssues([])
    const parsed = removeMemberQuerySchema.safeParse({ expectedRoleId: member.roleId })
    if (!parsed.success) {
      setIssues(['iam.err.form.generic'])
      return
    }
    void run(async () => {
      await apiRequest(
        `/api/v1/iam/members/${member.userId}?expectedRoleId=${encodeURIComponent(parsed.data.expectedRoleId)}`,
        { method: 'DELETE' },
      )
      onSaved('iam.msg.memberRemoved')
      onCancel()
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <IamFact label={t('iam.member.name')}>
          {member.displayName || <IamUnavailableDash locale={fmtLocale} />}
        </IamFact>
        <IamFact label={t('iam.member.email')}>
          {member.email ? (
            <span dir="ltr" className="font-mono text-xs">
              {member.email}
            </span>
          ) : (
            <IamUnavailableDash locale={fmtLocale} />
          )}
        </IamFact>
        <IamFact label={t('iam.member.role')}>{member.roleName}</IamFact>
        <IamFact label={t('iam.member.joined')}>
          <span dir="ltr" className="ds-num tabular-nums">
            {formatIamDateTime(member.createdAt, fmtLocale)}
          </span>
        </IamFact>
        <IamFact label={t('iam.member.userId')}>
          <span dir="ltr" className="break-all font-mono text-xs">
            {member.userId}
          </span>
        </IamFact>
      </div>

      {isSelf ? (
        <p className="text-sm text-[var(--ds-text-muted)]">{t('iam.member.self')}</p>
      ) : null}

      {canUpdate && !isSelf ? (
        showRoleList ? (
          <IamField label={t('iam.member.role')}>
            <select
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              className={iamInputClass}
            >
              {roleChoices(roles.rows, member).map((role) => (
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
        )
      ) : null}

      {confirming ? (
        <p className="text-sm font-medium text-[var(--ds-text-primary)]">
          {t('iam.member.confirmRemove')}
        </p>
      ) : null}
      <FormIssues issues={issues} />
      <RequestFailure failure={failure} onReload={onReload} />

      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ds-border-hairline)] pt-4">
        {canRemove && !isSelf ? (
          <button type="button" onClick={remove} disabled={pending} className={iamDangerBtn}>
            {pending ? t('erp.loading') : t(confirming ? 'iam.member.removeNow' : 'iam.member.remove')}
          </button>
        ) : null}
        {canUpdate && !isSelf ? (
          <button type="button" onClick={save} disabled={pending} className={iamPrimaryBtn}>
            {pending ? t('erp.loading') : t('erp.save')}
          </button>
        ) : null}
        <button type="button" onClick={onCancel} className={iamSecondaryBtn}>
          {t('erp.cancel')}
        </button>
      </div>
    </div>
  )
}
