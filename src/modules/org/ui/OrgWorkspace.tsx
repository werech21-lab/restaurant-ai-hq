'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, dateTimeText } from '@/components/erp/common'
import { PagedTable } from '@/components/erp/PagedTable'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { inputClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Branch, Brand } from '@/modules/org/client'
import { BranchDialog } from '@/modules/org/ui/BranchDialog'
import { BrandDialog } from '@/modules/org/ui/BrandDialog'
import { CatalogNote, OrgStatusBadge, useCatalog } from '@/modules/org/ui/shared'

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
  const { t } = useI18n()
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
  const brands = useCatalog<Brand>(canReadBrands, '/api/v1/org/brands?limit=100&status=all', reloadToken)

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
    <div>
      <Link href="/erp" className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300">
        {t('erp.back')}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mist-100">{t('org.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('org.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageBrands ? (
            <button type="button" onClick={() => setDialog({ kind: 'brand' })} className={secondaryButton}>
              {t('org.brand.new')}
            </button>
          ) : null}
          {canManageBranches ? (
            <button type="button" onClick={() => setDialog({ kind: 'branch' })} className={primaryButton}>
              {t('org.branch.new')}
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
            {t('org.noAccess')}
          </p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label={t('org.title')} className="mb-4 flex flex-wrap gap-1 border-b border-[#30363d]">
            {visibleTabs.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`org-tab-${value}`}
                aria-selected={tab === value}
                aria-controls={`org-panel-${value}`}
                onClick={() => setTab(value)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
                  tab === value ? 'border-blue-500 font-semibold text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {t(`org.tab.${value}`)}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`org-panel-${tab}`} aria-labelledby={`org-tab-${tab}`}>
            {tab === 'brands' ? (
              <PagedTable<Brand>
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
                      if (value === 'all' || value === 'active' || value === 'inactive') setBrandStatus(value)
                    }}
                    aria-label={t('org.brand.status')}
                    className={`${inputClass} mt-0 w-auto`}
                  >
                    <option value="all">{t('org.brand.allStatuses')}</option>
                    <option value="active">{t('org.status.active')}</option>
                    <option value="inactive">{t('org.status.inactive')}</option>
                  </select>
                }
                columns={[
                  { header: 'org.brand.code', cell: (row) => <Num className="font-semibold text-blue-300">{row.code}</Num> },
                  { header: 'org.brand.name', cell: (row) => row.name },
                  { header: 'org.brand.status', cell: (row) => <OrgStatusBadge status={row.status} /> },
                  { header: 'org.brand.branches', cell: (row) => <Num>{row.branchCount}</Num> },
                  { header: 'org.brand.updated', cell: (row) => <Num>{dateTimeText(row.updatedAt)}</Num> },
                ]}
              />
            ) : null}

            {tab === 'branches' ? (
              <PagedTable<Branch>
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
                        if (value === 'all' || value === 'active' || value === 'inactive') setBranchStatus(value)
                      }}
                      aria-label={t('org.branch.status')}
                      className={`${inputClass} mt-0 w-auto`}
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
                          className={`${inputClass} mt-0 w-auto`}
                        >
                          <option value="">{brands.phase === 'loading' && brands.rows.length === 0 ? t('erp.loading') : t('org.branch.allBrands')}</option>
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
                  { header: 'org.branch.code', cell: (row) => <Num className="font-semibold text-blue-300">{row.code}</Num> },
                  { header: 'org.branch.name', cell: (row) => row.name },
                  { header: 'org.branch.brand', cell: (row) => row.brandName },
                  { header: 'org.branch.timezone', cell: (row) => <Num>{row.timezone}</Num> },
                  { header: 'org.branch.status', cell: (row) => <OrgStatusBadge status={row.status} /> },
                  { header: 'org.branch.updated', cell: (row) => <Num>{dateTimeText(row.updatedAt)}</Num> },
                ]}
              />
            ) : null}
          </div>
        </>
      )}

      {dialog ? (
        <Modal title={title} onClose={closeDialog} size="lg">
          {dialog.kind === 'brand' ? (
            <BrandDialog key={dialog.brand?.id ?? 'new'} brand={dialog.brand} onSaved={changed} onCancel={closeDialog} onReload={reloadDialog} />
          ) : null}
          {dialog.kind === 'branch' ? (
            <BranchDialog key={dialog.branch?.id ?? 'new'} branch={dialog.branch} brands={brands} onSaved={changed} onCancel={closeDialog} onReload={reloadDialog} />
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}
