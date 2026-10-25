'use client'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipPayload } from 'recharts'
import { ChartFrame, formatAmount, useCompactChart } from '@/components/charts'
import { Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'

const chartSeed: Array<{ area: MessageKey; margin: number; fill: string }> = [
  { area: 'area.salmiya', margin: 35.6, fill: '#3fb950' },
  { area: 'area.jahra', margin: 31.4, fill: '#58a6ff' },
  { area: 'area.shuwaikh', margin: 28.2, fill: '#58a6ff' },
  { area: 'area.hawally', margin: 24.1, fill: '#f85149' },
]

const tableSeed: Array<{
  area: MessageKey
  code: string
  brand: MessageKey
  revenue: number
  margin: number
  status: MessageKey
  tone: 'text-yellow-400' | 'text-green-400' | 'text-red-400'
}> = [
  { area: 'area.shuwaikh', code: '01', brand: 'brand.burger', revenue: 28400, margin: 28.2, status: 'status.mid', tone: 'text-yellow-400' },
  { area: 'area.salmiya', code: '03', brand: 'brand.pizza', revenue: 34100, margin: 35.6, status: 'status.great', tone: 'text-green-400' },
  { area: 'area.hawally', code: '05', brand: 'brand.burger', revenue: 22600, margin: 24.1, status: 'status.weak', tone: 'text-red-400' },
]

const shell = 'rounded-xl border border-[#30363d] bg-[#1c2128]'

function MarginTooltip({
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
  const row = payload?.[0]
  if (!active || !row) return null
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#161b22] px-3 py-2.5 text-xs shadow-lift">
      {label ? <p className="mb-1.5 font-medium text-[#c9d1d9]">{label}</p> : null}
      <p className="flex items-center justify-between gap-4 text-[#c9d1d9]">
        <span style={{ color: '#58a6ff' }}>{row.name}</span>
        <span dir="ltr" className="num font-semibold tabular-nums">
          {formatAmount(row.value)}
          {suffix ? suffix : ''}
        </span>
      </p>
    </div>
  )
}

export default function Branches() {
  const { t } = useI18n()
  const compact = useCompactChart()
  const axis = { fill: '#8b949e', fontSize: compact ? 11 : 12 }
  const seriesName = t('branches.marginSeries')

  const chartRows = chartSeed.map((row) => ({
    name: t(row.area),
    margin: row.margin,
    fill: row.fill,
  }))

  const branches = tableSeed.map((row) => ({
    ...row,
    name: t(row.area),
    brand: t(row.brand),
    status: t(row.status),
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-mist-100">{t('page.branches.title')}</h1>
        <p className="mt-1 text-sm text-gray-400">{t('page.branches.subtitle')}</p>
      </div>

      <div className={`${shell} mb-6 p-5`}>
        <h3 className="mb-4 font-semibold text-mist-100">{t('branches.margins')}</h3>
        <ChartFrame className="mt-0 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="name" stroke="#8b949e" tick={axis} tickLine={false} interval={0} />
              <YAxis stroke="#8b949e" tick={axis} tickLine={false} width={compact ? 32 : 40} />
              <Tooltip
                content={(props) => (
                  <MarginTooltip
                    active={props.active}
                    payload={props.payload}
                    label={typeof props.label === 'string' ? props.label : undefined}
                    suffix="%"
                  />
                )}
              />
              <Bar dataKey="margin" radius={[4, 4, 0, 0]} name={seriesName} isAnimationActive={false}>
                {chartRows.map((row) => (
                  <Cell key={row.name} fill={row.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {branches.map((branch) => (
          <div key={branch.code} className={`${shell} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-mist-100">
                  {branch.name} <Num>{branch.code}</Num>
                </p>
                <p className="mt-1 text-sm text-gray-400">{branch.brand}</p>
              </div>
              <span className={`text-sm ${branch.tone}`}>{branch.status}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-gray-400">{t('col.revenue')}</dt>
                <dd className="mt-1 font-semibold text-mist-100">
                  <Num>{branch.revenue.toLocaleString('en-US')}</Num>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">{t('col.margin')}</dt>
                <dd className="mt-1 font-semibold text-mist-100">
                  <Num>{branch.margin.toFixed(1)}%</Num>
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className={`${shell} hidden overflow-x-auto md:block`}>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#161b22]">
            <tr>
              <th className="p-4 text-start font-medium text-gray-300">{t('col.branch')}</th>
              <th className="p-4 text-start font-medium text-gray-300">{t('col.brand')}</th>
              <th className="p-4 text-start font-medium text-gray-300">{t('col.revenue')}</th>
              <th className="p-4 text-start font-medium text-gray-300">{t('col.margin')}</th>
              <th className="p-4 text-start font-medium text-gray-300">{t('col.rating')}</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.code} className="border-t border-[#30363d]">
                <td className="p-4 text-mist-100">
                  {branch.name} <Num>{branch.code}</Num>
                </td>
                <td className="p-4 text-gray-300">{branch.brand}</td>
                <td className="p-4">
                  <Num>{branch.revenue.toLocaleString('en-US')}</Num>
                </td>
                <td className="p-4">
                  <Num>{branch.margin.toFixed(1)}%</Num>
                </td>
                <td className={`p-4 ${branch.tone}`}>{branch.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
