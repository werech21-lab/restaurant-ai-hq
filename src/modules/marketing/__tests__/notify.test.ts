import { describe, expect, it } from 'vitest'
import { buildTrialAlertMessage } from '@/modules/marketing/domain/notify'

describe('trial notify message', () => {
  it('builds a stable Arabic alert for managers', () => {
    const text = buildTrialAlertMessage({
      fullName: 'أحمد',
      phone: '+96550000000',
      companyName: 'Venture Test',
      leadId: 'lead-1',
      customerId: 'cust-1',
    })
    expect(text).toContain('طلب نسخة تجريبية')
    expect(text).toContain('أحمد')
    expect(text).toContain('+96550000000')
    expect(text).toContain('Venture Test')
    expect(text).toContain('lead-1')
  })
})
