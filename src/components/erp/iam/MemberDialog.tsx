'use client'

import { useState } from 'react'
import { Fact, Field, useRunner } from '@/components/erp/actions'
import { apiRequest } from '@/components/erp/api'
import { dateTimeText } from '@/components/erp/common'
import { useCan } from '@/components/erp/permissions'
import { dangerButton, inputClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { changeMemberRoleSchema, removeMemberQuerySchema } from '@/lib/iam/schemas'
import type { Member, Role } from '@/lib/iam/types'
import { CatalogNote, fieldIssue, FormIssues, RequestFailure, type Catalog } from '@/components/erp/iam/shared'

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
  if (!options.some((option) => option.id === current.roleId)) options.unshift({ id: current.roleId, name: current.roleName })
  return options
}

/** A member. The current role is sent back so a stale screen gets a conflict instead of overwriting another edit. */
export function MemberDialog({ member, userId, roles, onSaved, onCancel, onReload }: Props) {
  const { t } = useI18n()
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
      setIssues(Array.from(new Set(parsed.error.issues.map((issue) => fieldIssue(issue.path, issuesFor)))))
      return
    }
    void run(async () => {
      await apiRequest(`/api/v1/iam/members/${member.userId}`, { method: 'PATCH', body: parsed.data })
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
      await apiRequest(`/api/v1/iam/members/${member.userId}?expectedRoleId=${encodeURIComponent(parsed.data.expectedRoleId)}`, { method: 'DELETE' })
      onSaved('iam.msg.memberRemoved')
      onCancel()
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Fact label={t('iam.member.name')}>{member.displayName || '—'}</Fact>
        <Fact label={t('iam.member.email')}>{member.email ? <Num>{member.email}</Num> : '—'}</Fact>
        <Fact label={t('iam.member.role')}>{member.roleName}</Fact>
        <Fact label={t('iam.member.joined')}>
          <Num>{dateTimeText(member.createdAt)}</Num>
        </Fact>
        <Fact label={t('iam.member.userId')}>
          <Num>{member.userId}</Num>
        </Fact>
      </div>

      {isSelf ? <p className="text-sm text-gray-400">{t('iam.member.self')}</p> : null}

      {canUpdate && !isSelf ? (
        showRoleList ? (
          <Field label={t('iam.member.role')}>
            <select value={roleId} onChange={(event) => setRoleId(event.target.value)} className={inputClass}>
              {roleChoices(roles.rows, member).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <CatalogNote catalog={roles} />
          </Field>
        ) : (
          <Field label={t('iam.roleId')}>
            <input value={roleId} onChange={(event) => setRoleId(event.target.value)} dir="ltr" autoComplete="off" spellCheck={false} className={inputClass} />
            {canReadRoles ? <CatalogNote catalog={roles} /> : <span className="mt-1 block text-xs text-gray-500">{t('iam.noRoleRead')}</span>}
          </Field>
        )
      ) : null}

      {confirming ? <p className="text-sm text-gray-300">{t('iam.member.confirmRemove')}</p> : null}
      <FormIssues issues={issues} />
      <RequestFailure failure={failure} onReload={onReload} />

      <div className="flex flex-wrap justify-end gap-2 border-t border-[#30363d] pt-4">
        {canRemove && !isSelf ? (
          <button type="button" onClick={remove} disabled={pending} className={dangerButton}>
            {pending ? t('erp.loading') : t(confirming ? 'iam.member.removeNow' : 'iam.member.remove')}
          </button>
        ) : null}
        {canUpdate && !isSelf ? (
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
