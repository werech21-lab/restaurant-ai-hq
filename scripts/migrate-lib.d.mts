export type MigrationFile = { name: string; checksum: string }

export const baselineSentinels: Record<string, string[]>

export function planMigrations(
  files: MigrationFile[],
  applied: Map<string, string>
): { pending: string[]; upToDate: string[]; changed: string[]; unknown: string[]; gaps: string[] }

export function isUnbaselined(input: { historyRows: number; hasCoreTables: boolean }): boolean

export function planBaseline(
  files: MigrationFile[],
  applied: Map<string, string>,
  through: string
): { record: MigrationFile[]; sentinels: { migration: string; object: string }[] }

export function assertNothingBeyond(files: MigrationFile[], applied: Map<string, string>, through: string): void

export function sslOptions(mode: string, ca: string | undefined): boolean | { rejectUnauthorized: boolean; ca?: string }
