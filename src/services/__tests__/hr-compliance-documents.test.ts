import { describe, expect, it } from 'vitest'
import { expiriesFromHrDocuments } from '@/services/hr-compliance.service'

describe('expiriesFromHrDocuments', () => {
  it('copies only dates that exist on hrDocument rows', () => {
    const civil = new Date('2027-04-01T00:00:00.000Z')
    const passport = new Date('2028-01-15T00:00:00.000Z')
    const copied = expiriesFromHrDocuments([
      { category: 'civil_id', expiryDate: civil, civilId: '123' },
      { category: 'passport_work', expiryDate: passport },
      { category: 'health_card', expiryDate: null },
      { category: 'other', expiryDate: new Date('2026-01-01T00:00:00.000Z') },
    ])
    expect(copied.civilIdExpiry).toEqual(civil)
    expect(copied.passportExpiry).toEqual(passport)
    expect(copied.workPermitExpiry).toEqual(passport)
    expect(copied.healthCardExpiry).toBeUndefined()
    expect(copied.drivingLicenseExpiry).toBeUndefined()
  })

  it('returns no dates when documents are missing', () => {
    expect(expiriesFromHrDocuments([])).toEqual({})
  })
})
