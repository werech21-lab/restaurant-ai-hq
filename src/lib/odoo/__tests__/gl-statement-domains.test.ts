import { describe, expect, it } from 'vitest'
import { glReadDomains } from '@/lib/odoo/gl-statements-live'

describe('GL statement domains', () => {
  it('scopes the trial balance and the balance sheet to the company', () => {
    const companyId = 1
    const domains = glReadDomains(companyId, [10501], '2026-11-01', '2026-11-17')
    expect(domains.trialBalance).toContainEqual(['company_id', '=', companyId])
    expect(domains.balanceSheet).toContainEqual(['company_id', '=', companyId])
    expect(domains.trialBalance).toContainEqual(['account_id', 'in', [10501]])
    expect(domains.balanceSheet).toContainEqual(['account_id', 'in', [10501]])
  })
})
