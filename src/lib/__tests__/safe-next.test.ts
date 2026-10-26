import { describe, expect, it } from 'vitest'
import { safeNextPath } from '@/lib/safe-next'

describe('safeNextPath', () => {
  it('allows internal admin and erp paths', () => {
    expect(safeNextPath('/erp/finance')).toBe('/erp/finance')
    expect(safeNextPath('/admin')).toBe('/admin')
    expect(safeNextPath('/erp')).toBe('/erp')
  })

  it('falls back for empty, external and malformed values', () => {
    expect(safeNextPath(undefined)).toBe('/admin')
    expect(safeNextPath('')).toBe('/admin')
    expect(safeNextPath('//evil.com')).toBe('/admin')
    expect(safeNextPath('https://evil.com')).toBe('/admin')
    expect(safeNextPath('/\\evil.com')).toBe('/admin')
    expect(safeNextPath('/erp/../admin')).toBe('/admin')
    expect(safeNextPath('/erp/finance?x=1')).toBe('/admin')
    expect(safeNextPath('/other')).toBe('/admin')
    expect(safeNextPath('/adminx')).toBe('/admin')
  })
})
