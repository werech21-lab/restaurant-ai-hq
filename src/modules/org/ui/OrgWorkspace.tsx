'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import { formatInt, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Branch, Brand } from '@/modules/org/client'
import { BranchDialog } from '@/modules/org/ui/BranchDialog'
import { BrandDialog } from '@/modules/org/ui/BrandDialog'
import {
  CatalogNote,
  OrgModal,
  OrgPagedTable,
  OrgStatusBadge,
  OrgUnavailableDash,
  formatOrgDateTime,
  orgInputClass,
  orgNoticeClass,
  orgPrimaryBtn,
  orgSecondaryBtn,
  useCatalog,
} from '@/modules/org/ui/shared'

const allTabs = ['brands', 'branches'] as const
type Tab = (typeof allTabs)[number]
type StatusFilter = 'all' | 'active' | 'inactive'
type Dialog = { kind: 'brand'; brand?: Brand } | { kind: 'branch'; branch?: Branch } | null

/**
 * Brands and branches. `permissions` come from the server page and only decide what is shown; the API checks every request again.
 */
export default function OrgWorkspace({ permissions: held }: { permissions: readonly string[] }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace />
    </PermissionProvider>
  )
}

function Workspace() {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const canReadBrands = useCan(permissions.orgBrandRead)
  const canReadBranches = useCan(permissions.orgBranchRead)
  const canManageBrands = useCan(permissions.orgBrandManage)
  const canManageBranches = useCan(permissions.orgBranchManage)

  const visibleTabs = useMemo<Tab[]>(() => {
    const allowed: Record<Tab, boolean> = { brands: canReadBrands, branches: canReadBranches }
    return allTabs.filter((value) => allowed[value])
  }, [canReadBrands, canReadBranches])

  const [chosenTab, setTab] = useState<Tab>('brands')
  const tab: Tab | null = visibleTabs.includes(chosenTab) ? chosenTab : (visibleTabs[0] ?? null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [brandStatus, setBrandStatus] = useState<StatusFilter>('all')
  const [branchStatus, setBranchStatus] = useState<StatusFilter>('all')
  const [brandFilter, setBrandFilter] = useState('')
  const brands = useCatalog<Brand>(
    canReadBrands,
    '/api/v1/org/brands?limit=100&status=all',
    reloadToken,
  )

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

  const brandPath = useMemo(() => `/api/v1/org/brands?limit=25&status=${brandStatus}`, [brandStatus])
  const branchPath = useMemo(() => {
    const query = new URLSearchParams({ limit: '25', status: branchStatus })
    if (brandFilter) query.set('brandId', brandFilter)
    return `/api/v1/org/branches?${query.toString()}`
  }, [branchStatus, brandFilter])

  const title = (() => {
    switch (dialog?.kind) {
      case 'brand':
        return t(dialog.brand ? 'org.brand.edit' : 'org.brand.new')
      case 'branch':
        return t(dialog.branch ? 'org.branch.edit' : 'org.branch.new')
      default:
        return ''
    }
  })()

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <div>
        <Link
          href="/erp"
          className="ds-focus-ring inline-flex items-center text-sm font-semibold text-[var(--ds-accent)] hover:underline"
        >
          {t('erp.back')}
        </Link>
      </div>

      <SectionCard
        title={t('org.title')}
        subtitle={t('org.subtitle')}
        locale={fmtLocale}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageBrands ? (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'brand' })}
                className={orgSecondaryBtn}
              >
                {t('org.brand.new')}
              </button>
            ) : null}
            {canManageBranches ? (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'branch' })}
                className={orgPrimaryBtn}
              >
                {t('org.branch.new')}
              </button>
            ) : null}
          </div>
        }
      >
        {notice ? (
          <p role="status" className={`${orgNoticeClass} mb-4`}>
            {t(notice)}
          </p>
        ) : null}

        {tab === null ? (
          <StateBlock state="forbidden" locale={fmtLocale} title={t('org.noAccess')} />
        ) : (
          <div
            role="tablist"
            aria-label={t('org.title')}
            className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar border-b border-[var(--ds-border-hairline)] pb-3"
          >
            {visibleTabs.map((value) => {
              const active = tab === value
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  id={`org-tab-${value}`}
                  aria-selected={active}
                  aria-controls={`org-panel-${value}`}
                  onClick={() => setTab(value)}
                  className={`shrink-0 whitespace-nowrap ${active ? orgPrimaryBtn : orgSecondaryBtn}`}
                >
                  {t(`org.tab.${value}`)}
                </button>
              )
            })}
          </div>
        )}
      </SectionCard>

      {tab !== null ? (
        <div role="tabpanel" id={`org-panel-${tab}`} aria-labelledby={`org-tab-${tab}`}>
          {tab === 'brands' ? (
            <OrgPagedTable<Brand>
              path={brandPath}
              reloadToken={reloadToken}
              onOpen={(row) => setDialog({ kind: 'brand', brand: row })}
              emptyTitle="org.brand.empty"
              emptyHint="org.brand.emptyHint"
              toolbar={
                <select
                  value={brandStatus}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === 'all' || value === 'active' || value === 'inactive') {
                      setBrandStatus(value)
                    }
                  }}
                  aria-label={t('org.brand.status')}
                  className={`${orgInputClass} mt-0 w-auto`}
                >
                  <option value="all">{t('org.brand.allStatuses')}</option>
                  <option value="active">{t('org.status.active')}</option>
                  <option value="inactive">{t('org.status.inactive')}</option>
                </select>
              }
              columns={[
                {
                  header: 'org.brand.code',
                  cell: (row) => (
                    <span dir="ltr" className="ds-num font-mono font-semibold text-[var(--ds-accent)]">
                      {row.code}
                    </span>
                  ),
                },
                {
                  header: 'org.brand.name',
                  cell: (row) => row.name || <OrgUnavailableDash locale={fmtLocale} />,
                },
                {
                  header: 'org.brand.status',
                  cell: (row) => <OrgStatusBadge status={row.status} />,
                },
                {
                  header: 'org.brand.branches',
                  cell: (row) => (
                    <span dir="ltr" className="ds-num tabular-nums">
                      {formatInt(row.branchCount, fmtLocale)}
                    </span>
                  ),
                },
                {
                  header: 'org.brand.updated',
                  cell: (row) => (
                    <span dir="ltr" className="ds-num whitespace-nowrap tabular-nums">
                      {formatOrgDateTime(row.updatedAt, fmtLocale)}
                    </span>
                  ),
                },
              ]}
            />
          ) : null}

          {tab === 'branches' ? (
            <OrgPagedTable<Branch>
              path={branchPath}
              reloadToken={reloadToken}
              onOpen={(row) => setDialog({ kind: 'branch', branch: row })}
              emptyTitle="org.branch.empty"
              emptyHint="org.branch.emptyHint"
              toolbar={
                <>
                  <select
                    value={branchStatus}
                    onChange={(event) => {
                      const value = event.target.value
                      if (value === 'all' || value === 'active' || value === 'inactive') {
                        setBranchStatus(value)
                      }
                    }}
                    aria-label={t('org.branch.status')}
                    className={`${orgInputClass} mt-0 w-auto`}
                  >
                    <option value="all">{t('org.brand.allStatuses')}</option>
                    <option value="active">{t('org.status.active')}</option>
                    <option value="inactive">{t('org.status.inactive')}</option>
                  </select>
                  {canReadBrands ? (
                    <div>
                      <select
                        value={brandFilter}
                        onChange={(event) => setBrandFilter(event.target.value)}
                        aria-label={t('org.branch.brand')}
                        className={`${orgInputClass} mt-0 w-auto`}
                      >
                        <option value="">
                          {brands.phase === 'loading' && brands.rows.length === 0
                            ? t('erp.loading')
                            : t('org.branch.allBrands')}
                        </option>
                        {brands.rows.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.code} · {row.name}
                          </option>
                        ))}
                      </select>
                      <CatalogNote catalog={brands} />
                    </div>
                  ) : null}
                </>
              }
              columns={[
                {
                  header: 'org.branch.code',
                  cell: (row) => (
                    <span dir="ltr" className="ds-num font-mono font-semibold text-[var(--ds-accent)]">
                      {row.code}
                    </span>
                  ),
                },
                {
                  header: 'org.branch.name',
                  cell: (row) => row.name || <OrgUnavailableDash locale={fmtLocale} />,
                },
                {
                  header: 'org.branch.brand',
                  cell: (row) => row.brandName || <OrgUnavailableDash locale={fmtLocale} />,
                },
                {
                  header: 'org.branch.timezone',
                  cell: (row) => (
                    <span dir="ltr" className="font-mono text-xs">
                      {row.timezone || <OrgUnavailableDash locale={fmtLocale} />}
                    </span>
                  ),
                },
                {
                  header: 'org.branch.status',
                  cell: (row) => <OrgStatusBadge status={row.status} />,
                },
                {
                  header: 'org.branch.updated',
                  cell: (row) => (
                    <span dir="ltr" className="ds-num whitespace-nowrap tabular-nums">
                      {formatOrgDateTime(row.updatedAt, fmtLocale)}
                    </span>
                  ),
                },
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {dialog ? (
        <OrgModal title={title} onClose={closeDialog} size="lg">
          {dialog.kind === 'brand' ? (
            <BrandDialog
              key={dialog.brand?.id ?? 'new'}
              brand={dialog.brand}
              onSaved={changed}
              onCancel={closeDialog}
              onReload={reloadDialog}
            />
          ) : null}
          {dialog.kind === 'branch' ? (
            <BranchDialog
              key={dialog.branch?.id ?? 'new'}
              branch={dialog.branch}
              brands={brands}
              onSaved={changed}
              onCancel={closeDialog}
              onReload={reloadDialog}
            />
          ) : null}
        </OrgModal>
      ) : null}
    </div>
  )
}
