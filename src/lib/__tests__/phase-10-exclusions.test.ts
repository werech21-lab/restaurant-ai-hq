import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { removeVitestSqliteCopy } from '@/lib/db'
import { isPinnedSchoolCanteenConfigId } from '@/lib/odoo/company-pos'
import { appendOdooNameExclusion, isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { odooConsoleExtractor } from '@/modules/odoo/domain/console'

const closed = ['haw', 'ally'].join('')

describe('phase 10 exclusions', () => {
  it('adds the missing spellings and keeps school canteens', () => {
    expect(isExcludedOdooEntity('قرين')).toBe(true)
    expect(isExcludedOdooEntity('Kurain')).toBe(true)
    expect(isExcludedOdooEntity('Heisenburg')).toBe(true)
    expect(isExcludedOdooEntity('Haisenberg')).toBe(true)
    expect(isExcludedOdooEntity('جهرا')).toBe(true)
    expect(isExcludedOdooEntity(`NPIS ${closed}`)).toBe(false)
    expect(isExcludedOdooEntity('FAIPS Ahmadi')).toBe(false)
    expect(isPinnedSchoolCanteenConfigId(42)).toBe(true)
    expect(isExcludedOdooEntity('NPIS Jahra')).toBe(true)
  })

  it('keeps product names that only share letters with a closed branch', () => {
    expect(isExcludedOdooEntity('Shawali')).toBe(false)
    expect(isExcludedOdooEntity('Chawali Masala')).toBe(false)
    expect(isExcludedOdooEntity('Cheese Qureinat')).toBe(false)
    expect(isExcludedOdooEntity('Qurainy Dates')).toBe(false)
    // Owner decision 2026-11-18: no closed Hawally restaurant; Hawally names are not excluded (ids only).
    expect(isExcludedOdooEntity(closed)).toBe(false)
    expect(isExcludedOdooEntity('Al-Qurain Kitchen')).toBe(true)
    const domain: unknown[] = []
    appendOdooNameExclusion(domain, 'name')
    expect(domain.some((part) => Array.isArray(part) && part[1] === 'not ilike')).toBe(false)
    expect(domain.some((part) => Array.isArray(part) && part[1] === '=ilike' && part[2] === ` ${closed} `)).toBe(false)
    expect(domain.some((part) => Array.isArray(part) && String(part[2] ?? '').toLowerCase().includes(closed))).toBe(false)
    expect(domain.some((part) => Array.isArray(part) && part[1] === '=ilike' && /jahra/i.test(String(part[2])))).toBe(true)
    const script = odooConsoleExtractor()
    expect(script).toContain('split(')
    expect(script).not.toContain('blob.indexOf(fragment)')
  })
})

describe('phase 10 temp database', () => {
  it('removes a vitest sqlite copy and leaves the source database alone', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'aetherbi-vitest-phase10-'))
    const target = path.join(dir, 'aetherbi-vitest-phase10-cleanup.db')
    writeFileSync(target, 'copy')
    writeFileSync(`${target}-wal`, 'wal')
    const source = path.join(process.cwd(), 'prisma', 'dev.db')
    expect(existsSync(source)).toBe(true)
    removeVitestSqliteCopy(target)
    removeVitestSqliteCopy(source)
    expect(existsSync(target)).toBe(false)
    expect(existsSync(`${target}-wal`)).toBe(false)
    expect(existsSync(source)).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })
})
