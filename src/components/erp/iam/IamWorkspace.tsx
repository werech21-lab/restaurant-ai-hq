'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, dateTimeText } from '@/components/erp/common'
import { PagedTable } from '@/components/erp/PagedTable'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { inputClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Badge, Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Invitation, Member, Role } from '@/lib/iam/types'
import { InvitationDialog } from '@/components/erp/iam/InvitationDialog'
import { MemberDialog } from '@/components/erp/iam/MemberDialog'
import { RoleDialog } from '@/components/erp/iam/RoleDialog'
import { InvitationStatusBadge, useCatalog } from '@/components/erp/iam/shared'

const allTabs = ['members', 'invitations', 'roles'] as const
type Tab = (typeof allTabs)[number]
type InvitationFilter = 'all' | 'pending' | 'accepted' | 'revoked' | 'expired'
type Dialog = { kind: 'member'; member: Member } | { kind: 'invitation'; invitation?: Invitation } | { kind: 'role'; role?: Role } | null

/**
 * Members, invitations and roles. `permissions` and `userId` only decide what is shown; the API checks every request again.
 */
export default function IamWorkspace({ permissions: held, userId }: { permissions: readonly string[]; userId: string }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace userId={userId} />
    </PermissionProvider>
  )
}

function invitationFilterLabel(value: InvitationFilter): MessageKey {
  if (value === 'all') return 'iam.inv.allStatuses'
  return `iam.inv.${value}`
}

