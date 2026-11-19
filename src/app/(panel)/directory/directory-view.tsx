'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Building2, PhoneCall, Search, Store, Users } from 'lucide-react'
import { PageHeader } from '@/components/erp-ui'
import { SectionCard, StateBlock } from '@/components/ui'
import { UNAVAILABLE_DASH, formatInt, getUnavailableTooltip, type FormatLocale } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import {
  formatKwMobile,
  type VfBranchContact,
  type VfBrandHotline,
  type VfContactPerson,
} from '@/lib/vf-contact-directory'

export type DirectoryLinkedPerson = {
  person: VfContactPerson
  employee: {
    id: string
    code: string
    phone: string | null
    department?: string | null
  } | null
}

export type DirectoryBranchEntry = {
  branch: VfBranchContact
  warehouse: {
    id: string
    name: string
    location?: string | null
    managerName: string | null
  } | null
}

export interface DirectoryViewProps {
  people: DirectoryLinkedPerson[]
  hotlines: VfBrandHotline[]
  branches: DirectoryBranchEntry[]
  locale?: FormatLocale
  loading?: boolean
  hasError?: boolean
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

function DirectoryViewBody({
  people,
  hotlines,
  branches,
  locale,
  loading = false,
  hasError = false,
}: Omit<DirectoryViewProps, 'locale'> & { locale: FormatLocale }) {
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const label = (ar: string, en: string) => (isAr ? ar : en)
  const unavailableTooltip = getUnavailableTooltip(locale)
  const [query, setQuery] = useState('')

  const safePeople = useMemo(
    () =>
      people.filter(
        ({ person, employee }) =>
          !isExcludedOdooEntity(person.name) &&
          !isExcludedOdooEntity(person.title) &&
          (!employee || !isExcludedOdooEntity(employee.department ?? '')),
      ),
    [people],
  )

  const safeHotlines = useMemo(
    () => hotlines.filter((row) => !isExcludedOdooEntity(row.brand)),
    [hotlines],
  )

  const safeBranches = useMemo(
    () =>
      branches.filter(
        ({ branch, warehouse }) =>
          !isExcludedOdooEntity(branch.nameEn) &&
          !isExcludedOdooEntity(branch.nameAr) &&
          !isExcludedOdooEntity(branch.code) &&
          (!warehouse ||
            (!isExcludedOdooEntity(warehouse.name) && !isExcludedOdooEntity(warehouse.location ?? ''))),
      ),
    [branches],
  )

  const needle = query.trim().toLowerCase()

  const filteredPeople = useMemo(() => {
    if (!needle) return safePeople
    return safePeople.filter(({ person, employee }) =>
      [person.name, person.title, person.ext, person.direct, person.mobile, person.email, employee?.code]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    )
  }, [safePeople, needle])

  const filteredHotlines = useMemo(() => {
    if (!needle) return safeHotlines
    return safeHotlines.filter((row) =>
      [row.brand, row.email, ...row.phones]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    )
  }, [safeHotlines, needle])

  const filteredBranches = useMemo(() => {
    if (!needle) return safeBranches
    return safeBranches.filter(({ branch, warehouse }) =>
      [
        branch.code,
        branch.nameAr,
        branch.nameEn,
        branch.ext,
        branch.direct,
        branch.email,
        warehouse?.name,
        warehouse?.managerName,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    )
  }, [safeBranches, needle])

  if (loading) {
    return (
      <div dir={dir} className="space-y-4">
        <StateBlock state="loading" locale={locale} skeletonRows={5} />
      </div>
    )
  }

  if (hasError) {
    return (
      <div dir={dir} className="space-y-4">
        <PageHeader
          title={label('دليل الهواتف والبدالة', 'VF Phone & PBX Directory')}
          description={label(
            'الدليل الرسمي لشركة فنتشر فودز — تحويلات البدالة والموبايل والإيميلات',
            'Official Venture Foods extensions, mobiles, and emails',
          )}
        />
        <StateBlock
          state="error"
          locale={locale}
          title={label('تعذّر تحميل دليل الهواتف', 'Unable to load phone directory')}
          description={label(
            'حدث خلل مؤقت أثناء قراءة بيانات الربط. يرجى إعادة المحاولة.',
            'A temporary error occurred while reading directory records. Please try again.',
          )}
        />
      </div>
    )
  }

  return (
    <div dir={dir} className="w-full max-w-none space-y-5">
      <PageHeader
        title={label('دليل الهواتف والبدالة (VF Phone & PBX)', 'VF Phone & PBX Directory')}
        description={label(
          'الدليل الرسمي لشركة فنتشر فودز — تحويلات البدالة والموبايل والإيميلات · VF Contact List 21-10-2026',
          'Official Venture Foods extensions, mobiles, and emails · VF Contact List 21-10-2026',
        )}
        actions={
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <Link
              href="/hr"
              className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3.5 py-2 text-[var(--ds-text-primary)] transition hover:border-emerald-500/45"
            >
              {label('الموارد البشرية', 'HR')}
            </Link>
            <Link
              href="/warehouses"
              className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3.5 py-2 text-[var(--ds-text-primary)] transition hover:border-emerald-500/45"
            >
              {label('المستودعات والفروع', 'Warehouses')}
            </Link>
            <Link
              href="/erp/aggregator-radar"
              className="ds-focus-ring rounded-xl border border-emerald-500/35 bg-[var(--ds-positive-bg)] px-3.5 py-2 text-emerald-800 transition hover:brightness-95 dark:text-emerald-200"
            >
              {label('رادار التوصيل · تنبيهات حصرية', 'Aggregator Radar · Alerts')}
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] p-3.5">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={label('بحث في الدليل بالاسم أو التحويلة أو الفرع', 'Search directory by name, extension, or branch')}
            placeholder={label(
              'ابحث بالاسم، المسمى، التحويلة، الرقم، أو الفرع…',
              'Search by name, title, EXT, phone, or branch…',
            )}
            className="ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] py-2 pe-3 ps-9 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]"
          />
        </div>
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
          >
            {label('مسح البحث', 'Clear')}
          </button>
        ) : null}
      </div>

      <SectionCard
        title={label('الإدارة والموظفون — تحويلات وموبايل وإيميل', 'Leadership & Staff — EXT / Mobile / Email')}
        icon={<Users className="h-4 w-4" aria-hidden />}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {formatInt(filteredPeople.length, locale)}
          </span>
        }
        locale={locale}
        padded={false}
      >
        {filteredPeople.length === 0 ? (
          <div className="p-4">
            <StateBlock
              state="empty"
              locale={locale}
              title={label('لا توجد جهات اتصال مطابقة', 'No matching staff contacts')}
              compact
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('الاسم', 'Name')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('المسمى', 'Title')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    EXT
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('مباشر', 'Direct')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('موبايل', 'Mobile')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('البريد', 'Email')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('ربط HR', 'HR Link')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {filteredPeople.map(({ person, employee }) => (
                  <tr
                    key={`${person.name}-${person.ext ?? person.mobile ?? 'row'}`}
                    className="hover:bg-[var(--ds-bg-hover)]"
                  >
                    <td className="px-4 py-3 font-semibold text-[var(--ds-text-primary)]">{person.name}</td>
                    <td className="px-4 py-3 text-[var(--ds-text-secondary)]">{person.title}</td>
                    <td className="px-4 py-3">
                      {person.ext ? (
                        <span dir="ltr" className="ds-num tabular-nums font-medium text-[var(--ds-text-primary)]">
                          {person.ext}
                        </span>
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {person.direct ? (
                        <span dir="ltr" className="ds-num tabular-nums text-[var(--ds-text-primary)]">
                          {person.direct}
                        </span>
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {person.mobile ? (
                        <a
                          dir="ltr"
                          className="ds-num ds-focus-ring inline-block rounded font-medium tabular-nums text-emerald-700 hover:underline dark:text-emerald-300"
                          href={`https://wa.me/965${person.mobile.replace(/\D/g, '')}`}
                        >
                          {formatKwMobile(person.mobile)}
                        </a>
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {person.email ? (
                        <a
                          dir="ltr"
                          className="ds-focus-ring inline-block rounded font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                          href={`mailto:${person.email}`}
                        >
                          {person.email}
                        </a>
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--ds-text-muted)]">
                      {employee ? (
                        <span dir="ltr" className="ds-num tabular-nums">
                          {employee.code} · {employee.phone || label('مربوط', 'linked')}
                        </span>
                      ) : (
                        label('دليل فقط', 'Directory only')
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={label('الخطوط الساخنة للبراندات', 'Brand Hotlines')}
        icon={<PhoneCall className="h-4 w-4" aria-hidden />}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {formatInt(filteredHotlines.length, locale)}
          </span>
        }
        locale={locale}
        headerDivider
      >
        {filteredHotlines.length === 0 ? (
          <StateBlock
            state="empty"
            locale={locale}
            title={label('لا توجد خطوط ساخنة مطابقة', 'No matching brand hotlines')}
            compact
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredHotlines.map((row) => (
              <li
                key={row.brand}
                className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3.5 text-sm"
              >
                <p className="font-bold text-[var(--ds-text-primary)]">{row.brand}</p>
                <p className="mt-1.5 flex flex-wrap gap-2" dir="ltr">
                  {row.phones.map((phone) => (
                    <span
                      key={phone}
                      className="ds-num rounded-lg border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--ds-text-primary)]"
                    >
                      {phone}
                    </span>
                  ))}
                </p>
                {row.email ? (
                  <a
                    dir="ltr"
                    className="ds-focus-ring mt-2 inline-block rounded text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                    href={`mailto:${row.email}`}
                  >
                    {row.email}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title={label('تحويلات وخطوط الفروع', 'Branch Extensions & Direct Lines')}
        icon={<Store className="h-4 w-4" aria-hidden />}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {formatInt(filteredBranches.length, locale)}
          </span>
        }
        locale={locale}
        padded={false}
      >
        {filteredBranches.length === 0 ? (
          <div className="p-4">
            <StateBlock
              state="empty"
              locale={locale}
              title={label('لا توجد فروع مطابقة', 'No matching branches')}
              compact
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" aria-hidden />
                      <span>{label('الفرع', 'Branch')}</span>
                    </span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    EXT
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('مباشر', 'Direct')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('البريد', 'Email')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('المستودع', 'Warehouse')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {filteredBranches.map(({ branch, warehouse }) => (
                  <tr key={branch.code + branch.ext} className="hover:bg-[var(--ds-bg-hover)]">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[var(--ds-text-primary)]">
                        {isAr ? branch.nameAr : branch.nameEn}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--ds-text-muted)]" dir="ltr">
                        {branch.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {branch.ext ? (
                        <span dir="ltr" className="ds-num tabular-nums font-medium text-[var(--ds-text-primary)]">
                          {branch.ext}
                        </span>
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {branch.direct ? (
                        <span dir="ltr" className="ds-num tabular-nums text-[var(--ds-text-primary)]">
                          {branch.direct}
                        </span>
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {branch.email ? (
                        <a
                          dir="ltr"
                          className="ds-focus-ring inline-block rounded font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                          href={`mailto:${branch.email}`}
                        >
                          {branch.email}
                        </a>
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--ds-text-secondary)]">
                      {warehouse ? (
                        <Link
                          className="ds-focus-ring inline-block rounded font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                          href={`/warehouses?q=${encodeURIComponent(warehouse.id)}`}
                        >
                          {warehouse.name}
                          {warehouse.managerName ? ` · ${warehouse.managerName}` : ''}
                        </Link>
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function DirectoryViewI18n(props: Omit<DirectoryViewProps, 'locale'>) {
  const { locale } = useI18n()
  return <DirectoryViewBody {...props} locale={locale === 'en' ? 'en' : 'ar'} />
}

export function DirectoryView({ locale, ...rest }: DirectoryViewProps) {
  if (locale !== undefined) {
    return <DirectoryViewBody {...rest} locale={locale} />
  }
  return <DirectoryViewI18n {...rest} />
}
