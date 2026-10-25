'use client'

import { useState } from 'react'
import { Card, Money, Num, PageHeader } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

export default function Reports() {
  const { t } = useI18n()
  const [openId, setOpenId] = useState<string | null>('daily')
  const reports = [
    {
      id: 'daily',
      title: t('report.daily'),
      meta: t('report.dailyMeta'),
      time: '07:30',
      detail: (
        <>
          {t('report.revenue')} <Money value="48,250" /> {t('report.andMargin')} <Num>32.1%</Num>
        </>
      ),
    },
    {
      id: 'weekly',
      title: t('report.weekly'),
      meta: t('report.weeklyMeta'),
      detail: t('report.weeklyDetail'),
    },
    {
      id: 'monthly',
      title: t('report.monthly'),
      meta: t('report.monthlyMeta'),
      detail: t('report.monthlyDetail'),
    },
    {
      id: 'ondemand',
      title: t('report.ondemand'),
      meta: t('report.ondemandMeta'),
      detail: t('report.ondemandDetail'),
    },
  ]

  return (
    <div>
      <PageHeader title={t('page.reports.title')} subtitle={t('page.reports.subtitle')} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const open = openId === report.id
          return (
            <Card key={report.id} className={open ? 'border-gold-400/30' : ''}>
              <button type="button" onClick={() => setOpenId(open ? null : report.id)} className="w-full cursor-pointer text-start">
                <h2 className="font-semibold text-mist-100">{report.title}</h2>
                <p className="mt-2 text-sm text-mist-400">
                  {report.meta}
                  {report.time ? (
                    <>
                      {' '}
                      <Num>{report.time}</Num> {t('morning')}
                    </>
                  ) : null}
                </p>
              </button>
              {open ? <p className="mt-4 border-t border-white/[0.06] pt-4 text-sm leading-7 text-mist-300">{report.detail}</p> : null}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
