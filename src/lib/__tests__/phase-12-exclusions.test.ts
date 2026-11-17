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

describe('phase 12 exclusions: non-POS closed-Hawally canteen exemption & parity', () => {
  it('exempts closed-Hawally school canteen products, locations, registers, and GL accounts while keeping street branches and Jahra/Qurain/Heisenberg excluded', () => {
    expect(isExcludedOdooEntity('Canteen hawally: insect killer')).toBe(false)
    expect(isExcludedOdooEntity('مقصف حولي')).toBe(false)
    expect(isExcludedOdooEntity('مقصف مدرسة حولي')).toBe(false)
    expect(isExcludedOdooEntity('مدرسة حولي')).toBe(false)
    expect(isExcludedOdooEntity('بمقصف حولي')).toBe(false)
    expect(isExcludedOdooEntity('للمقصف حولي')).toBe(false)
    expect(isExcludedOdooEntity('Hawally School Canteen')).toBe(false)
    expect(isExcludedOdooEntity('NPIS Hawally (Inactive)')).toBe(false)
    expect(isExcludedOdooEntity('FAIPS Hawally')).toBe(false)
    expect(isExcludedOdooEntity('FAS Hawally')).toBe(false)
    // TODO(Abdullah): confirm
    expect(isExcludedOdooEntity('Cash On Hand/ NPIS Hawally Branch Cashier - فرع حولي - NPIS')).toBe(false)

    // Bare English school, plural المدارس, and street-qualified labels stay excluded
    expect(isExcludedOdooEntity('Hawally School Street Branch')).toBe(true)
    expect(isExcludedOdooEntity('حولي - شارع المدارس')).toBe(true)
    expect(isExcludedOdooEntity('مدرسة حولي - شارع تونس')).toBe(true)

    // Substring "fas" inside Breakfast / Superfast must never trigger the FAS canteen exemption
    expect(isExcludedOdooEntity('Breakfast Hawally')).toBe(true)
    expect(isExcludedOdooEntity('Superfast Hawally')).toBe(true)

    // Never exempt Heisenberg, Qurain, or Jahra even when combined with canteen markers
    expect(isExcludedOdooEntity('Heisenberg School Canteen')).toBe(true)
    expect(isExcludedOdooEntity('FAIPS Qurain')).toBe(true)
    expect(isExcludedOdooEntity('NPIS Jahra')).toBe(true)
  })

  it('preserves Phase 11 joined-name and product lookalike invariants', () => {
    expect(isExcludedOdooEntity('Jahra01')).toBe(true)
    expect(isExcludedOdooEntity('Hawally2')).toBe(true)
    expect(isExcludedOdooEntity('Canteen Hawally2')).toBe(true)
    expect(isExcludedOdooEntity('AlJahra')).toBe(true)
    expect(isExcludedOdooEntity('HeisenbergKW')).toBe(true)

    expect(isExcludedOdooEntity('Shawali')).toBe(false)
    expect(isExcludedOdooEntity('Qurainy Dates')).toBe(false)
    expect(isExcludedOdooEntity('Chawali Masala')).toBe(false)
    expect(isExcludedOdooEntity('FAIPS Ahmadi')).toBe(false)
    expect(isExcludedOdooEntity('FAS Fahaheel')).toBe(false)
  })

  it('keeps appendOdooNameExclusion consistent with closed-Hawally canteen exemptions and exclusions', () => {
    const domain: unknown[] = []
    appendOdooNameExclusion(domain, 'name')

    // Preserves Phase 9/10 domain invariants
    expect(domain.some((part) => Array.isArray(part) && part[1] === 'ilike' && part[2] === 'school')).toBe(false)
    expect(domain.some((part) => Array.isArray(part) && part[1] === 'not ilike')).toBe(false)

    // Kept (not excluded -> domain evaluates to true)
    expect(evalOdooDomain(domain, 'Canteen hawally: insect killer')).toBe(true)
    expect(evalOdooDomain(domain, 'مقصف حولي')).toBe(true)
    expect(evalOdooDomain(domain, 'مقصف مدرسة حولي')).toBe(true)
    expect(evalOdooDomain(domain, 'مدرسة حولي')).toBe(true)
    expect(evalOdooDomain(domain, 'Hawally School Canteen')).toBe(true)
    expect(evalOdooDomain(domain, 'NPIS Hawally (Inactive)')).toBe(true)
    expect(evalOdooDomain(domain, 'FAIPS Hawally')).toBe(true)
    expect(evalOdooDomain(domain, 'FAS Hawally')).toBe(true)
    // TODO(Abdullah): confirm
    expect(evalOdooDomain(domain, 'Cash On Hand/ NPIS Hawally Branch Cashier - فرع حولي - NPIS')).toBe(true)
    expect(evalOdooDomain(domain, 'Breakfast')).toBe(true)
    expect(evalOdooDomain(domain, 'Superfast')).toBe(true)

    // Excluded (domain evaluates to false)
    expect(evalOdooDomain(domain, 'Hawally School Street Branch')).toBe(false)
    expect(evalOdooDomain(domain, 'Branch hawally: closed')).toBe(false)
    expect(evalOdooDomain(domain, 'حولي - شارع المدارس')).toBe(false)
    expect(evalOdooDomain(domain, 'مدرسة حولي - شارع تونس')).toBe(false)
    expect(evalOdooDomain(domain, 'Heisenberg School Canteen')).toBe(false)
    expect(evalOdooDomain(domain, 'FAIPS Qurain')).toBe(false)
    expect(evalOdooDomain(domain, 'NPIS Jahra')).toBe(false)
    expect(evalOdooDomain(domain, 'Breakfast Hawally')).toBe(false)
    expect(evalOdooDomain(domain, 'Superfast Hawally')).toBe(false)
    expect(evalOdooDomain(domain, 'Hawally2')).toBe(false)
    expect(evalOdooDomain(domain, 'Canteen Hawally2')).toBe(false)
  })

  it('keeps odooConsoleExtractor rowKept consistent with closed-Hawally canteen exemptions and exclusions', () => {
    const rowKept = buildConsoleRowKept()

    // Kept
    expect(rowKept({ id: 1, name: 'Canteen hawally: insect killer' })).toBe(true)
    expect(rowKept({ id: 2, name: 'مقصف حولي' })).toBe(true)
    expect(rowKept({ id: 3, name: 'مقصف مدرسة حولي' })).toBe(true)
    expect(rowKept({ id: 4, name: 'مدرسة حولي', street: false })).toBe(true)
    expect(rowKept({ id: 5, name: 'Hawally School Canteen' })).toBe(true)
    expect(rowKept({ id: 6, name: 'NPIS Hawally (Inactive)' })).toBe(true)
    expect(rowKept({ id: 7, name: 'FAIPS Hawally' })).toBe(true)
    expect(rowKept({ id: 8, name: 'FAS Hawally' })).toBe(true)
    // TODO(Abdullah): confirm
    expect(rowKept({ id: 9, name: 'Cash On Hand/ NPIS Hawally Branch Cashier - فرع حولي - NPIS' })).toBe(true)
    expect(rowKept({ id: 10, name: 'Breakfast' })).toBe(true)
    expect(rowKept({ id: 11, name: 'Superfast' })).toBe(true)

    // Excluded
    expect(rowKept({ id: 12, name: 'Hawally School Street Branch' })).toBe(false)
    expect(rowKept({ id: 13, name: 'حولي - شارع المدارس' })).toBe(false)
    expect(rowKept({ id: 14, name: 'مدرسة حولي - شارع تونس' })).toBe(false)
    expect(rowKept({ id: 15, name: 'Heisenberg School Canteen' })).toBe(false)
    expect(rowKept({ id: 16, name: 'FAIPS Qurain' })).toBe(false)
    expect(rowKept({ id: 17, name: 'NPIS Jahra' })).toBe(false)
    expect(rowKept({ id: 18, name: 'Breakfast Hawally' })).toBe(false)
    expect(rowKept({ id: 19, name: 'Superfast Hawally' })).toBe(false)
    expect(rowKept({ id: 20, name: 'Hawally2' })).toBe(false)
    expect(rowKept({ id: 21, name: 'Canteen Hawally2' })).toBe(false)
  })
})
