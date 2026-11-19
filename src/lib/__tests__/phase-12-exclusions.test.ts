import { describe, expect, it } from 'vitest'
import { appendOdooNameExclusion, isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { odooConsoleExtractor } from '@/modules/odoo/domain/console'

function evalOdooLeaf(record: Record<string, string>, leaf: unknown): boolean {
  if (!Array.isArray(leaf) || leaf.length !== 3) {
    throw new Error(`Invalid Odoo domain leaf: ${JSON.stringify(leaf)}`)
  }
  const [field, op, rhs] = leaf as [string, string, string]
  const value = String(record[field] ?? '')
  if (op === 'ilike') {
    return value.toLowerCase().includes(String(rhs).toLowerCase())
  }
  if (op === '=ilike') {
    const escaped = String(rhs)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/%/g, '.*')
    return new RegExp(`^${escaped}$`, 'i').test(value)
  }
  throw new Error(`Unsupported Odoo operator: ${op}`)
}

function evalOdooDomain(domain: readonly unknown[], name: string): boolean {
  const record = { name }
  function evalExpr(idx: number): [boolean, number] {
    if (idx >= domain.length) {
      throw new Error(`Unexpected end of Odoo domain at index ${idx}`)
    }
    const tok = domain[idx]
    if (tok === '!') {
      const [val, next] = evalExpr(idx + 1)
      return [!val, next]
    }
    if (tok === '&' || tok === '|') {
      const [left, mid] = evalExpr(idx + 1)
      const [right, next] = evalExpr(mid)
      return [tok === '&' ? left && right : left || right, next]
    }
    return [evalOdooLeaf(record, tok), idx + 1]
  }

  let cursor = 0
  let result = true
  while (cursor < domain.length) {
    const [val, next] = evalExpr(cursor)
    result = result && val
    cursor = next
  }
  return result
}

function buildConsoleRowKept(): (row: Record<string, unknown>) => boolean {
  const script = odooConsoleExtractor()
  const start = script.indexOf('const excluded =')
  const end = script.indexOf('const company =')
  expect(start).toBeGreaterThan(0)
  expect(end).toBeGreaterThan(start)
  const body = `${script.slice(start, end)}\nreturn rowKept;`
  return new Function(body)() as (row: Record<string, unknown>) => boolean
}

// Owner decision 2026-11-18: there is no closed Hawally restaurant (NPIS Hawally canteen is pos.config
// 41, the Promenade shop sits in Hawally). Hawally names are therefore never excluded; exclusion is
// by explicit id (24, 25, 39, 40) plus the Jahra / Qurain / Heisenberg name rules.
const HAWALLY_NAMES_KEPT = [
  'Canteen hawally: insect killer',
  'مقصف حولي',
  'مقصف مدرسة حولي',
  'مدرسة حولي',
  'بمقصف حولي',
  'للمقصف حولي',
  'Hawally School Canteen',
  'NPIS Hawally (Inactive)',
  'FAIPS Hawally',
  'FAS Hawally',
  'Cash On Hand/ NPIS Hawally Branch Cashier - فرع حولي - NPIS',
  'Hawally School Street Branch',
  'حولي - شارع المدارس',
  'مدرسة حولي - شارع تونس',
  'Breakfast Hawally',
  'Superfast Hawally',
  'Hawally2',
  'Canteen Hawally2',
  'Branch hawally: closed',
  'Promenade Hawally',
  'Breakfast',
  'Superfast',
]
const STILL_EXCLUDED = ['Heisenberg School Canteen', 'NPIS Jahra', 'Jahra01', 'AlJahra', 'HeisenbergKW']

describe('phase 12 exclusions: Hawally names accepted, Jahra/Qurain/Heisenberg excluded, parity', () => {
  it('does not exclude any Hawally name (canteen, street, shop) and keeps Jahra/Qurain/Heisenberg excluded', () => {
    for (const name of HAWALLY_NAMES_KEPT) expect(isExcludedOdooEntity(name), name).toBe(false)
    for (const name of STILL_EXCLUDED) expect(isExcludedOdooEntity(name), name).toBe(true)
  })

  it('preserves Phase 11 joined-name and product lookalike invariants', () => {
    expect(isExcludedOdooEntity('Jahra01')).toBe(true)
    expect(isExcludedOdooEntity('AlJahra')).toBe(true)
    expect(isExcludedOdooEntity('HeisenbergKW')).toBe(true)

    expect(isExcludedOdooEntity('Shawali')).toBe(false)
    expect(isExcludedOdooEntity('Qurainy Dates')).toBe(false)
    expect(isExcludedOdooEntity('Chawali Masala')).toBe(false)
    expect(isExcludedOdooEntity('FAIPS Ahmadi')).toBe(false)
    expect(isExcludedOdooEntity('FAS Fahaheel')).toBe(false)
  })

  it('keeps appendOdooNameExclusion consistent with isExcludedOdooEntity', () => {
    const domain: unknown[] = []
    appendOdooNameExclusion(domain, 'name')

    // Preserves Phase 9/10 domain invariants
    expect(domain.some((part) => Array.isArray(part) && part[1] === 'ilike' && part[2] === 'school')).toBe(false)
    expect(domain.some((part) => Array.isArray(part) && part[1] === 'not ilike')).toBe(false)

    expect(domain).toEqual([])
    for (const name of HAWALLY_NAMES_KEPT) expect(evalOdooDomain(domain, name), name).toBe(true)
    for (const name of STILL_EXCLUDED) expect(evalOdooDomain(domain, name), name).toBe(true)
  })

  it('keeps odooConsoleExtractor rowKept consistent with isExcludedOdooEntity', () => {
    const rowKept = buildConsoleRowKept()
    HAWALLY_NAMES_KEPT.forEach((name, i) => expect(rowKept({ id: i + 1, name }), name).toBe(true))
    STILL_EXCLUDED.forEach((name, i) => expect(rowKept({ id: 100 + i, name }), name).toBe(false))
  })
})
