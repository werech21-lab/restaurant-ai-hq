'use client'

import { Card, Num, PageHeader } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

export default function Agents() {
  const { t } = useI18n()
  const agents = [
    { name: t('agent.finance'), status: t('agent.financeStatus'), detail: t('agent.financeDetail'), tone: 'bg-emerald-400' },
    {
      name: t('agent.quality'),
      status: (
        <>
          {t('agent.qualityWatch')} <Num>3</Num> {t('agent.qualityAlerts')}
        </>
      ),
      detail: t('agent.qualityDetail'),
      tone: 'bg-amber-300',
    },
    { name: t('agent.contracts'), status: t('agent.contractsStatus'), detail: t('agent.contractsDetail'), tone: 'bg-emerald-400' },
    { name: t('agent.analysis'), status: t('agent.analysisStatus'), detail: t('agent.analysisDetail'), tone: 'bg-sky-300' },
  ]

  return (
    <div>
      <PageHeader title={t('page.agents.title')} subtitle={t('page.agents.subtitle')} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <Card key={agent.name}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-mist-100">{agent.name}</h2>
              <span className={`h-2.5 w-2.5 rounded-full ${agent.tone}`} />
            </div>
            <p className="mt-3 text-sm text-mist-100">{agent.status}</p>
            <p className="mt-1 text-sm text-mist-400">{agent.detail}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
