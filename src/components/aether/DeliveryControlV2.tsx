'use client'

import React from 'react'
import { useLang } from '@/components/aether/ui'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function DeliveryControlV2() {
  const { isAr } = useLang()

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto w-full min-w-0 max-w-[1920px] p-3.5 sm:p-5">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — مطابقة التسويات الثلاثية واسترداد المبالغ"
        titleEn="3-Way Payout Reconciliation & Chargebacks"
        reasonAr="كشوف تسوية منصات التوصيل التفصيلية ومطالبات الاسترداد (Chargebacks) وإيداعات البنوك غير مربوطة آلياً بمصدر خارجي حالياً. لعرض مبيعات التوصيل والذمم الفعلية من أودو، راجع رادار التوصيل."
        reasonEn="Detailed aggregator payout statements, order-level chargeback claims, and bank settlement feeds are not linked to an automated source."
        requiredSourceAr="واجهة كشوف تسوية منصات التوصيل + كشف الحساب البنكي"
        requiredSourceEn="Aggregator Settlement Statements API + Bank Statement Feed"
      />
    </div>
  )
}

export default DeliveryControlV2
