export type Queryable = { query(text: string, params?: unknown[]): Promise<{ rows: any[] }> }
export type Target = { host: string; user: string; database: string }

export function parseTarget(url: string): Target
export function assertExpectedTarget(url: string, expected: string | undefined): void

export type ProductsReport = {
  state: 'no_table' | 'before_0009' | 'after_0009'
  total: number
  withoutTenant: number
  withTenant: number
  withoutCreator: number
  tenants: number
  byTenant: { tenantId: string; products: number }[]
}
export function collectProductsReport(client: Queryable): Promise<ProductsReport>
export function formatProductsReport(report: ProductsReport, target: Target): string

export type MigrationFileInfo = { name: string; checksum: string }
export function assertMigrationsCurrent(client: Queryable, files: MigrationFileInfo[]): Promise<void>

export type Check = { name: string; ok: boolean; detail: string }
export type ValidationResult = { ok: boolean; checks: Check[] }
export function runIsolationChecks(client: Queryable, runId: string): Promise<ValidationResult>
export function formatValidation(result: ValidationResult, target: Target): string
