'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { InvitationDialog } from '@/components/erp/iam/InvitationDialog'
import { MemberDialog } from '@/components/erp/iam/MemberDialog'
import { RoleDialog } from '@/components/erp/iam/RoleDialog'
import {
  IamModal,
  IamPagedTable,
  IamPill,
  IamUnavailableDash,
  InvitationStatusBadge,
  formatIamDateTime,
  iamInputClass,
  iamNoticeClass,
  iamPrimaryBtn,
  iamSecondaryBtn,
  useCatalog,
} from '@/components/erp/iam/shared'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import { formatInt, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Invitation, Member, Role } from '@/lib/iam/types'

const allTabs = ['members', 'invitations', 'roles'] as const
type Tab = (typeof allTabs)[number]
type InvitationFilter = 'all' | 'pending' | 'accepted' | 'revoked' | 'expired'
type Dialog =
  | { kind: 'member'; member: Member }
  | { kind: 'invitation'; invitation?: Invitation }
  | { kind: 'role'; role?: Role }
  | null

/**
 * Members, invitations and roles. `permissions` and `userId` only decide what is shown; the API checks every request again.
 */
export default function IamWorkspace({
  permissions: held,
  userId,
}: {
  permissions: readonly string[]
  userId: string
}) {
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
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
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
  const invitationPath = useMemo(
    () => `/api/v1/iam/invitations?limit=25&status=${invitationStatus}`,
    [invitationStatus],
  )
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
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/erp"
          className="ds-focus-ring inline-flex items-center text-sm font-semibold text-[var(--ds-accent)] hover:underline"
        >
          {t('erp.back')}
        </Link>
        <Link
          href="/erp/iam/accept"
          className="ds-focus-ring inline-flex items-center text-sm font-semibold text-[var(--ds-accent)] hover:underline"
        >
          {t('iam.accept.open')}
        </Link>
      </div>

      <SectionCard
        title={t('iam.title')}
        subtitle={t('iam.subtitle')}
        locale={fmtLocale}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canInvite ? (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'invitation' })}
                className={iamSecondaryBtn}
              >
                {t('iam.inv.new')}
              </button>
            ) : null}
            {canManageRoles ? (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'role' })}
                className={iamPrimaryBtn}
              >
                {t('iam.role.new')}
              </button>
            ) : null}
          </div>
        }
      >
        {notice ? (
          <p role="status" className={`${iamNoticeClass} mb-4`}>
            {t(notice)}
          </p>
        ) : null}

        {tab === null ? (
          <StateBlock state="forbidden" locale={fmtLocale} title={t('iam.noAccess')} />
        ) : (
          <div
            role="tablist"
            aria-label={t('iam.title')}
            className="flex flex-wrap gap-2 border-b border-[var(--ds-border-hairline)] pb-3"
          >
            {visibleTabs.map((value) => {
              const active = tab === value
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  id={`iam-tab-${value}`}
                  aria-selected={active}
                  aria-controls={`iam-panel-${value}`}
                  onClick={() => setTab(value)}
                  className={active ? iamPrimaryBtn : iamSecondaryBtn}
                >
                  {t(`iam.tab.${value}`)}
                </button>
              )
            })}
          </div>
        )}
      </SectionCard>

      {tab !== null ? (
        <div role="tabpanel" id={`iam-panel-${tab}`} aria-labelledby={`iam-tab-${tab}`}>
          {tab === 'members' ? (
            <IamPagedTable<Member>
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
                      <span>
                        {row.displayName || <IamUnavailableDash locale={fmtLocale} />}
                      </span>
                      {row.userId === userId ? (
                        <IamPill tone="info">{t('iam.member.you')}</IamPill>
                      ) : null}
                    </span>
                  ),
                },
                {
                  header: 'iam.member.email',
                  cell: (row) =>
                    row.email ? (
                      <span dir="ltr" className="font-mono text-xs">
                        {row.email}
                      </span>
                    ) : (
                      <IamUnavailableDash locale={fmtLocale} />
                    ),
                },
                {
                  header: 'iam.member.role',
                  cell: (row) => row.roleName || <IamUnavailableDash locale={fmtLocale} />,
                },
                {
                  header: 'iam.member.joined',
                  cell: (row) => (
                    <span dir="ltr" className="ds-num whitespace-nowrap tabular-nums">
                      {formatIamDateTime(row.createdAt, fmtLocale)}
                    </span>
                  ),
                },
              ]}
            />
          ) : null}

          {tab === 'invitations' ? (
            <IamPagedTable<Invitation>
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
                    if (
                      value === 'all' ||
                      value === 'pending' ||
                      value === 'accepted' ||
                      value === 'revoked' ||
                      value === 'expired'
                    ) {
                      setInvitationStatus(value)
                    }
                  }}
                  aria-label={t('iam.inv.status')}
                  className={`${iamInputClass} mt-0 w-auto`}
                >
                  {(['all', 'pending', 'accepted', 'revoked', 'expired'] as const).map((value) => (
                    <option key={value} value={value}>
                      {t(invitationFilterLabel(value))}
                    </option>
                  ))}
                </select>
              }
              columns={[
                {
                  header: 'iam.inv.email',
                  cell: (row) => (
                    <span dir="ltr" className="font-mono text-xs">
                      {row.email}
                    </span>
                  ),
                },
                { header: 'iam.inv.role', cell: (row) => row.roleName },
                {
                  header: 'iam.inv.status',
                  cell: (row) => <InvitationStatusBadge status={row.status} />,
                },
                {
                  header: 'iam.inv.expires',
                  cell: (row) => (
                    <span dir="ltr" className="ds-num whitespace-nowrap tabular-nums">
                      {formatIamDateTime(row.expiresAt, fmtLocale)}
                    </span>
                  ),
                },
                {
                  header: 'iam.inv.created',
                  cell: (row) => (
                    <span dir="ltr" className="ds-num whitespace-nowrap tabular-nums">
                      {formatIamDateTime(row.createdAt, fmtLocale)}
                    </span>
                  ),
                },
              ]}
            />
          ) : null}

          {tab === 'roles' ? (
            <IamPagedTable<Role>
              path={rolePath}
              reloadToken={reloadToken}
              onOpen={(row) => setDialog({ kind: 'role', role: row })}
              emptyTitle="iam.role.empty"
              emptyHint="iam.role.emptyHint"
              columns={[
                { header: 'iam.role.name', cell: (row) => row.name },
                {
                  header: 'iam.role.kind',
                  cell: (row) => (
                    <IamPill tone={row.isSystem ? 'gold' : 'neutral'}>
                      {t(row.isSystem ? 'iam.role.system' : 'iam.role.custom')}
                    </IamPill>
                  ),
                },
                {
                  header: 'iam.role.members',
                  cell: (row) => (
                    <span dir="ltr" className="ds-num tabular-nums">
                      {formatInt(row.memberCount, fmtLocale)}
                    </span>
                  ),
                },
                {
                  header: 'iam.role.permissions',
                  cell: (row) => (
                    <span dir="ltr" className="ds-num tabular-nums">
                      {formatInt(row.permissions.length, fmtLocale)}
                    </span>
                  ),
                },
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {dialog ? (
        <IamModal title={title} onClose={closeDialog} size={dialog.kind === 'role' ? 'xl' : 'lg'}>
          {dialog.kind === 'member' ? (
            <MemberDialog
              key={dialog.member.userId}
              member={dialog.member}
              userId={userId}
              roles={roles}
              onSaved={changed}
              onCancel={closeDialog}
              onReload={reloadDialog}
            />
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
          {dialog.kind === 'role' ? (
            <RoleDialog
              key={dialog.role?.id ?? 'new'}
              role={dialog.role}
              onSaved={changed}
              onCancel={closeDialog}
              onReload={reloadDialog}
            />
          ) : null}
        </IamModal>
      ) : null}
    </div>
  )
}
