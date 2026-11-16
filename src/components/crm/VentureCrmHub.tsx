'use client'

import React, { useEffect, useState } from 'react'
import { UtensilsCrossed, Crown, MessageSquare, Gift, Building2 } from 'lucide-react'
import { SectionCard, StateBlock } from '@/components/ui'

type CrmTab = 'catering' | 'vip' | 'feedback' | 'campaigns' | 'legacy'

export function VentureCrmHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<CrmTab>('catering')
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)

  useEffect(() => {
    setCurrentLocale(locale)
  }, [locale])

  const isAr = currentLocale !== 'en'
  const resolvedLocale = isAr ? 'ar' : 'en'

  const tabs: Array<{ key: CrmTab; labelAr: string; labelEn: string; icon: typeof Building2 }> = [
    { key: 'catering', labelAr: 'عقود الكاترينج', labelEn: 'Catering contracts', icon: UtensilsCrossed },
    { key: 'vip', labelAr: 'كبار العملاء', labelEn: 'VIP customers', icon: Crown },
    { key: 'feedback', labelAr: 'ملاحظات الخدمة', labelEn: 'Service notes', icon: MessageSquare },
    { key: 'campaigns', labelAr: 'الحملات', labelEn: 'Campaigns', icon: Gift },
    ...(liveChildren
      ? [{ key: 'legacy' as const, labelAr: 'الفرص وعروض الأسعار', labelEn: 'Leads and quotes', icon: Building2 }]
      : []),
  ]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-none space-y-6 p-3 sm:p-6">
      <SectionCard
        locale={resolvedLocale}
        icon={<Building2 className="h-5 w-5" aria-hidden />}
        title={isAr ? 'علاقات العملاء' : 'Customer relations'}
        subtitle={
          isAr
            ? 'لا تُعرض أرقام عقود إلا عندما تأتي من Odoo. التبويبات غير المربوطة تبقى فارغة حتى يوجد مصدر.'
            : 'Contract figures appear only when they come from Odoo. Unlinked tabs stay empty until a source exists.'
        }
        actions={
          <button
            type="button"
            onClick={() => setCurrentLocale(isAr ? 'en' : 'ar')}
            className="ds-surface ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl px-3.5 py-2 text-xs font-bold hover:bg-[var(--ds-bg-hover)]"
          >
            {isAr ? 'English' : 'عربي'}
          </button>
        }
      >
        <nav
          role="tablist"
          aria-label={isAr ? 'أقسام علاقات العملاء' : 'CRM sections'}
          className="mb-5 flex flex-wrap items-center gap-2 border-b border-[var(--ds-border-hairline)] pb-4"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={`ds-motion ds-focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold ${
                  active
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'ds-surface text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)]'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              </button>
            )
          })}
        </nav>

        {activeTab === 'catering' && (
          <StateBlock
            state="unlinked"
            locale={resolvedLocale}
            title={isAr ? 'لا توجد عقود كاترينج مرتبطة' : 'No catering contracts are linked'}
            description={
              isAr
                ? 'Odoo لا يوفّر سجل عقود كاترينج لهذه الشاشة. لا يُعرض إجمالي أو نسبة أو عقد تجريبي.'
                : 'Odoo does not provide a catering-contract ledger for this screen. No total, rate, or sample contract is shown.'
            }
          />
        )}
        {activeTab === 'vip' && (
          <StateBlock
            state="unlinked"
            locale={resolvedLocale}
            title={isAr ? 'لا توجد قائمة كبار عملاء' : 'No VIP list is linked'}
            description={
              isAr ? 'لا يوجد مصدر Odoo لأسماء أو أرقام كبار العملاء.' : 'There is no Odoo source for VIP names or figures.'
            }
          />
        )}
        {activeTab === 'feedback' && (
          <StateBlock
            state="unlinked"
            locale={resolvedLocale}
            title={isAr ? 'لا توجد ملاحظات خدمة' : 'No service notes are linked'}
            description={isAr ? 'لا يوجد مصدر Odoo لملاحظات الخدمة.' : 'There is no Odoo source for service notes.'}
          />
        )}
        {activeTab === 'campaigns' && (
          <StateBlock
            state="unlinked"
            locale={resolvedLocale}
            title={isAr ? 'لا توجد حملات مرتبطة' : 'No campaigns are linked'}
            description={
              isAr ? 'لا يوجد مصدر Odoo لحملات أو عائد.' : 'There is no Odoo source for campaigns or return.'
            }
          />
        )}
        {activeTab === 'legacy' && liveChildren && <div>{liveChildren}</div>}
      </SectionCard>
    </div>
  )
}
