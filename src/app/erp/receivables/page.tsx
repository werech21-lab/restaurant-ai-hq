import type { Metadata } from 'next'
import { ReceivablesAgingStudio } from '@/components/erp/ReceivablesAgingStudio'

export const metadata: Metadata = {
  title: 'ذمم المنصات والشركات المفتوحة | إيثر لذكاء الأعمال',
}

export default function ErpReceivablesPage() {
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0 overflow-visible px-4 py-5 sm:px-6">
      <ReceivablesAgingStudio />
    </div>
  )
}
