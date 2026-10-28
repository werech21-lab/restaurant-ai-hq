'use client'

import { useMemo, useState } from 'react'
import { Fact, Field, useRunner } from '@/components/erp/actions'
import { apiRequest } from '@/components/erp/api'
import { useCan } from '@/components/erp/permissions'
import { inputClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Badge, Num } from '@/components/ui'
import { allPermissions, permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { createRoleSchema, updateRoleSchema } from '@/lib/iam/schemas'
import type { Role } from '@/lib/iam/types'
import { fieldIssue, FormIssues, RequestFailure } from '@/components/erp/iam/shared'

type Props = {
  role?: Role
  onSaved: (message: MessageKey) => void
  onCancel: () => void
  onReload: () => void
}

const issuesFor: Record<string, MessageKey> = {
  name: 'iam.err.form.name',
  description: 'iam.err.form.description',
  permissions: 'iam.err.form.permissions',
}

const groupLabel = {
  finance: 'iam.role.group.finance',
  crm: 'iam.role.group.crm',
  inventory: 'iam.role.group.inventory',
  procurement: 'iam.role.group.procurement',
  org: 'iam.role.group.org',
  iam: 'iam.role.group.iam',
  ai: 'iam.role.group.ai',
  other: 'iam.role.group.other',
} as const satisfies Record<string, MessageKey>

type GroupId = keyof typeof groupLabel

function groupId(permission: string): GroupId {
  const prefix = permission.split('.')[0]
  if (prefix !== undefined && Object.prototype.hasOwnProperty.call(groupLabel, prefix)) return prefix as GroupId
  return 'other'
}

/** A role and the permissions it grants. A built-in role is shown and cannot be edited. */
export function RoleDialog({ role, onSaved, onCancel, onReload }: Props) {
  const { t } = useI18n()
  const canManage = useCan(permissions.iamRoleManage)
  const locked = !canManage || role?.isSystem === true
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(role?.permissions ?? []))
  const [issues, setIssues] = useState<MessageKey[]>([])
  const { pending, failure, run } = useRunner()

  const grouped = useMemo(() => {
    const buckets = new Map<GroupId, string[]>()
    for (const id of Object.keys(groupLabel) as GroupId[]) buckets.set(id, [])
    for (const permission of allPermissions) buckets.get(groupId(permission))?.push(permission)
    const known = new Set<string>(allPermissions)
    for (const permission of role?.permissions ?? []) {
      if (!known.has(permission)) buckets.get('other')?.push(permission)
    }
    return buckets
  }, [role])

  function toggle(permission: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(permission)) next.delete(permission)
      else next.add(permission)
      return next
    })
  }

  function save() {
    if (locked) return
    setIssues([])
    const permissionsField = [...selected]
    const parsed = role
      ? updateRoleSchema.safeParse({ version: role.version, name, description, permissions: permissionsField })
      : createRoleSchema.safeParse({ name, description, permissions: permissionsField })
    if (!parsed.success) {
      setIssues(Array.from(new Set(parsed.error.issues.map((issue) => fieldIssue(issue.path, issuesFor)))))
      return
    }
    void run(async () => {
      await apiRequest(role ? `/api/v1/iam/roles/${role.id}` : '/api/v1/iam/roles', {
        method: role ? 'PATCH' : 'POST',
        body: parsed.data,
      })
      onSaved(role ? 'iam.msg.roleSaved' : 'iam.msg.roleCreated')
      onCancel()
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('iam.role.name')}>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} disabled={locked} className={inputClass} />
        </Field>
        <Field label={t('iam.role.description')} className="sm:col-span-2">
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} disabled={locked} className={inputClass} />
        </Field>
        {role ? (
          <>
            <Fact label={t('iam.role.kind')}>
              <Badge tone={role.isSystem ? 'gold' : 'neutral'}>{t(role.isSystem ? 'iam.role.system' : 'iam.role.custom')}</Badge>
            </Fact>
            <Fact label={t('iam.role.members')}>
              <Num>{role.memberCount}</Num>
            </Fact>
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-200">{t('iam.role.permissions')}</h3>
        <Num>{selected.size}</Num>
      </div>
      {role?.isSystem ? <p className="text-xs text-gray-500">{t('iam.role.locked')}</p> : null}

      <div className="max-h-80 space-y-4 overflow-y-auto pe-1">
        {(Object.keys(groupLabel) as GroupId[]).map((id) => {
          const items = grouped.get(id) ?? []
          if (items.length === 0) return null
          return (
            <fieldset key={id} className="space-y-2">
              <legend className="text-xs font-medium text-gray-400">{t(groupLabel[id])}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((permission) => (
                  <label key={permission} className="flex items-center gap-2 text-sm text-gray-200">
                    <input type="checkbox" checked={selected.has(permission)} disabled={locked} onChange={() => toggle(permission)} className="h-4 w-4" />
                    <span dir="ltr" className="text-xs">
                      {permission}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )
        })}
      </div>

      <FormIssues issues={issues} />
      <RequestFailure failure={failure} onReload={onReload} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#30363d] pt-4">
        {canManage && role?.isSystem !== true ? (
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
