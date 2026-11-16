'use client'

import React, { useState } from 'react'
import { UtensilsCrossed, Crown, MessageSquare, Gift, Building2 } from 'lucide-react'

type CrmTab = 'catering' | 'vip' | 'feedback' | 'campaigns' | 'legacy'

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-8 text-center">
      <p className="text-base font-bold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">{body}</p>
    </div>
  )
}

export function VentureCrmHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<CrmTab>('catering')
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const isAr = currentLocale === 'ar'

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
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-none min-h-screen bg-[#0a0d12] text-slate-100 p-3 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">
            {isAr ? 'علاقات العملاء' : 'Customer relations'}
          </h1>
          <p className="text-xs text-slate-400">
            {isAr
              ? 'لا تُعرض أرقام عقود إلا عندما تأتي من Odoo. التبويبات الأخرى فارغة حتى يوجد مصدر.'
              : 'Contract figures appear only when they come from Odoo. The other tabs stay empty until a source exists.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCurrentLocale(isAr ? 'en' : 'ar')}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          {isAr ? 'English' : 'عربي'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                active ? 'bg-purple-500 text-white' : 'bg-slate-900 text-slate-300 border border-slate-800'
              }`}
            >
              <Icon size={15} />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
            </button>
          )
        })}
      </div>

      {activeTab === 'catering' && (
        <EmptyPanel
          title={isAr ? 'لا توجد عقود كاترينج مرتبطة' : 'No catering contracts are linked'}
          body={isAr
            ? 'Odoo لا يوفّر سجل عقود كاترينج لهذه الشاشة. لا يُعرض إجمالي أو نسبة أو عقد تجريبي.'
            : 'Odoo does not provide a catering-contract ledger for this screen. No total, rate, or sample contract is shown.'}
        />
      )}
      {activeTab === 'vip' && (
        <EmptyPanel
          title={isAr ? 'لا توجد قائمة كبار عملاء' : 'No VIP list is linked'}
          body={isAr ? 'لا يوجد مصدر Odoo لأسماء أو أرقام كبار العملاء.' : 'There is no Odoo source for VIP names or figures.'}
        />
      )}
      {activeTab === 'feedback' && (
        <EmptyPanel
          title={isAr ? 'لا توجد ملاحظات خدمة' : 'No service notes are linked'}
          body={isAr ? 'لا يوجد مصدر Odoo لملاحظات الخدمة.' : 'There is no Odoo source for service notes.'}
        />
      )}
      {activeTab === 'campaigns' && (
        <EmptyPanel
          title={isAr ? 'لا توجد حملات مرتبطة' : 'No campaigns are linked'}
          body={isAr ? 'لا يوجد مصدر Odoo لحملات أو عائد.' : 'There is no Odoo source for campaigns or return.'}
        />
      )}
      {activeTab === 'legacy' && liveChildren && (
        <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl">{liveChildren}</div>
      )}
    </div>
  )
}
