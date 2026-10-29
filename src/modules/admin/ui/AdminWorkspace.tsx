'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, errorKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { dangerButton, errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
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
type Security = { sessionMinutes: number; booksLocked: boolean; planCode: string; planNameAr: string; version: number }
type Tab = 'accounts' | 'permissions' | 'activity' | 'security'

const modules = ['', 'finance', 'inventory', 'procurement', 'sales', 'kitchen', 'delivery', 'ai', 'admin', 'hr', 'operations', 'governance'] as const

function statusKey(status: Status): MessageKey {
  if (status === 'active') return 'admin.status.active'
  if (status === 'suspended') return 'admin.status.suspended'
  if (status === 'revoked') return 'admin.status.revoked'
  return 'admin.status.deleted'
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

function isTab(value: string): value is Tab {
  return value === 'accounts' || value === 'permissions' || value === 'activity' || value === 'security'
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t, locale } = useI18n()
  const canInvite = useCan(permissions.iamMemberInvite)
  const canUpdate = useCan(permissions.iamMemberUpdate)
  const canSecure = useCan(permissions.iamRoleManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'accounts')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
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
  const [busy, setBusy] = useState(false)

  function loadActivity(nextModule = moduleFilter, nextSearch = search) {
    const params = new URLSearchParams({ limit: '30' })
    if (nextModule) params.set('module', nextModule)
    if (nextSearch.trim()) params.set('q', nextSearch.trim())
    return apiRequest<{ data: Activity[] }>(`/api/v1/admin/activity?${params.toString()}`)
  }

  useEffect(() => {
    const controller = new AbortController()
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
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [])

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
      setError(errorKey(caught))
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(account: Account, status: Status) {
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/admin/accounts/${account.userId}`, {
        method: 'PATCH',
        body: { version: account.version, status },
      })
      setNotice(t('adm.saved'))
      await refreshAccounts(account.userId)
    } catch (caught) {
      setError(errorKey(caught))
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  async function saveFlags(event: FormEvent) {
    event.preventDefault()
    if (!current) return
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/admin/accounts/${current.userId}`, {
        method: 'PATCH',
        body: { version: current.version, role: current.role, flags: current.flags },
      })
      setNotice(t('adm.saved'))
      await refreshAccounts(current.userId)
    } catch (caught) {
      setError(errorKey(caught))
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  async function filterActivity(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const feed = await loadActivity()
      setActivity(feed.data)
    } catch (caught) {
      setError(errorKey(caught))
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  async function saveSecurity(event: FormEvent) {
    event.preventDefault()
    if (!security) return
    setBusy(true)
    setNotice(null)
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
      setError(errorKey(caught))
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') return <p className="text-sm text-gray-400">{t('adm.loading')}</p>
  if (phase === 'error') return <p className={errorClass}>{t(error)}</p>

  const tabs: Array<{ id: Tab; label: MessageKey }> = [
    { id: 'accounts', label: 'admin.tab.accounts' },
    { id: 'permissions', label: 'admin.tab.permissions' },
    { id: 'activity', label: 'admin.tab.activity' },
    { id: 'security', label: 'admin.tab.security' },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-100">{t('adm.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">{t('admin.lead')}</p>
      </header>
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? primaryButton : secondaryButton} onClick={() => setTab(item.id)}>
            {t(item.label)}
          </button>
        ))}
      </div>

      {tab === 'accounts' ? (
        <section className={panelClass}>
          {canInvite ? (
            <form className="mb-6 grid gap-3 sm:grid-cols-4" onSubmit={addAccount}>
              <label className={labelClass}>
                {t('admin.account.name')}
                <input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
              </label>
              <label className={labelClass}>
                {t('admin.account.email')}
                <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className={labelClass}>
                {t('admin.account.role')}
                <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as (typeof adminRoles)[number])}>
                  {adminRoles.map((item) => (
                    <option key={item} value={item}>{t(roleKey(item))}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button className={primaryButton} type="submit" disabled={busy}>{t('admin.account.add')}</button>
              </div>
            </form>
          ) : null}
          {accounts.length === 0 ? <p className="text-sm text-gray-400">{t('admin.account.empty')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr>
                    <th className="px-2 py-2 text-start">{t('admin.account.name')}</th>
                    <th className="px-2 py-2 text-start">{t('admin.account.email')}</th>
                    <th className="px-2 py-2 text-start">{t('admin.account.role')}</th>
                    <th className="px-2 py-2 text-start">{t('admin.account.status')}</th>
                    <th className="px-2 py-2 text-start">{t('admin.account.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.userId} className="border-t border-[#30363d]">
                      <td className="px-2 py-3 text-gray-100">{account.displayName}</td>
                      <td className="px-2 py-3 text-gray-300">{account.email}</td>
                      <td className="px-2 py-3">{t(roleKey(account.role))}</td>
                      <td className="px-2 py-3">{t(statusKey(account.status))}</td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canUpdate && account.status === 'active' ? (
                            <button type="button" className={secondaryButton} disabled={busy} onClick={() => changeStatus(account, 'suspended')}>{t('admin.account.suspend')}</button>
                          ) : null}
                          {canUpdate && (account.status === 'suspended' || account.status === 'revoked') ? (
                            <button type="button" className={secondaryButton} disabled={busy} onClick={() => changeStatus(account, 'active')}>{t('admin.account.activate')}</button>
                          ) : null}
                          {canUpdate && account.status !== 'deleted' ? (
                            <button type="button" className={dangerButton} disabled={busy} onClick={() => changeStatus(account, 'deleted')}>{t('admin.account.delete')}</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'permissions' ? (
        <section className={panelClass}>
          <label className={labelClass}>
            {t('admin.account.name')}
            <select className={inputClass} value={selected} onChange={(event) => setSelected(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.userId} value={account.userId}>{account.displayName}</option>
              ))}
            </select>
          </label>
          {current ? (
            <form className="mt-4 space-y-4" onSubmit={saveFlags}>
              <label className={labelClass}>
                {t('admin.account.role')}
                <select
                  className={inputClass}
                  value={current.role}
                  onChange={(event) => setAccounts((rows) => rows.map((row) => row.userId === current.userId ? { ...row, role: event.target.value } : row))}
                >
                  {adminRoles.map((item) => <option key={item} value={item}>{t(roleKey(item))}</option>)}
                </select>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {flagKeys.map((flag) => (
                  <label key={flag} className="flex items-center gap-2 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={current.flags[flag]}
                      onChange={(event) => setAccounts((rows) => rows.map((row) => row.userId === current.userId ? { ...row, flags: { ...row.flags, [flag]: event.target.checked } } : row))}
                    />
                    {t(flagKey(flag))}
                  </label>
                ))}
              </div>
              {canUpdate ? <button className={primaryButton} type="submit" disabled={busy}>{t('admin.security.save')}</button> : null}
            </form>
          ) : <p className="mt-4 text-sm text-gray-400">{t('admin.account.empty')}</p>}
        </section>
      ) : null}

      {tab === 'activity' ? (
        <section className={panelClass}>
          <form className="mb-4 flex flex-wrap gap-3" onSubmit={filterActivity}>
            <label className={labelClass}>
              {t('admin.activity.module')}
              <select className={inputClass} value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
                {modules.map((item) => (
                  <option key={item || 'all'} value={item}>{item ? t(`admin.module.${item}` as MessageKey) : t('admin.activity.all')}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {t('admin.activity.search')}
              <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <div className="flex items-end">
              <button className={secondaryButton} type="submit" disabled={busy}>{t('admin.activity.filter')}</button>
            </div>
          </form>
          {activity.length === 0 ? <p className="text-sm text-gray-400">{t('admin.activity.empty')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr>
                    <th className="px-2 py-2 text-start">{t('admin.activity.when')}</th>
                    <th className="px-2 py-2 text-start">{t('admin.activity.actor')}</th>
                    <th className="px-2 py-2 text-start">{t('admin.activity.moduleCol')}</th>
                    <th className="px-2 py-2 text-start">{t('admin.activity.action')}</th>
                    <th className="px-2 py-2 text-start">{t('admin.activity.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((row) => (
                    <tr key={row.id} className="border-t border-[#30363d]">
                      <td className="px-2 py-3 whitespace-nowrap text-gray-300">{new Date(row.createdAt).toLocaleString(locale === 'ar' ? 'ar-KW' : 'en-GB')}</td>
                      <td className="px-2 py-3">{row.actorName}</td>
                      <td className="px-2 py-3">{t(`admin.module.${row.module}` as MessageKey)}</td>
                      <td className="px-2 py-3 text-gray-100">{row.descriptionAr}</td>
                      <td className="px-2 py-3">{typeof row.metadata.amountMinor === 'number' ? `${formatMinor(row.metadata.amountMinor)} ${t('admin.kwd')}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'security' && security ? (
        <section className={panelClass}>
          <p className="text-sm text-gray-300">{t('admin.security.plan')}: {security.planNameAr}</p>
          <form className="mt-4 max-w-md space-y-4" onSubmit={saveSecurity}>
            <label className={labelClass}>
              {t('admin.security.session')}
              <input className={inputClass} type="number" min={15} max={720} value={sessionMinutes} onChange={(event) => setSessionMinutes(event.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-200">
              <input type="checkbox" checked={booksLocked} onChange={(event) => setBooksLocked(event.target.checked)} />
              {t('admin.security.lock')}
            </label>
            {canSecure ? <button className={primaryButton} type="submit" disabled={busy}>{t('admin.security.save')}</button> : null}
          </form>
        </section>
      ) : null}
    </div>
  )
}

export default function AdminWorkspace({ permissions: held, initialTab = 'accounts' }: { permissions: readonly string[]; initialTab?: string }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} />
    </PermissionProvider>
  )
}
