'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiRequest, errorKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { adminRoles, flagKeys, type PermissionFlags } from '@/modules/admin/client'

type Status = 'active' | 'suspended' | 'revoked' | 'deleted'
type Account = {
  userId: string
  email: string | null
  displayName: string
  role: string
  status: Status
  flags: PermissionFlags
  version: number
}
type Activity = {
  id: string
  actorName: string
  actorRole: string
  actionType: string
  module: string
  descriptionAr: string
  metadata: { amountMinor?: number; currency?: string }
  createdAt: string
}
type Security = {
  sessionMinutes: number
  booksLocked: boolean
  planCode: string
  planNameAr: string
  version: number
}
type Tab = 'accounts' | 'permissions' | 'activity' | 'security'

const modules = [
  '',
  'finance',
  'inventory',
  'procurement',
  'sales',
  'kitchen',
  'delivery',
  'ai',
  'admin',
  'hr',
  'operations',
  'governance',
] as const

const inputClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]'
const labelClass = 'block text-sm font-medium text-[var(--ds-text-secondary)]'
const primaryBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
const secondaryBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] transition hover:bg-[var(--ds-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'
const dangerBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-4 py-2 text-sm font-semibold text-[var(--ds-negative)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
const noticeClass =
  'rounded-xl border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-positive)]'
const errorClass =
  'rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-negative)]'

function statusKey(status: Status): MessageKey {
  if (status === 'active') return 'admin.status.active'
  if (status === 'suspended') return 'admin.status.suspended'
  if (status === 'revoked') return 'admin.status.revoked'
  return 'admin.status.deleted'
}

function statusBadgeTone(status: Status): string {
  if (status === 'active') {
    return 'border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] text-[var(--ds-positive)]'
  }
  if (status === 'suspended') {
    return 'border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]'
  }
  return 'border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] text-[var(--ds-negative)]'
}

function roleKey(role: string): MessageKey {
  if (role === 'owner') return 'admin.role.owner'
  if (role === 'admin') return 'admin.role.admin'
  if (role === 'manager') return 'admin.role.manager'
  if (role === 'accountant') return 'admin.role.accountant'
  if (role === 'operations') return 'admin.role.operations'
  if (role === 'approver') return 'admin.role.approver'
  return 'admin.role.viewer'
}

function flagKey(flag: (typeof flagKeys)[number]): MessageKey {
  return `admin.flag.${flag}` as MessageKey
}

function isKnownModule(mod: string): mod is Exclude<(typeof modules)[number], ''> {
  return (modules as readonly string[]).includes(mod) && mod !== ''
}

function isTab(value: string): value is Tab {
  return value === 'accounts' || value === 'permissions' || value === 'activity' || value === 'security'
}

function UnavailableCell({ tooltip }: { tooltip: string }) {
  return (
    <span
      dir="ltr"
      title={tooltip}
      aria-label={tooltip}
      data-unavailable="true"
      className="ds-num tabular-nums"
      style={{ color: 'var(--ds-unavailable)' }}
    >
      {UNAVAILABLE_DASH}
    </span>
  )
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const canInvite = useCan(permissions.iamMemberInvite)
  const canUpdate = useCan(permissions.iamMemberUpdate)
  const canSecure = useCan(permissions.iamRoleManage)
  const canPurge = useCan(permissions.hrEmployeeManage)

  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'accounts')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [actionError, setActionError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [security, setSecurity] = useState<Security | null>(null)
  const [selected, setSelected] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<(typeof adminRoles)[number]>('accountant')
  const [moduleFilter, setModuleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sessionMinutes, setSessionMinutes] = useState('120')
  const [booksLocked, setBooksLocked] = useState(false)
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  const loadActivity = useCallback(
    (nextModule = moduleFilter, nextSearch = search) => {
      const params = new URLSearchParams({ limit: '30' })
      if (nextModule) params.set('module', nextModule)
      if (nextSearch.trim()) params.set('q', nextSearch.trim())
      return apiRequest<{ data: Activity[] }>(`/api/v1/admin/activity?${params.toString()}`)
    },
    [moduleFilter, search],
  )

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: Account[] }>('/api/v1/admin/accounts', { signal: controller.signal }),
      apiRequest<{ data: Activity[] }>('/api/v1/admin/activity?limit=30', { signal: controller.signal }),
      apiRequest<{ data: Security }>('/api/v1/admin/security', { signal: controller.signal }),
    ])
      .then(([accountPage, activityPage, securityPage]) => {
        setAccounts(accountPage.data)
        setActivity(activityPage.data)
        setSecurity(securityPage.data)
        setSelected(accountPage.data[0]?.userId ?? '')
        setSessionMinutes(String(securityPage.data.sessionMinutes))
        setBooksLocked(securityPage.data.booksLocked)
        setActionError(null)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [reloadTick])

  const current = accounts.find((account) => account.userId === selected) ?? null

  async function refreshAccounts(preferred?: string) {
    const page = await apiRequest<{ data: Account[] }>('/api/v1/admin/accounts')
    setAccounts(page.data)
    setSelected(preferred ?? page.data[0]?.userId ?? '')
    const feed = await loadActivity()
    setActivity(feed.data)
  }

  async function addAccount(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      const created = await apiRequest<{ data: Account }>('/api/v1/admin/accounts', {
        method: 'POST',
        body: { email, displayName, role },
      })
      setEmail('')
      setDisplayName('')
      setNotice(t('adm.saved'))
      await refreshAccounts(created.data.userId)
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(account: Account, status: Status) {
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      await apiRequest(`/api/v1/admin/accounts/${account.userId}`, {
        method: 'PATCH',
        body: { version: account.version, status },
      })
      setNotice(t('adm.saved'))
      await refreshAccounts(account.userId)
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function saveFlags(event: FormEvent) {
    event.preventDefault()
    if (!current) return
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      await apiRequest(`/api/v1/admin/accounts/${current.userId}`, {
        method: 'PATCH',
        body: { version: current.version, role: current.role, flags: current.flags },
      })
      setNotice(t('adm.saved'))
      await refreshAccounts(current.userId)
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function filterActivity(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setActionError(null)
    try {
      const feed = await loadActivity()
      setActivity(feed.data)
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function saveSecurity(event: FormEvent) {
    event.preventDefault()
    if (!security) return
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      const saved = await apiRequest<{ data: Security }>('/api/v1/admin/security', {
        method: 'PATCH',
        body: { version: security.version, sessionMinutes: Number(sessionMinutes), booksLocked },
      })
      setSecurity(saved.data)
      setNotice(t('adm.saved'))
      const feed = await loadActivity()
      setActivity(feed.data)
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function purgeDemo() {
    if (!confirmPurge) {
      setConfirmPurge(true)
      return
    }
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      await apiRequest('/api/v1/admin/demo-purge', { method: 'POST', body: {} })
      setNotice(t('admin.purgeDone'))
      setConfirmPurge(false)
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-4">
        <SectionCard title={t('adm.title')} subtitle={t('admin.lead')} locale={fmtLocale}>
          <StateBlock state="loading" locale={fmtLocale} title={t('adm.loading')} skeletonRows={4} />
        </SectionCard>
      </div>
    )
  }

  if (phase === 'error') {
    const forbidden = error === 'erp.err.forbidden'
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-4">
        <SectionCard title={t('adm.title')} subtitle={t('admin.lead')} locale={fmtLocale}>
          <StateBlock
            state={forbidden ? 'forbidden' : 'error'}
            locale={fmtLocale}
            title={t(error)}
            onRetry={forbidden ? undefined : () => setReloadTick((value) => value + 1)}
          />
        </SectionCard>
      </div>
    )
  }

  const tabs: Array<{ id: Tab; label: MessageKey }> = [
    { id: 'accounts', label: 'admin.tab.accounts' },
    { id: 'permissions', label: 'admin.tab.permissions' },
    { id: 'activity', label: 'admin.tab.activity' },
    { id: 'security', label: 'admin.tab.security' },
  ]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <SectionCard
        title={t('adm.title')}
        subtitle={t('admin.lead')}
        locale={fmtLocale}
        actions={
          canPurge ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={dangerBtnClass}
                type="button"
                disabled={busy}
                onClick={() => void purgeDemo()}
              >
                {confirmPurge
                  ? isAr
                    ? 'تأكيد تنظيف البيانات التجريبية'
                    : 'Confirm Purge'
                  : t('admin.purge')}
              </button>
              {confirmPurge ? (
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={busy}
                  onClick={() => setConfirmPurge(false)}
                >
                  {t('erp.cancel')}
                </button>
              ) : null}
            </div>
          ) : undefined
        }
      >
        <div
          role="tablist"
          aria-label={t('adm.title')}
          className="flex flex-wrap gap-2 border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((item) => {
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`admin-tab-${item.id}`}
                aria-selected={active}
                aria-controls={`admin-panel-${item.id}`}
                onClick={() => setTab(item.id)}
                className={active ? primaryBtnClass : secondaryBtnClass}
              >
                {t(item.label)}
              </button>
            )
          })}
        </div>

        {notice ? (
          <p role="status" className={`${noticeClass} mt-4`}>
            {notice}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className={`${errorClass} mt-4`}>
            {t(actionError)}
          </p>
        ) : null}
      </SectionCard>

      <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
        {tab === 'accounts' ? (
          <SectionCard
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span>{t('admin.tab.accounts')}</span>
                <span
                  dir="ltr"
                  className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums"
                >
                  {formatInt(accounts.length, fmtLocale)}
                </span>
              </span>
            }
            locale={fmtLocale}
          >
            {canInvite ? (
              <form className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={addAccount}>
                <label className={labelClass}>
                  {t('admin.account.name')}
                  <input
                    className={inputClass}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                  />
                </label>
                <label className={labelClass}>
                  {t('admin.account.email')}
                  <input
                    className={inputClass}
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
                <label className={labelClass}>
                  {t('admin.account.role')}
                  <select
                    className={inputClass}
                    value={role}
                    onChange={(event) => setRole(event.target.value as (typeof adminRoles)[number])}
                  >
                    {adminRoles.map((item) => (
                      <option key={item} value={item}>
                        {t(roleKey(item))}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button className={primaryBtnClass} type="submit" disabled={busy}>
                    {t('admin.account.add')}
                  </button>
                </div>
              </form>
            ) : null}

            {accounts.length === 0 ? (
              <StateBlock state="empty" locale={fmtLocale} title={t('admin.account.empty')} />
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
                    <tr>
                      <th className="px-3.5 py-3 text-start">{t('admin.account.name')}</th>
                      <th className="px-3.5 py-3 text-start">{t('admin.account.email')}</th>
                      <th className="px-3.5 py-3 text-start">{t('admin.account.role')}</th>
                      <th className="px-3.5 py-3 text-start">{t('admin.account.status')}</th>
                      <th className="px-3.5 py-3 text-start">{t('admin.account.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                    {accounts.map((account) => (
                      <tr key={account.userId} className="hover:bg-[var(--ds-bg-hover)]">
                        <td className="px-3.5 py-3 font-medium text-[var(--ds-text-primary)]">
                          {account.displayName || <UnavailableCell tooltip={unavailableTooltip} />}
                        </td>
                        <td className="px-3.5 py-3 text-[var(--ds-text-secondary)]">
                          {account.email ? (
                            <span dir="ltr" className="font-mono text-xs">
                              {account.email}
                            </span>
                          ) : (
                            <UnavailableCell tooltip={unavailableTooltip} />
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-[var(--ds-text-primary)]">
                          {t(roleKey(account.role))}
                        </td>
                        <td className="px-3.5 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeTone(account.status)}`}
                          >
                            {t(statusKey(account.status))}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="flex flex-wrap gap-2">
                            {canUpdate && account.status === 'active' ? (
                              <button
                                type="button"
                                className={secondaryBtnClass}
                                disabled={busy}
                                onClick={() => void changeStatus(account, 'suspended')}
                              >
                                {t('admin.account.suspend')}
                              </button>
                            ) : null}
                            {canUpdate && (account.status === 'suspended' || account.status === 'revoked') ? (
                              <button
                                type="button"
                                className={secondaryBtnClass}
                                disabled={busy}
                                onClick={() => void changeStatus(account, 'active')}
                              >
                                {t('admin.account.activate')}
                              </button>
                            ) : null}
                            {canUpdate && account.status !== 'deleted' ? (
                              <button
                                type="button"
                                className={dangerBtnClass}
                                disabled={busy}
                                onClick={() => void changeStatus(account, 'deleted')}
                              >
                                {t('admin.account.delete')}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        ) : null}

        {tab === 'permissions' ? (
          <SectionCard title={t('admin.tab.permissions')} locale={fmtLocale}>
            <label className={labelClass}>
              {t('admin.account.name')}
              <select
                className={`${inputClass} sm:max-w-md`}
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.userId} value={account.userId}>
                    {account.displayName}
                  </option>
                ))}
              </select>
            </label>
            {current ? (
              <form className="mt-5 space-y-4" onSubmit={saveFlags}>
                <label className={labelClass}>
                  {t('admin.account.role')}
                  <select
                    className={`${inputClass} sm:max-w-md`}
                    value={current.role}
                    onChange={(event) =>
                      setAccounts((rows) =>
                        rows.map((row) =>
                          row.userId === current.userId ? { ...row, role: event.target.value } : row,
                        ),
                      )
                    }
                  >
                    {adminRoles.map((item) => (
                      <option key={item} value={item}>
                        {t(roleKey(item))}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {flagKeys.map((flag) => (
                    <label
                      key={flag}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--ds-text-primary)]"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-600"
                        checked={current.flags[flag]}
                        onChange={(event) =>
                          setAccounts((rows) =>
                            rows.map((row) =>
                              row.userId === current.userId
                                ? { ...row, flags: { ...row.flags, [flag]: event.target.checked } }
                                : row,
                            ),
                          )
                        }
                      />
                      <span>{t(flagKey(flag))}</span>
                    </label>
                  ))}
                </div>
                {canUpdate ? (
                  <button className={primaryBtnClass} type="submit" disabled={busy}>
                    {t('admin.security.save')}
                  </button>
                ) : null}
              </form>
            ) : (
              <div className="mt-4">
                <StateBlock state="empty" locale={fmtLocale} title={t('admin.account.empty')} />
              </div>
            )}
          </SectionCard>
        ) : null}

        {tab === 'activity' ? (
          <SectionCard title={t('admin.tab.activity')} locale={fmtLocale}>
            <form className="mb-5 flex flex-wrap items-end gap-3" onSubmit={filterActivity}>
              <label className={labelClass}>
                {t('admin.activity.module')}
                <select
                  className={`${inputClass} min-w-[11rem]`}
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                >
                  {modules.map((item) => (
                    <option key={item || 'all'} value={item}>
                      {item ? t(`admin.module.${item}` as MessageKey) : t('admin.activity.all')}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${labelClass} min-w-[13rem] flex-1 sm:max-w-xs`}>
                {t('admin.activity.search')}
                <input
                  className={inputClass}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <button className={secondaryBtnClass} type="submit" disabled={busy}>
                {t('admin.activity.filter')}
              </button>
            </form>

            {activity.length === 0 ? (
              <StateBlock state="empty" locale={fmtLocale} title={t('admin.activity.empty')} />
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
                    <tr>
                      <th className="px-3.5 py-3 text-start">{t('admin.activity.when')}</th>
                      <th className="px-3.5 py-3 text-start">{t('admin.activity.actor')}</th>
                      <th className="px-3.5 py-3 text-start">{t('admin.activity.moduleCol')}</th>
                      <th className="px-3.5 py-3 text-start">{t('admin.activity.action')}</th>
                      <th className="px-3.5 py-3 text-end">{t('admin.activity.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                    {activity.map((row) => {
                      const amountMinor = row.metadata.amountMinor
                      const formattedWhen = formatDateTime(row.createdAt, fmtLocale)
                      return (
                        <tr key={row.id} className="hover:bg-[var(--ds-bg-hover)]">
                          <td className="px-3.5 py-3 whitespace-nowrap text-[var(--ds-text-secondary)]">
                            {formattedWhen === UNAVAILABLE_DASH ? (
                              <UnavailableCell tooltip={unavailableTooltip} />
                            ) : (
                              <span dir="ltr" className="ds-num tabular-nums">
                                {formattedWhen}
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-[var(--ds-text-primary)]">
                            {row.actorName || <UnavailableCell tooltip={unavailableTooltip} />}
                          </td>
                          <td className="px-3.5 py-3 text-[var(--ds-text-secondary)]">
                            {isKnownModule(row.module)
                              ? t(`admin.module.${row.module}` as MessageKey)
                              : row.module || <UnavailableCell tooltip={unavailableTooltip} />}
                          </td>
                          <td className="px-3.5 py-3 text-[var(--ds-text-primary)]">
                            {row.descriptionAr || <UnavailableCell tooltip={unavailableTooltip} />}
                          </td>
                          <td className="px-3.5 py-3 text-end">
                            {typeof amountMinor === 'number' && Number.isFinite(amountMinor) ? (
                              <span dir="ltr" className="ds-num whitespace-nowrap font-semibold tabular-nums text-[var(--ds-text-primary)]">
                                {formatKwd(amountMinor / 1000, fmtLocale)}
                              </span>
                            ) : (
                              <UnavailableCell tooltip={unavailableTooltip} />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        ) : null}

        {tab === 'security' ? (
          <SectionCard title={t('admin.tab.security')} locale={fmtLocale}>
            {!security ? (
              <StateBlock state="unavailable" locale={fmtLocale} />
            ) : (
              <>
                <p className="text-sm font-medium text-[var(--ds-text-secondary)]">
                  {t('admin.security.plan')}:{' '}
                  <span className="font-semibold text-[var(--ds-text-primary)]">
                    {security.planNameAr || security.planCode || UNAVAILABLE_DASH}
                  </span>
                </p>
                <form className="mt-4 max-w-md space-y-4" onSubmit={saveSecurity}>
                  <label className={labelClass}>
                    {t('admin.security.session')}
                    <input
                      className={inputClass}
                      type="number"
                      dir="ltr"
                      min={15}
                      max={720}
                      value={sessionMinutes}
                      onChange={(event) => setSessionMinutes(event.target.value)}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--ds-text-primary)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={booksLocked}
                      onChange={(event) => setBooksLocked(event.target.checked)}
                    />
                    <span>{t('admin.security.lock')}</span>
                  </label>
                  {canSecure ? (
                    <button className={primaryBtnClass} type="submit" disabled={busy}>
                      {t('admin.security.save')}
                    </button>
                  ) : null}
                </form>
              </>
            )}
          </SectionCard>
        ) : null}
      </div>
    </div>
  )
}

export default function AdminWorkspace({
  permissions: held,
  initialTab = 'accounts',
}: {
  permissions: readonly string[]
  initialTab?: string
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} />
    </PermissionProvider>
  )
}
