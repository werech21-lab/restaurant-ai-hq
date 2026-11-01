'use client'

type Item = {
  employeeId: string
  code: string
  name: string
  jobTitle: string
  docLabelAr: string
  docLabelEn: string
  expiryDate: string | null
  daysLeft: number | null
  band: string
}

type Radar = {
  totals: Record<string, number>
  groups: { expired: Item[]; d30: Item[]; d60: Item[]; valid: Item[]; missing: Item[] }
  renewalDispatch: {
    body: string
    recipients: Array<{ name: string; mobile: string; email: string; whatsapp: string; mailto: string }>
  }
}

export function ComplianceRadarClient({ initial, locale }: { initial: Radar; locale: 'ar' | 'en' }) {
  const label = (ar: string, en: string) => (locale === 'en' ? en : ar)
  const bands: Array<{ key: keyof Radar['groups']; title: string; className: string }> = [
    { key: 'expired', title: label('🔴 منتهية فوراً (تجنب غرامة الشؤون والبلدية)', '🔴 Expired — avoid PAM/Municipality fines'), className: 'border-red-300 bg-red-50' },
    { key: 'd30', title: label('🟠 تنتهي خلال 30 يوماً', '🟠 Expiring within 30 days'), className: 'border-orange-300 bg-orange-50' },
    { key: 'd60', title: label('🟡 تنتهي خلال 60 يوماً', '🟡 Expiring within 60 days'), className: 'border-amber-300 bg-amber-50' },
    { key: 'valid', title: label('🟢 سارية المفعول', '🟢 Valid'), className: 'border-emerald-300 bg-emerald-50' },
  ]

  const recipient = initial.renewalDispatch.recipients[0]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['employees', label('الموظفون', 'Employees')],
          ['expired', label('منتهية', 'Expired')],
          ['d30', '≤30d'],
          ['d60', '≤60d'],
          ['valid', label('سارية', 'Valid')],
        ].map(([key, title]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            <p className="text-xs text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{initial.totals[key] ?? 0}</p>
          </div>
        ))}
      </div>

      {recipient ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex-1 text-sm text-emerald-950">
            <p className="font-bold">{label('إرسال كشف التجديدات العاجل للمندوب والإدارة', 'Send urgent renewal list to GRO & management')}</p>
            <p className="mt-1 text-xs">
              {recipient.name} · {recipient.mobile} · {recipient.email}
            </p>
          </div>
          <a className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white" href={recipient.whatsapp} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-900" href={recipient.mailto}>
            Email
          </a>
        </div>
      ) : null}

      {bands.map((band) => {
        const rows = initial.groups[band.key] || []
        if (band.key === 'valid' && rows.length > 40) {
          return (
            <section key={band.key} className={`rounded-2xl border p-4 ${band.className}`}>
              <h2 className="font-semibold">{band.title}</h2>
              <p className="mt-2 text-sm">{rows.length} {label('سجلاً', 'records')}</p>
            </section>
          )
        }
        return (
          <section key={band.key} className={`overflow-hidden rounded-2xl border ${band.className}`}>
            <header className="border-b border-black/5 px-4 py-3 font-semibold">{band.title} · {rows.length}</header>
            <div className="overflow-x-auto bg-white/70">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-2 text-start">{label('الموظف', 'Employee')}</th>
                    <th className="px-3 py-2 text-start">{label('الوثيقة', 'Document')}</th>
                    <th className="px-3 py-2 text-start">{label('الانتهاء', 'Expiry')}</th>
                    <th className="px-3 py-2 text-start">{label('الأيام', 'Days')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 80).map((row) => (
                    <tr key={`${row.employeeId}-${row.docLabelEn}`} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <span className="font-semibold">{row.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500" dir="ltr">
                          {row.code} · {row.jobTitle}
                        </span>
                      </td>
                      <td className="px-3 py-2">{locale === 'en' ? row.docLabelEn : row.docLabelAr}</td>
                      <td className="px-3 py-2" dir="ltr">
                        {row.expiryDate || '—'}
                      </td>
                      <td className="px-3 py-2" dir="ltr">
                        {row.daysLeft ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
