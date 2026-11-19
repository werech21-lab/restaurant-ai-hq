import type { Metadata } from 'next'
import { ReceivablesAgingStudio } from '@/components/erp/ReceivablesAgingStudio'

export const metadata: Metadata = {
  title: 'ذمم المنصات والشركات المفتوحة | إيثر لذكاء الأعمال',
}

export default function ErpReceivablesPage() {
  return <ReceivablesAgingStudio />
}
