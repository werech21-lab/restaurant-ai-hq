import type { Metadata } from 'next'
import { ReceivablesAgingStudio } from '@/components/erp/ReceivablesAgingStudio'

export const metadata: Metadata = {
  title: 'ذمم المنصات وأعمار الديون | إيثر لذكاء الأعمال',
}

export default function ErpReceivablesPage() {
  return <ReceivablesAgingStudio />
}
