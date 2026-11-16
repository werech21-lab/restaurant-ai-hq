'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { SectionCard, StateBlock } from '@/components/ui'
import { isExcludedOdooEntity } from '@/lib/aether/period-delta'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  getUnavailableTooltip,
} from '@/lib/format'

type DocKey =
  | 'civilIdExpiry'
  | 'passportExpiry'
  | 'healthCardExpiry'
  | 'workPermitExpiry'
  | 'drivingLicenseExpiry'

type Item = {
  employeeId: string
  code: string
  name: string
  jobTitle: string
  department?: string
  docKey: DocKey
  docLabelAr: string
  docLabelEn: string
  expiryDate: string | null
  daysLeft: number | null
  band: 'expired' | 'd30' | 'd60' | 'valid' | 'missing' | 'unknown'
}

type Radar = {
  totals: Record<string, number>
  groups: { expired: Item[]; d30: Item[]; d60: Item[]; valid: Item[]; missing: Item[]; unknown?: Item[] }
  renewalDispatch: {
    body: string
    recipients: Array<{ name: string; mobile: string; email: string; whatsapp: string; mailto: string }>
  }
}

type BandFilter = 'all' | 'expired' | 'd30' | 'd60' | 'valid'
type DocFilter = 'all' | DocKey

const DOC_COLUMNS: Array<{ key: DocKey; ar: string; en: string }> = [
  { key: 'civilIdExpiry', ar: 'الإقامة / البطاقة المدنية', en: 'Civil ID / Residency' },
  { key: 'healthCardExpiry', ar: 'كرت البلدية الصحي', en: 'Municipality Health Card' },
  { key: 'workPermitExpiry', ar: 'إذن العمل والتأمين', en: 'Work Permit & Insurance' },
  { key: 'passportExpiry', ar: 'جواز السفر', en: 'Passport' },
]

function bandRank(band: Item['band']) {
  if (band === 'expired') return 0
  if (band === 'd30') return 1
  if (band === 'd60') return 2
  if (band === 'missing' || band === 'unknown') return 3
  return 4
}

function badgeStyle(band: Item['band']): React.CSSProperties {
  if (band === 'expired') {
    return {
      backgroundColor: 'var(--ds-negative-bg)',
      borderColor: 'var(--ds-negative-border)',
      color: 'var(--ds-negative)',
    }
  }
  if (band === 'd30' || band === 'd60') {
    return {
      backgroundColor: 'var(--ds-warning-bg)',
      borderColor: 'var(--ds-warning-border)',
      color: 'var(--ds-warning)',
    }
  }
  if (band === 'missing' || band === 'unknown') {
    return {
      backgroundColor: 'var(--ds-unavailable-bg)',
      borderColor: 'var(--ds-unavailable-border)',
      color: 'var(--ds-unavailable)',
    }
  }
  return {
    backgroundColor: 'var(--ds-positive-bg)',
    borderColor: 'var(--ds-positive-border)',
    color: 'var(--ds-positive)',
  }
}

function daysLabel(item: Item | undefined, locale: 'ar' | 'en') {
  if (item?.band === 'unknown') return locale === 'en' ? 'Unknown' : 'غير معروف'
  if (!item || item.daysLeft == null) return locale === 'en' ? 'Missing' : 'غير مسجّل'
  const absFormatted = formatInt(Math.abs(item.daysLeft), locale)
  if (item.daysLeft < 0) {
    return locale === 'en' ? `Expired ${absFormatted}d` : `منتهي منذ ${absFormatted} يوم`
  }
  return locale === 'en' ? `${absFormatted}d left` : `متبقي ${absFormatted} يوم`
}

type EmpRow = {
  employeeId: string
  code: string
  name: string
  jobTitle: string
  department: string
  docs: Partial<Record<DocKey, Item>>
  worst: Item['band']
}

