'use client'

type Match = {
  id: string
  source: string
  platform: string | null
  channel: string
  expectedCommissionBps: number
  gross: number
  commission: number
  net: number
  bankHint: string | null
  status: 'MATCHED' | 'SHORTFALL' | 'OVER_COMMISSION' | 'REVIEW'
  noteAr: string
  noteEn: string
}

type Data = {
  summary: {
    total: number
    matched: number
    shortfall: number
    overCommission: number
    review: number
    bankHint: string
  }
  matches: Match[]
}

function statusClass(status: Match['status']) {
  if (status === 'MATCHED') return 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
  if (status === 'SHORTFALL') return 'border-rose-500/40 bg-rose-950/30 text-rose-300'
  if (status === 'OVER_COMMISSION') return 'border-amber-500/40 bg-amber-950/30 text-amber-300'
  return 'border-white/15 bg-white/5 text-mist-300'
}

export function ReconciliationClient({ initial, locale }: { initial: Data; locale: 'ar' | 'en' }) {
  const label = (ar: string, en: string) => (locale === 'en' ? en : ar)
  const s = initial.summary

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0a0d12] p-4 md:p-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          [label('الإجمالي', 'Total'), s.total, 'border-white/10 text-white'],
          [label('مطابق', 'Matched'), s.matched, 'border-emerald-500/40 text-emerald-300'],
          [label('نقص إيداع', 'Shortfall'), s.shortfall, 'border-rose-500/40 text-rose-300'],
          [label('عمولة زائدة', 'Over commission'), s.overCommission, 'border-amber-500/40 text-amber-300'],
          [label('مراجعة', 'Review'), s.review, 'border-yellow-500/40 text-yellow-300'],
        ].map(([title, count, cls]) => (
          <div key={String(title)} className={`rounded-2xl border bg-[#11161f] p-4 ${cls}`}>
            <p className="text-xs opacity-80">{title}</p>
            <p className="mt-1 text-2xl font-black text-white">{count as number}</p>
          </div>
        ))}
      </div>
      <p className="rounded-xl border border-white/10 bg-[#11161f] px-4 py-3 text-sm text-mist-300">
        {label('حسابات البنك المرجعية', 'Bank accounts')}: <span className="font-mono text-emerald-400">{s.bankHint}</span>
      </p>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#11161f]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-mist-400">
                <th className="px-3 py-3 text-start">{label('المصدر', 'Source')}</th>
                <th className="px-3 py-3 text-start">{label('المنصة/القناة', 'Platform/Channel')}</th>
                <th className="px-3 py-3 text-start">{label('إجمالي', 'Gross')}</th>
                <th className="px-3 py-3 text-start">{label('عمولة', 'Commission')}</th>
                <th className="px-3 py-3 text-start">{label('صافي', 'Net')}</th>
                <th className="px-3 py-3 text-start">{label('الحالة', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {initial.matches.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="px-3 py-3 text-white">{row.source}</td>
                  <td className="px-3 py-3">
                    <span className="text-white">{row.platform || '—'}</span>
                    <span className="mt-0.5 block text-xs text-emerald-400" dir="ltr">
                      {row.channel}
                      {row.expectedCommissionBps ? ` · ${(row.expectedCommissionBps / 100).toFixed(0)}%` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-mist-200" dir="ltr">
                    {row.gross.toFixed(3)}
                  </td>
                  <td className="px-3 py-3 font-mono text-mist-200" dir="ltr">
                    {row.commission.toFixed(3)}
                  </td>
                  <td className="px-3 py-3 font-mono text-mist-200" dir="ltr">
                    {row.net.toFixed(3)}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(row.status)}`}>
                      {row.status}
                    </span>
                    <p className="mt-1 text-xs text-mist-400">{locale === 'en' ? row.noteEn : row.noteAr}</p>
                  </td>
                </tr>
              ))}
              {initial.matches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-mist-400">
                    {label(
                      'لا توجد تسويات بعد — ارفع كشوفات البنك والمنصات عبر الرفع الذكي أعلاه.',
                      'No settlements yet — upload bank & platform folders via smart ingest above.',
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
