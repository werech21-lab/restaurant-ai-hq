import { describe, expect, it } from 'vitest'
import { deepLinkId } from '@/lib/deep-link'

const id = '11111111-1111-4111-8111-111111111111'

describe('deepLinkId', () => {
  it('accepts one UUID and ignores anything else', () => {
    expect(deepLinkId(id)).toBe(id)
    expect(deepLinkId([id])).toBeNull()
    expect(deepLinkId('not-an-id')).toBeNull()
    expect(deepLinkId(undefined)).toBeNull()
  })
})