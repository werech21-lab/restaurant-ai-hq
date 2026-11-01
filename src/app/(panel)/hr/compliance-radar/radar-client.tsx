'use client'

import { useMemo, useState } from 'react'

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
  band: 'expired' | 'd30' | 'd60' | 'valid' | 'missing'
}

type Radar = {
  totals: Record<string, number>
  groups: { expired: Item[]; d30: Item[]; d60: Item[]; valid: Item[]; missing: Item[] }
  renewalDispatch: {
    body: string
    recipients: Array<{ name: string; mobile: string; email: string; whatsapp: string; mailto: string }>
  }
}

type BandFilter = 'all' | 'expired' | 'd30' | 'd60' | 'valid'
type DocFilter = 'all' | DocKey

const DOC_COLUMNS: Array<{ key: DocKey; ar: string; en: string }> = [
  { key: 'civilIdExpiry', ar: '🆔 الإقامة / البطاقة المدنية', en: '🆔 Civil ID / Residency' },
  { key: 'healthCardExpiry', ar: '🏥 كرت البلدية الصحي', en: '🏥 Municipality Health Card' },
  { key: 'workPermitExpiry', ar: '🛂 إذن العمل والتأمين', en: '🛂 Work Permit & Insurance' },
  { key: 'passportExpiry', ar: '📘 جواز السفر', en: '📘 Passport' },
]

function bandRank(band: Item['band']) {
  if (band === 'expired') return 0
  if (band === 'd30') return 1
  if (band === 'd60') return 2
  if (band === 'missing') return 3
  return 4
}

function badgeClass(band: Item['band']) {
  if (band === 'expired') return 'border-rose-500/40 bg-rose-950/40 text-rose-300'
  if (band === 'd30') return 'border-amber-500/40 bg-amber-950/40 text-amber-300'
  if (band === 'd60') return 'border-yellow-500/40 bg-yellow-950/30 text-yellow-300'
  if (band === 'missing') return 'border-white/10 bg-white/5 text-mist-400'
  return 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
}

