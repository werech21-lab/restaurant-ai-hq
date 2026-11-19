/**
 * Server-side Odoo client for the readiness audit.
 * Refuses every method outside the read allow-list. Credentials stay in the
 * existing connector, which reads them from the environment.
 */
import { executeOdooKw } from '@/lib/odoo-live-connector'
import { isOdooReadMethod, type OdooReadMethod } from '@/lib/odoo/readiness-audit'
import type { OdooReadClient } from '@/lib/odoo/readiness-audit-collect'

export function createLiveOdooReadClient(): OdooReadClient {
  return {
    execute<T>(
      model: string,
      method: OdooReadMethod,
      args: unknown[] = [],
      kwargs: Record<string, unknown> = {},
      options?: { timeoutMs?: number; timeoutCapMs?: number },
    ): Promise<T> {
      if (!isOdooReadMethod(method)) {
        throw new Error(`Refusing Odoo method ${method}`)
      }
      const aggregate = method === 'read_group'
      return executeOdooKw<T>(model, method, args, kwargs, {
        timeoutMs: options?.timeoutMs ?? (aggregate ? 20_000 : undefined),
        timeoutCapMs: options?.timeoutCapMs ?? (aggregate ? 25_000 : undefined),
      })
    },
  }
}
