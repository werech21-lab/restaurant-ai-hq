import os from 'node:os'
import { sweepVitestSqliteCopies } from '../../db'

export function setup(): void {
  // Per-worker SQLite copies are created lazily by src/lib/db.ts when needed.
}

export async function teardown(): Promise<void> {
  sweepVitestSqliteCopies('/tmp')
  sweepVitestSqliteCopies(os.tmpdir())
}
