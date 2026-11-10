'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChefHat, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { feryalHref } from '@/lib/aether/ledger'
import { dailyDecisionBrief, dayLabel } from '@/lib/enterprise-giants-engine'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Num, TONE_HEX, useLang } from '@/components/aether/ui'

const ICON = { profit: ShieldCheck, kitchen: ChefHat, channel: Truck }
const RANK = {
  profit: { en: '#1 Profit protection', ar: 'الأولوية 1: حماية الربح' },
  kitchen: { en: '#1 Kitchen prep', ar: 'الأولوية 1: تحضير المطبخ' },
  channel: { en: '#1 Channel action', ar: 'الأولوية 1: إجراء القنوات' },
}

/** Top-3 daily executive decision brief for the /erp morning view. */
export function DecisionBriefStrip({ anchor }: { anchor: string }) {
  const { isAr, T } = useLang()
  const { filters } = useBiFilters()
  const cards = useMemo(() => dailyDecisionBrief(filters, anchor), [filters, anchor])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="ae-h text-base text-slate-900 dark:text-white">{T('Today’s executive decision brief', 'موجز القرارات التنفيذية لليوم')}</h2>
        <span className="ae-chip">{dayLabel(anchor, isAr ? 'ar' : 'en')}</span>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = ICON[c.id]
          return (
            <article key={c.id} className="ae-tile ae-lift relative flex flex-col justify-between gap-3 overflow-hidden p-5">
              <span className="absolute inset-y-0 start-0 w-1" style={{ backgroundColor: TONE_HEX[c.tone] }} aria-hidden />
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="ae-icon-badge">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">{isAr ? RANK[c.id].ar : RANK[c.id].en}</span>
                </div>
                <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">{isAr ? c.titleAr : c.titleEn}</h3>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{isAr ? c.bodyAr : c.bodyEn}</p>
              </div>
              <div className="space-y-3">
                <Num className="text-base" >
                  <span style={{ color: TONE_HEX[c.tone] }}>{isAr ? c.metricAr : c.metricEn}</span>
                </Num>
                <div className="no-print flex flex-wrap gap-2">
                  <Link href={c.href} className="ae-pill-dark ae-pill-sm">
                    {T('Open', 'فتح')}
                    <ArrowUpRight className={`h-3 w-3 ${isAr ? '-scale-x-100' : ''}`} />
                  </Link>
                  <Link href={feryalHref(isAr ? c.askAr : c.askEn)} className="ae-pill-light ae-pill-sm">
                    <Sparkles className="h-3 w-3" />
                    {T('Feryal voice briefing', 'موجز فريال الصوتي')}
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
