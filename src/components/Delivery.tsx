'use client'

import { Card, Num, PageHeader } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

export default function Delivery() {
  const { t } = useI18n()
  const companies = [
    { name: t('partner.tali'), fee: '18%', time: '28', errors: '2.1%', margin: '14.2%', marginClass: 'text-emerald-300' },
    { name: t('partner.dco'), fee: '21%', time: '34', errors: '4.8%', margin: '11.1%', marginClass: 'text-amber-300' },
  ]

  return (
    <div>
      <PageHeader title={t('page.delivery.title')} subtitle={t('page.delivery.subtitle')} />

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {companies.map((company) => (
          <Card key={company.name}>
            <p className="font-semibold text-mist-100">{company.name}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-mist-400">{t('col.fee')}</dt>
                <dd className="mt-1 font-semibold">
                  <Num>{company.fee}</Num>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-mist-400">{t('col.time')}</dt>
                <dd className="mt-1 font-semibold">
                  <Num>{company.time}</Num> {t('minute')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-mist-400">{t('col.errors')}</dt>
                <dd className="mt-1 font-semibold">
                  <Num>{company.errors}</Num>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-mist-400">{t('col.margin')}</dt>
                <dd className={`mt-1 font-semibold ${company.marginClass}`}>
                  <Num>{company.margin}</Num>
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <Card interactive={false} className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-black/30 text-[13px] text-mist-400">
            <tr>
              <th className="p-4 text-start font-medium">{t('col.company')}</th>
              <th className="p-4 text-start font-medium">{t('col.fee')}</th>
              <th className="p-4 text-start font-medium">{t('col.time')}</th>
              <th className="p-4 text-start font-medium">{t('col.errors')}</th>
              <th className="p-4 text-start font-medium">{t('col.margin')}</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.name} className="border-t border-gold-300/10 transition hover:bg-gold-300/[0.04]">
                <td className="p-4 font-medium">{company.name}</td>
                <td className="p-4">
                  <Num>{company.fee}</Num>
                </td>
                <td className="p-4">
                  <Num>{company.time}</Num> {t('minute')}
                </td>
                <td className="p-4">
                  <Num>{company.errors}</Num>
                </td>
                <td className={`p-4 font-semibold ${company.marginClass}`}>
                  <Num>{company.margin}</Num>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