function daysLabel(item: Item | undefined, locale: 'ar' | 'en') {
  if (!item || item.daysLeft == null) return locale === 'en' ? 'Missing' : 'غير مسجّل'
  if (item.daysLeft < 0) {
    return locale === 'en' ? `Expired ${Math.abs(item.daysLeft)}d` : `منتهي منذ ${Math.abs(item.daysLeft)} يوم`
  }
  return locale === 'en' ? `${item.daysLeft}d left` : `متبقي ${item.daysLeft} يوم`
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
  const label = (ar: string, en: string) => (locale === 'en' ? en : ar)
  const [band, setBand] = useState<BandFilter>('all')
  const [docFilter, setDocFilter] = useState<DocFilter>('all')
  const [q, setQ] = useState('')

  const allItems = useMemo(
    () => [...initial.groups.expired, ...initial.groups.d30, ...initial.groups.d60, ...initial.groups.valid, ...initial.groups.missing],
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
    return Array.from(map.values()).sort((a, b) => bandRank(a.worst) - bandRank(b.worst) || a.name.localeCompare(b.name))
  }, [allItems])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return employees.filter((emp) => {
      if (band !== 'all' && emp.worst !== band) {
        // also include if any selected-doc column matches band filter
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
  const cards: Array<{ key: BandFilter; title: string; count: number; className: string }> = [
    {
      key: 'expired',
      title: label('🔴 وثائق منتهية فوراً (خطر غرامة)', '🔴 Expired — fine risk'),
      count: initial.totals.expired || 0,
      className: 'border-rose-500/40 bg-rose-950/20 text-rose-300 shadow-[0_0_24px_rgba(244,63,94,0.12)]',
    },
    {
      key: 'd30',
      title: label('🟠 تنتهي خلال 30 يوماً', '🟠 Expiring < 30 days'),
      count: initial.totals.d30 || 0,
      className: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
    },
    {
      key: 'd60',
      title: label('🟡 تنتهي خلال 60 يوماً', '🟡 Expiring < 60 days'),
      count: initial.totals.d60 || 0,
      className: 'border-yellow-500/40 bg-yellow-950/20 text-yellow-300',
    },
    {
      key: 'valid',
      title: label('🟢 سارية وآمنة (> 60 يوم)', '🟢 Valid > 60 days'),
      count: initial.totals.valid || 0,
      className: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
    },
  ]

  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-[#0a0d12] p-4 text-white md:p-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setBand((prev) => (prev === card.key ? 'all' : card.key))}
            className={`rounded-2xl border p-4 text-start transition hover:brightness-110 ${card.className} ${
              band === card.key ? 'ring-2 ring-emerald-400/60' : ''
            }`}
          >
            <p className="text-xs font-semibold opacity-90">{card.title}</p>
            <p className="mt-2 text-3xl font-black text-white">{card.count}</p>
            <p className="mt-1 text-[11px] opacity-70">{label('اضغط للفلترة', 'Click to filter')}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#11161f] p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={label('بحث بالاسم أو الرقم الوظيفي (2090, 2049…)', 'Search name or employee code (2090, 2049…)')}
          className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-[#0a0d12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-mist-500 focus:border-emerald-500/50"
        />
        <select
          value={docFilter}
          onChange={(e) => setDocFilter(e.target.value as DocFilter)}
          className="rounded-xl border border-white/10 bg-[#0a0d12] px-3 py-2.5 text-sm text-white"
        >
          <option value="all">{label('كل الوثائق', 'All documents')}</option>
          <option value="civilIdExpiry">{label('🆔 البطاقة المدنية والإقامة', '🆔 Civil ID & Residency')}</option>
          <option value="healthCardExpiry">{label('🏥 كرت الصحة والبلدية', '🏥 Health / Municipality')}</option>
          <option value="workPermitExpiry">{label('🛂 جواز السفر وإذن العمل', '🛂 Passport / Work permit')}</option>
          <option value="passportExpiry">{label('📘 جواز السفر', '📘 Passport')}</option>
          <option value="drivingLicenseExpiry">{label('🚗 رخصة القيادة', '🚗 Driving license')}</option>
        </select>
        {recipient ? (
          <a
            href={recipient.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
          >
            {label('📲 إرسال كشف التجديدات العاجل للمندوب (Amgad Samir - 97386411)', '📲 Send urgent renewals to GRO (Amgad Samir - 97386411)')}
          </a>
        ) : null}
        {band !== 'all' ? (
          <button type="button" onClick={() => setBand('all')} className="rounded-xl border border-white/15 px-3 py-2 text-xs text-mist-300">
            {label('إلغاء فلتر الحالة', 'Clear band filter')}
          </button>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#11161f]">
        <header className="border-b border-white/10 px-4 py-3">
          <h2 className="font-semibold text-white">
            {label('مصفوفة امتثال الموظفين المدمجة', 'Grouped Employee Compliance Matrix')} · {filtered.length}
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-[#0d1219] text-mist-400">
                <th className="px-3 py-3 text-start">{label('الموظف', 'Employee')}</th>
                {DOC_COLUMNS.map((col) => (
                  <th key={col.key} className="px-3 py-3 text-start">
                    {locale === 'en' ? col.en : col.ar}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.employeeId} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                  <td className="px-3 py-3">
                    <p className="font-mono text-sm font-bold text-emerald-400" dir="ltr">
                      {emp.code}
                    </p>
                    <p className="text-base font-bold text-white">{emp.name}</p>
                    <p className="text-xs text-mist-400">
                      {emp.jobTitle}
                      {emp.department ? ` · ${emp.department}` : ''}
                    </p>
                  </td>
                  {DOC_COLUMNS.map((col) => {
                    const doc = emp.docs[col.key]
                    return (
                      <td key={col.key} className="px-3 py-3">
                        <p className="font-mono text-xs text-mist-300" dir="ltr">
                          {doc?.expiryDate || '—'}
                        </p>
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(doc?.band || 'missing')}`}>
                          {daysLabel(doc, locale)}
                        </span>
                        <a
                          href={`/hr/smart-folder-upload`}
                          className="mt-2 block text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          {label('[تجديد / رفع الوثيقة]', '[Renew / Upload]')}
                        </a>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-mist-400">
                    {label('لا نتائج مطابقة للفلاتر الحالية', 'No rows match the current filters')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
