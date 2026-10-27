'use client'

import { Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { DashboardKpis } from '@/modules/ai/client'

type Props = {
  kpis: DashboardKpis
}

/** One line under the KPI grid: how many decisions wait and how many alerts are active, by severity. */
export function StatusStrip({ kpis }: Props) {
  const { t } = useI18n()
  const { pendingApprovals, openInsights } = kpis
  if (pendingApprovals === null && openInsights === null) return null

  const parts: Array<{ label: MessageKey; value: number; tone: string }> = []
  if (pendingApprovals !== null) parts.push({ label: 'ai.kpi.pending', value: pendingApprovals, tone: pendingApprovals > 0 ? 'text-amber-300' : 'text-gray-300' })
  if (openInsights !== null) {
    parts.push({ label: 'ai.kpi.insights', value: openInsights.total, tone: 'text-gray-100' })
    parts.push({ label: 'ai.kpi.critical', value: openInsights.critical, tone: openInsights.critical > 0 ? 'text-rose-300' : 'text-gray-300' })
    parts.push({ label: 'ai.kpi.warning', value: openInsights.warning, tone: openInsights.warning > 0 ? 'text-amber-300' : 'text-gray-300' })
    parts.push({ label: 'ai.kpi.opportunity', value: openInsights.opportunity, tone: openInsights.opportunity > 0 ? 'text-emerald-300' : 'text-gray-300' })
  }

  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-gray-400">
      {parts.map((part) => (
        <li key={part.label}>
          {t(part.label)}: <span className={`font-semibold ${part.tone}`}><Num>{part.value}</Num></span>
        </li>
      ))}
    </ul>
  )
}