export function ComplianceRadarClient({ initial, locale }: { initial: Radar; locale: 'ar' | 'en' }) {
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const label = (ar: string, en: string) => (isAr ? ar : en)
  const unavailableTooltip = getUnavailableTooltip(locale)
  const [band, setBand] = useState<BandFilter>('all')
  const [docFilter, setDocFilter] = useState<DocFilter>('all')
  const [q, setQ] = useState('')

  const allItems = useMemo(
    () =>
      [
        ...initial.groups.expired,
        ...initial.groups.d30,
        ...initial.groups.d60,
        ...initial.groups.valid,
        ...initial.groups.missing,
        ...(initial.groups.unknown ?? []),
      ].filter((item) => !isExcludedOdooEntity(item.name) && !isExcludedOdooEntity(item.department)),
    [initial.groups],
  )

  const employees = useMemo(() => {
    const map = new Map<string, EmpRow>()
    for (const item of allItems) {
      let row = map.get(item.employeeId)
      if (!row) {
        row = {
          employeeId: item.employeeId,
          code: item.code,
          name: item.name,
          jobTitle: item.jobTitle,
          department: item.department || '',
          docs: {},
          worst: 'valid',
        }
        map.set(item.employeeId, row)
      }
      row.docs[item.docKey] = item
      if (bandRank(item.band) < bandRank(row.worst)) row.worst = item.band
    }
    return Array.from(map.values()).sort(
      (a, b) => bandRank(a.worst) - bandRank(b.worst) || a.name.localeCompare(b.name),
    )
  }, [allItems])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return employees.filter((emp) => {
      if (band !== 'all' && emp.worst !== band) {
        const hasBand = Object.values(emp.docs).some((d) => d && d.band === band)
        if (!hasBand) return false
      }
      if (docFilter !== 'all') {
        const doc = emp.docs[docFilter]
        if (!doc) return false
        if (band !== 'all' && doc.band !== band) return false
      }
      if (!needle) return true
      return (
        emp.name.toLowerCase().includes(needle) ||
        emp.code.toLowerCase().includes(needle) ||
        emp.jobTitle.toLowerCase().includes(needle) ||
        emp.department.toLowerCase().includes(needle)
      )
    })
  }, [employees, band, docFilter, q])

  const recipient = initial.renewalDispatch.recipients[0]
  const cards: Array<{
    key: BandFilter
    title: string
    count: number
    toneStyle: React.CSSProperties
  }> = [
    {
      key: 'expired',
      title: label('وثائق منتهية فوراً (خطر غرامة)', 'Expired — fine risk'),
      count: initial.totals.expired || 0,
      toneStyle: {
        backgroundColor: 'var(--ds-negative-bg)',
        borderColor: 'var(--ds-negative-border)',
        color: 'var(--ds-negative)',
      },
    },
    {
      key: 'd30',
      title: label('تنتهي خلال 30 يوماً', 'Expiring < 30 days'),
      count: initial.totals.d30 || 0,
      toneStyle: {
        backgroundColor: 'var(--ds-warning-bg)',
        borderColor: 'var(--ds-warning-border)',
        color: 'var(--ds-warning)',
      },
    },
    {
      key: 'd60',
      title: label('تنتهي خلال 60 يوماً', 'Expiring < 60 days'),
      count: initial.totals.d60 || 0,
      toneStyle: {
        backgroundColor: 'var(--ds-bg-surface)',
        borderColor: 'var(--ds-warning-border)',
        color: 'var(--ds-warning)',
      },
    },
    {
      key: 'valid',
      title: label('سارية وآمنة (> 60 يوم)', 'Valid > 60 days'),
      count: initial.totals.valid || 0,
      toneStyle: {
        backgroundColor: 'var(--ds-positive-bg)',
        borderColor: 'var(--ds-positive-border)',
        color: 'var(--ds-positive)',
      },
    },
  ]

  return (
    <div dir={dir} className="w-full min-w-0 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const active = band === card.key
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={active}
              onClick={() => setBand((prev) => (prev === card.key ? 'all' : card.key))}
              style={card.toneStyle}
              className={`ds-focus-ring ds-motion cursor-pointer rounded-2xl border p-4 text-start transition hover:brightness-95 ${
                active ? 'ring-2 ring-[var(--ds-accent)]' : ''
              }`}
            >
              <p className="text-xs font-semibold">{card.title}</p>
              <p
                dir="ltr"
                className="ds-kpi-value ds-num mt-2 tabular-nums text-[var(--ds-text-primary)]"
              >
                {formatInt(card.count, locale)}
              </p>
              <p className="ds-caption mt-1">{label('اضغط للفلترة', 'Click to filter')}</p>
            </button>
          )
        })}
      </div>

      <div className="ds-surface flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={label('بحث بالاسم أو الرقم الوظيفي', 'Search employee name or code')}
          placeholder={label('بحث بالاسم أو الرقم الوظيفي…', 'Search name or employee code…')}
          className="ds-focus-ring min-w-[200px] flex-1 rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]"
        />
        <select
          value={docFilter}
          onChange={(e) => setDocFilter(e.target.value as DocFilter)}
          aria-label={label('تصفية حسب نوع الوثيقة', 'Filter by document type')}
          className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)]"
        >
          <option value="all">{label('كل الوثائق', 'All documents')}</option>
          <option value="civilIdExpiry">{label('البطاقة المدنية والإقامة', 'Civil ID & Residency')}</option>
          <option value="healthCardExpiry">{label('كرت الصحة والبلدية', 'Health / Municipality')}</option>
          <option value="workPermitExpiry">{label('إذن العمل والتأمين', 'Work permit & Insurance')}</option>
          <option value="passportExpiry">{label('جواز السفر', 'Passport')}</option>
          <option value="drivingLicenseExpiry">{label('رخصة القيادة', 'Driving license')}</option>
        </select>
        {recipient ? (
          <a
            href={recipient.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="ds-focus-ring btn-colored inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <span>
              {label(
                `إرسال كشف التجديدات العاجل للمندوب (${recipient.name} — ${recipient.mobile})`,
                `Send urgent renewals to GRO (${recipient.name} — ${recipient.mobile})`,
              )}
            </span>
          </a>
        ) : null}
        {band !== 'all' || docFilter !== 'all' || q ? (
          <button
            type="button"
            onClick={() => {
              setBand('all')
              setDocFilter('all')
              setQ('')
            }}
            className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-strong)] px-3 py-2 text-xs font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
          >
            {label('إلغاء الفلاتر', 'Clear filters')}
          </button>
        ) : null}
      </div>

      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{label('مصفوفة امتثال الموظفين المدمجة', 'Grouped Employee Compliance Matrix')}</span>
            <span
              dir="ltr"
              className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums"
            >
              {formatInt(filtered.length, locale)}
            </span>
          </span>
        }
        locale={locale}
        padded={false}
        state={allItems.length === 0 ? 'empty' : 'ready'}
        stateTitle={label('لا توجد بيانات امتثال مسجلة حالياً', 'No compliance records available')}
        stateDescription={label(
          'عند مزامنة الموظفين ورفع وثائقهم عبر المجلد الذكي، ستظهر حالات الإقامة والكروت الصحية هنا.',
          'Once employees are synced and documents are uploaded, residency and health card statuses will appear here.',
        )}
      >
        {filtered.length === 0 ? (
          <div className="p-4">
            <StateBlock
              state="empty"
              compact
              locale={locale}
              title={label('لا نتائج مطابقة للفلاتر الحالية', 'No rows match the current filters')}
              description={label(
                'جرّب تغيير نوع الوثيقة أو مسح نص البحث.',
                'Try changing the document filter or clearing the search query.',
              )}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setBand('all')
                    setDocFilter('all')
                    setQ('')
                  }}
                  className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ds-text-primary)]"
                >
                  {label('إعادة ضبط الفلاتر', 'Reset filters')}
                </button>
              }
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label('الموظف', 'Employee')}
                  </th>
                  {DOC_COLUMNS.map((col) => (
                    <th key={col.key} scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {isAr ? col.ar : col.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {filtered.map((emp) => (
                  <tr key={emp.employeeId} className="align-top transition-colors hover:bg-[var(--ds-bg-hover)]">
                    <td className="px-4 py-3">
                      <p className="ds-num font-mono text-xs font-bold tabular-nums" dir="ltr" style={{ color: 'var(--ds-accent)' }}>
                        {emp.code}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-[var(--ds-text-primary)]">{emp.name}</p>
                      <p className="ds-caption mt-0.5">
                        {emp.jobTitle || UNAVAILABLE_DASH}
                        {emp.department ? ` · ${emp.department}` : ''}
                      </p>
                    </td>
                    {DOC_COLUMNS.map((col) => {
                      const doc = emp.docs[col.key]
                      const formattedDate = doc?.expiryDate ? formatDate(doc.expiryDate, locale) : UNAVAILABLE_DASH
                      const dateMissing = formattedDate === UNAVAILABLE_DASH
                      return (
                        <td key={col.key} className="px-4 py-3">
                          <p className="text-xs font-medium text-[var(--ds-text-secondary)]">
                            {dateMissing ? (
                              <span
                                dir="ltr"
                                title={unavailableTooltip}
                                aria-label={unavailableTooltip}
                                data-unavailable="true"
                                className="ds-num tabular-nums"
                                style={{ color: 'var(--ds-unavailable)' }}
                              >
                                {UNAVAILABLE_DASH}
                              </span>
                            ) : (
                              <span dir="ltr" className="ds-num tabular-nums">
                                {formattedDate}
                              </span>
                            )}
                          </p>
                          <span
                            style={badgeStyle(doc?.band || 'missing')}
                            className="mt-1.5 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                          >
                            {daysLabel(doc, locale)}
                          </span>
                          <Link
                            href="/hr/smart-folder-upload"
                            className="ds-focus-ring mt-2 block w-fit rounded text-xs font-semibold hover:underline"
                            style={{ color: 'var(--ds-accent)' }}
                          >
                            {label('تجديد / رفع الوثيقة', 'Renew / Upload')}
                          </Link>
                        </td>
                      )
                    })}
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
