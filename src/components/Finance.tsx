'use client'

import { Cell, Legend, Line, LineChart, Pie, PieChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipPayload } from 'recharts'
import { ChartFrame, formatAmount, useCompactChart } from '@/components/charts'
import { Money, Num } from '@/components/ui'
import { useI18n, type Locale, type MessageKey } from '@/lib/i18n'

const revenueSeed = [
  { actual: 180, budget: 175 },
  { actual: 195, budget: 185 },
  { actual: 210, budget: 190 },
  { actual: 205, budget: 200 },
  { actual: 220, budget: 210 },
  { actual: 248, budget: 230 },
]

const costSeed: Array<{ key: MessageKey; value: number; color: string }> = [
  { key: 'finance.sliceMaterials', value: 33, color: '#58a6ff' },
  { key: 'finance.sliceDelivery', value: 8, color: '#f85149' },
  { key: 'finance.sliceLabor', value: 28, color: '#3fb950' },
  { key: 'finance.sliceOccupancy', value: 18, color: '#d29922' },
  { key: 'finance.sliceOther', value: 13, color: '#8b949e' },
]

const monthLabels: Record<Locale, string[]> = {
  ar: ['مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر'],
  en: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
}

const shell = 'rounded-xl border border-[#30363d] bg-[#1c2128] p-5'

function FinanceTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean
  payload?: TooltipPayload
  label?: string
  suffix?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#161b22] px-3 py-2.5 text-xs shadow-lift">
      {label ? <p className="mb-1.5 font-medium text-[#c9d1d9]">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((item) => (
          <p key={String(item.name)} className="flex items-center justify-between gap-4 text-[#c9d1d9]">
            <span style={{ color: item.color || item.payload?.fill }}>{item.name}</span>
            <span dir="ltr" className="num font-semibold tabular-nums">
              {formatAmount(item.value)}
              {suffix ? ` ${suffix}` : ''}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}

export default function Finance() {
  const { t, locale } = useI18n()
  const compact = useCompactChart()
  const axis = { fill: '#8b949e', fontSize: compact ? 11 : 12 }
  const actualName = t('finance.actual')
  const budgetName = t('finance.budget')
  const thousands = t('finance.thousands')

  const revenue = revenueSeed.map((row, index) => ({
    ...row,
    month: monthLabels[locale][index],
  }))

  const costs = costSeed.map((row) => ({
    ...row,
    name: t(row.key),
  }))

  const gaps = [
    { label: t('finance.materials'), value: '+7.0%', bar: 'w-[35%]' },
    { label: t('finance.delivery'), value: '+20.1%', bar: 'w-full' },
    { label: t('finance.profit'), value: '-11.4%', bar: 'w-[57%]' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-mist-100">{t('page.finance.title')}</h1>
        <p className="mt-1 text-sm text-gray-400">{t('page.finance.subtitle')}</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className={shell}>
          <div className="text-sm text-gray-400">{t('finance.month')}</div>
          <div className="mt-2 text-3xl font-bold text-mist-100">
            <Money value="248,600" />
          </div>
          <div className="mt-1 text-sm text-green-400">
            <Num>+5.8%</Num>
          </div>
        </div>
        <div className={shell}>
          <div className="text-sm text-gray-400">{t('finance.profit')}</div>
          <div className="mt-2 text-3xl font-bold text-mist-100">
            <Money value="38,200" />
          </div>
          <div className="mt-1 text-sm text-red-400">
            <Num>-9.1%</Num>
          </div>
        </div>
        <div className={shell}>
          <div className="text-sm text-gray-400">{t('stat.margin')}</div>
          <div className="mt-2 text-3xl font-bold text-mist-100">
            <Num>31.4%</Num>
          </div>
          <div className="mt-1 text-sm text-red-400">
            <Num>-1.6</Num> {t('point')}
          </div>
        </div>
        <div className={shell}>
          <div className="text-sm text-gray-400">{t('finance.biggest')}</div>
          <div className="mt-2 text-xl font-bold text-mist-100">{t('finance.delivery')}</div>
          <div className="mt-1 text-sm text-red-400">
            <Num>+20.1%</Num>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={shell}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-mist-100">{t('finance.trend')}</h3>
            <p className="text-xs text-gray-400">{thousands}</p>
          </div>
          <ChartFrame className="mt-0 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="month" stroke="#8b949e" tick={axis} tickLine={false} interval={compact ? 1 : 0} />
                <YAxis stroke="#8b949e" tick={axis} tickLine={false} width={compact ? 32 : 40} />
                <Tooltip
                  content={(props) => (
                    <FinanceTooltip
                      active={props.active}
                      payload={props.payload}
                      label={typeof props.label === 'string' ? props.label : undefined}
                      suffix={thousands}
                    />
                  )}
                />
                <Legend wrapperStyle={{ color: '#c9d1d9', fontSize: 12 }} />
                <Line type="monotone" dataKey="actual" stroke="#58a6ff" strokeWidth={2.5} name={actualName} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="budget" stroke="#8b949e" strokeDasharray="5 5" name={budgetName} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        </div>

        <div className={shell}>
          <h3 className="mb-4 font-semibold text-mist-100">{t('finance.costs')}</h3>
          <ChartFrame className="mt-0 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={costs} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} stroke="transparent" isAnimationActive={false}>
                  {costs.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={(props) => <FinanceTooltip active={props.active} payload={props.payload} suffix="%" />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ul className="mt-4 space-y-2.5">
            {costs.map((slice) => (
              <li key={slice.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: slice.color }} />
                  <span className="truncate text-gray-300">{slice.name}</span>
                </span>
                <Num className="font-medium text-mist-100">{slice.value}%</Num>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={shell}>
        <h3 className="font-semibold text-mist-100">{t('finance.variance')}</h3>
        <div className="mt-5 space-y-4">
          {gaps.map((row) => (
            <div key={row.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-300">{row.label}</span>
                <Num className="font-semibold text-red-400">{row.value}</Num>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full rounded-full bg-red-400/80 ${row.bar}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
