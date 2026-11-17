import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { recordVitestSqliteCopyForRun, sweepVitestSqliteCopies } from '@/lib/db'
import { comparisonMatchesFacts, type ComparableFact } from '@/server/ai/structured-claim'

describe('phase 12 should-fix 1: comparisonMatchesFacts rejects cross-entity comparisons', () => {
  it('rejects company-vs-branch better, worse, and equal comparisons while keeping branch-vs-branch', () => {
    const company: ComparableFact = {
      id: 'net_sales_kwd|company|2026-11-15',
      metric: 'net_sales_kwd',
      period: '2026-11-15',
      date: '2026-11-15',
      unit: 'KWD',
      value: '1400',
      entityType: 'company',
      entityId: 'company',
      entityName: 'company',
    }
    const companyEqualAvenues: ComparableFact = {
      ...company,
      value: '1000',
    }
    const avenues: ComparableFact = {
      id: 'net_sales_kwd|avenues|2026-11-15',
      metric: 'net_sales_kwd',
      period: '2026-11-15',
      date: '2026-11-15',
      unit: 'KWD',
      value: '1000',
      entityType: 'branch',
      entityId: 'avenues',
      entityName: 'avenues',
    }
    const salmiya: ComparableFact = {
      id: 'net_sales_kwd|salmiya|2026-11-15',
      metric: 'net_sales_kwd',
      period: '2026-11-15',
      date: '2026-11-15',
      unit: 'KWD',
      value: '400',
      entityType: 'branch',
      entityId: 'salmiya',
      entityName: 'salmiya',
    }
    const brand: ComparableFact = {
      id: 'net_sales_kwd|china-garden|2026-11-15',
      metric: 'net_sales_kwd',
      period: '2026-11-15',
      date: '2026-11-15',
      unit: 'KWD',
      value: '800',
      entityType: 'brand',
      entityId: 'china-garden',
      entityName: 'china-garden',
    }

    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'company',
          relation: 'better',
          object_id: 'avenues',
          metric: 'net_sales_kwd',
          cited_fact_ids: [company.id, avenues.id],
        },
        [company, avenues, salmiya],
      ),
    ).toBe(false)

    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'avenues',
          relation: 'worse',
          object_id: 'company',
          metric: 'net_sales_kwd',
          cited_fact_ids: [avenues.id, company.id],
        },
        [company, avenues, salmiya],
      ),
    ).toBe(false)

    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'company',
          relation: 'equal',
          object_id: 'avenues',
          metric: 'net_sales_kwd',
          cited_fact_ids: [companyEqualAvenues.id, avenues.id],
        },
        [companyEqualAvenues, avenues],
      ),
    ).toBe(false)

    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'china-garden',
          relation: 'better',
          object_id: 'salmiya',
          metric: 'net_sales_kwd',
          cited_fact_ids: [brand.id, salmiya.id],
        },
        [brand, salmiya],
      ),
    ).toBe(false)

    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'avenues',
          relation: 'better',
          object_id: 'salmiya',
          metric: 'net_sales_kwd',
          cited_fact_ids: [avenues.id, salmiya.id],
        },
        [company, avenues, salmiya],
      ),
    ).toBe(true)
  })
})

describe('phase 12 should-fix 4: pos_terminal_branch_map migration lives only in database/migrations', () => {
  it('removes prisma/migrations/20261116093000_pos_terminal_branch_map while keeping database/migrations/0051_pos_terminal_branch_map.sql', () => {
    const prismaMigrationDir = path.join(
      process.cwd(),
      'prisma',
      'migrations',
      '20261116093000_pos_terminal_branch_map',
    )
    const dbMigrationSql = path.join(
      process.cwd(),
      'database',
      'migrations',
      '0051_pos_terminal_branch_map.sql',
    )

    expect(existsSync(prismaMigrationDir)).toBe(false)
    expect(existsSync(dbMigrationSql)).toBe(true)
  })
})

describe('phase 12 should-fix 5: run-scoped /tmp vitest sqlite sweep', () => {
  it('deletes only paths recorded for runA (and its -wal and .manifest) while keeping unrecorded concurrent /tmp copies', () => {
    mkdirSync('/tmp', { recursive: true })
    const runADb = '/tmp/aetherbi-vitest-111111.db'
    const runAWal = '/tmp/aetherbi-vitest-111111.db-wal'
    const concurrentDb = '/tmp/aetherbi-vitest-222222.db'
    const runAManifest = path.join(os.tmpdir(), 'vf-vitest-run-runA.manifest')
    const prevRunId = process.env.AETHERBI_VITEST_RUN_ID

    expect(prevRunId?.trim().length).toBeGreaterThan(0)
    expect(process.env.SQLITE_URL ?? '').toContain(`/tmp/aetherbi-vitest-${process.pid}.db`)

    try {
      writeFileSync(runADb, 'runA-db')
      writeFileSync(runAWal, 'runA-wal')
      writeFileSync(concurrentDb, 'concurrent-db')

      recordVitestSqliteCopyForRun(runADb, 'runA')
      expect(existsSync(runAManifest)).toBe(true)

      sweepVitestSqliteCopies('/tmp', 'runA')

      expect(existsSync(runADb)).toBe(false)
      expect(existsSync(runAWal)).toBe(false)
      expect(existsSync(runAManifest)).toBe(false)
      expect(existsSync(concurrentDb)).toBe(true)

      delete process.env.AETHERBI_VITEST_RUN_ID
      sweepVitestSqliteCopies('/tmp')

      expect(existsSync(concurrentDb)).toBe(true)

      const sourceDb = path.join(process.cwd(), 'prisma', 'dev.db')
      sweepVitestSqliteCopies(path.join(process.cwd(), 'prisma'), 'runA')
      expect(existsSync(sourceDb)).toBe(true)
    } finally {
      if (prevRunId === undefined) {
        delete process.env.AETHERBI_VITEST_RUN_ID
      } else {
        process.env.AETHERBI_VITEST_RUN_ID = prevRunId
      }
      for (const file of [runADb, runAWal, concurrentDb, runAManifest]) {
        try {
          if (existsSync(file)) unlinkSync(file)
        } catch {
          // Ignore cleanup errors.
        }
      }
    }
  })
})
