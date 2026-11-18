import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DASHBOARD_BRANCH_CARD_IDS } from '@/lib/aether/global-filter-engine'

describe('delivery radar branch coverage', () => {
  it('includes exhibition booths and school canteens in the branch matrix', () => {
    expect(DASHBOARD_BRANCH_CARD_IDS).toEqual(
      expect.arrayContaining(['school-canteens', 'exhibitions']),
    )
    const src = readFileSync(
      path.join(process.cwd(), 'src/components/aether/DeliveryRadarV5.tsx'),
      'utf8',
    )
    expect(src).toContain('DASHBOARD_BRANCH_CARD_IDS')
    expect(src).toContain('مبيعات ودفعات كل منصة توصيل')
  })
})
