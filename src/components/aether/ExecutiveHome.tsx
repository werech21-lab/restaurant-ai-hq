'use client'

import { useState } from 'react'
import { Activity, LayoutDashboard } from 'lucide-react'
import ExecutiveCenter from '@/modules/ai/ui/ExecutiveCenter'
import { ExecutiveSummaryV2 } from '@/components/aether/ExecutiveSummaryV2'
import { useLang } from '@/components/aether/ui'

/** /erp home: Board summary (V2 analytics) + the preserved live Executive Center (KPIs, Copilot bar, decisions). */
export function ExecutiveHome() {
  const { isAr, T } = useLang()
  const [tab, setTab] = useState<'board' | 'live'>('board')
  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="ae-seg" role="tablist" aria-label={T('Executive views', 'العروض التنفيذية')}>
          <button type="button" role="tab" aria-selected={tab === 'board'} data-active={tab === 'board'} onClick={() => setTab('board')} className="inline-flex items-center gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />
            {T('Board summary', 'ملخص مجلس الإدارة')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'live'} data-active={tab === 'live'} onClick={() => setTab('live')} className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            {T('Live executive center', 'مركز القيادة المباشر')}
          </button>
        </div>
      </div>
      {tab === 'board' ? (
        <ExecutiveSummaryV2 />
      ) : (
        <div className="ae-tile p-5 sm:p-6">
          <ExecutiveCenter />
        </div>
      )}
    </div>
  )
}
