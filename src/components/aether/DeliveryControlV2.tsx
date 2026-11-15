'use client'

import React from 'react'
import { useLang } from '@/components/aether/ui'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function DeliveryControlV2() {
  const { isAr } = useLang()

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto py-4">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — مطابقة التسويات الثلاثية واسترداد المبالغ"
        titleEn="غير مربوط بمصدر — 3-Way Payout Reconciliation & Chargebacks"
        reasonAr="كشوف تسوية منصات التوصيل التفصيلية ومطالبات الاسترداد (Chargebacks) وإيداعات البنوك غير مربوطة آلياً بمصدر خارجي حالياً. لعرض مبيعات التوصيل والذمم الفعلية من أودو، راجع رادار التوصيل."
        reasonEn="Detailed aggregator payout statements, order-level chargeback claims, and bank settlement feeds are not linked to an automated source."
        requiredSourceAr="Aggregator Settlement Statements API + Bank Statement Feed"
      />
    </div>
  )
}

export default DeliveryControlV2