function Workspace({ userId }: { userId: string }) {
  const { t } = useI18n()
  const canReadMembers = useCan(permissions.iamMemberRead)
  const canReadRoles = useCan(permissions.iamRoleRead)
  const canInvite = useCan(permissions.iamMemberInvite)
  const canManageRoles = useCan(permissions.iamRoleManage)

  const visibleTabs = useMemo<Tab[]>(() => {
    const allowed: Record<Tab, boolean> = {
      members: canReadMembers,
      invitations: canReadMembers,
      roles: canReadRoles,
    }
    return allTabs.filter((value) => allowed[value])
  }, [canReadMembers, canReadRoles])

  const [chosenTab, setTab] = useState<Tab>('members')
  const tab: Tab | null = visibleTabs.includes(chosenTab) ? chosenTab : (visibleTabs[0] ?? null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [invitationStatus, setInvitationStatus] = useState<InvitationFilter>('all')
  const roles = useCatalog<Role>(canReadRoles, '/api/v1/iam/roles?limit=100', reloadToken)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const changed = useCallback((message: MessageKey) => {
    setNotice(message)
    setReloadToken((value) => value + 1)
  }, [])
  const closeDialog = useCallback(() => setDialog(null), [])
  const reloadDialog = useCallback(() => {
    setDialog(null)
    setReloadToken((value) => value + 1)
  }, [])

  const memberPath = '/api/v1/iam/members?limit=25'
  const invitationPath = useMemo(() => `/api/v1/iam/invitations?limit=25&status=${invitationStatus}`, [invitationStatus])
  const rolePath = '/api/v1/iam/roles?limit=25'

  const title = (() => {
    switch (dialog?.kind) {
      case 'member':
        return t('iam.member.title')
      case 'invitation':
        return t(dialog.invitation ? 'iam.inv.title' : 'iam.inv.new')
      case 'role':
        return t(dialog.role ? 'iam.role.edit' : 'iam.role.new')
      default:
        return ''
    }
  })()

  return (
    <div>
      <Link href="/erp" className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300">
        {t('erp.back')}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mist-100">{t('iam.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('iam.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/erp/iam/accept" className="text-sm text-blue-400 hover:text-blue-300">
            {t('iam.accept.open')}
          </Link>
          {canInvite ? (
            <button type="button" onClick={() => setDialog({ kind: 'invitation' })} className={secondaryButton}>
              {t('iam.inv.new')}
            </button>
          ) : null}
          {canManageRoles ? (
            <button type="button" onClick={() => setDialog({ kind: 'role' })} className={primaryButton}>
              {t('iam.role.new')}
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p role="status" className={`${noticeClass} mb-4`}>
          {t(notice)}
        </p>
      ) : null}

      {tab === null ? (
        <div className={panelClass}>
          <p role="status" className="py-8 text-center text-sm text-gray-300">
            {t('iam.noAccess')}
          </p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label={t('iam.title')} className="mb-4 flex flex-wrap gap-1 border-b border-[#30363d]">
            {visibleTabs.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`iam-tab-${value}`}
                aria-selected={tab === value}
                aria-controls={`iam-panel-${value}`}
                onClick={() => setTab(value)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
                  tab === value ? 'border-blue-500 font-semibold text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {t(`iam.tab.${value}`)}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`iam-panel-${tab}`} aria-labelledby={`iam-tab-${tab}`}>
            {tab === 'members' ? (
              <PagedTable<Member>
                path={memberPath}
                reloadToken={reloadToken}
                onOpen={(row) => setDialog({ kind: 'member', member: row })}
                emptyTitle="iam.member.empty"
                emptyHint="iam.member.emptyHint"
                columns={[
                  {
                    header: 'iam.member.name',
                    cell: (row) => (
                      <span className="inline-flex items-center gap-2">
                        {row.displayName || '—'}
                        {row.userId === userId ? <Badge tone="info">{t('iam.member.you')}</Badge> : null}
                      </span>
                    ),
                  },
                  { header: 'iam.member.email', cell: (row) => (row.email ? <Num>{row.email}</Num> : '—') },
                  { header: 'iam.member.role', cell: (row) => row.roleName },
                  { header: 'iam.member.joined', cell: (row) => <Num>{dateTimeText(row.createdAt)}</Num> },
                ]}
              />
            ) : null}

            {tab === 'invitations' ? (
              <PagedTable<Invitation>
                path={invitationPath}
                reloadToken={reloadToken}
                onOpen={(row) => setDialog({ kind: 'invitation', invitation: row })}
                emptyTitle="iam.inv.empty"
                emptyHint="iam.inv.emptyHint"
                toolbar={
                  <select
                    value={invitationStatus}
                    onChange={(event) => {
                      const value = event.target.value
                      if (value === 'all' || value === 'pending' || value === 'accepted' || value === 'revoked' || value === 'expired') setInvitationStatus(value)
                    }}
                    aria-label={t('iam.inv.status')}
                    className={`${inputClass} mt-0 w-auto`}
                  >
                    {(['all', 'pending', 'accepted', 'revoked', 'expired'] as const).map((value) => (
                      <option key={value} value={value}>
                        {t(invitationFilterLabel(value))}
                      </option>
                    ))}
                  </select>
                }
                columns={[
                  { header: 'iam.inv.email', cell: (row) => <Num>{row.email}</Num> },
                  { header: 'iam.inv.role', cell: (row) => row.roleName },
                  { header: 'iam.inv.status', cell: (row) => <InvitationStatusBadge status={row.status} /> },
                  { header: 'iam.inv.expires', cell: (row) => <Num>{dateTimeText(row.expiresAt)}</Num> },
                  { header: 'iam.inv.created', cell: (row) => <Num>{dateTimeText(row.createdAt)}</Num> },
                ]}
              />
            ) : null}

            {tab === 'roles' ? (
              <PagedTable<Role>
                path={rolePath}
                reloadToken={reloadToken}
                onOpen={(row) => setDialog({ kind: 'role', role: row })}
                emptyTitle="iam.role.empty"
                emptyHint="iam.role.emptyHint"
                columns={[
                  { header: 'iam.role.name', cell: (row) => row.name },
                  {
                    header: 'iam.role.kind',
                    cell: (row) => <Badge tone={row.isSystem ? 'gold' : 'neutral'}>{t(row.isSystem ? 'iam.role.system' : 'iam.role.custom')}</Badge>,
                  },
                  { header: 'iam.role.members', cell: (row) => <Num>{row.memberCount}</Num> },
                  { header: 'iam.role.permissions', cell: (row) => <Num>{row.permissions.length}</Num> },
                ]}
              />
            ) : null}
          </div>
        </>
      )}

      {dialog ? (
        <Modal title={title} onClose={closeDialog} size={dialog.kind === 'role' ? 'xl' : 'lg'}>
          {dialog.kind === 'member' ? (
            <MemberDialog key={dialog.member.userId} member={dialog.member} userId={userId} roles={roles} onSaved={changed} onCancel={closeDialog} onReload={reloadDialog} />
          ) : null}
          {dialog.kind === 'invitation' ? (
            <InvitationDialog
              key={dialog.invitation?.id ?? 'new'}
              invitation={dialog.invitation}
              roles={roles}
              onSaved={changed}
              onCancel={closeDialog}
              onReload={reloadDialog}
            />
          ) : null}
          {dialog.kind === 'role' ? <RoleDialog key={dialog.role?.id ?? 'new'} role={dialog.role} onSaved={changed} onCancel={closeDialog} onReload={reloadDialog} /> : null}
        </Modal>
      ) : null}
    </div>
  )
}
