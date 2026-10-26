'use client'

import { Badge } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import type { InvoiceStatus } from '@/modules/finance/client'

const tones = {
  draft: 'neutral',
  pending_approval: 'warn',
  issued: 'info',
  partially_paid: 'gold',
  paid: 'good',
  void: 'bad',
} as const satisfies Record<InvoiceStatus, 'neutral' | 'warn' | 'info' | 'gold' | 'good' | 'bad'>

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useI18n()
  return <Badge tone={tones[status]}>{t(`erp.status.${status}`)}</Badge>
}
