import os from 'node:os'
import { sweepVitestSqliteCopies } from '../../db'

export function setup(): void {
  // Per-worker SQLite copies are created lazily by src/lib/db.ts when needed.
}

export async function teardown(): Promise<void> {
  const runId = process.env.AETHERBI_VITEST_RUN_ID
  sweepVitestSqliteCopies('/tmp', runId)
  sweepVitestSqliteCopies(os.tmpdir(), runId)
}
