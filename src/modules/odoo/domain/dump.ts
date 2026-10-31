import { ODOO_COMPANY_ID, ODOO_ORIGIN, isOdooModel, payloadFromOdoo, type OdooModel, type OdooPayload } from '@/modules/odoo/domain/odoo'

const MAX_ROWS = 1000

export type DumpFailure = 'odoo_file_unrecognized' | 'odoo_company_refused'

export type DumpGroup = { model: OdooModel; rows: OdooPayload[] }

const WRAPPER = new Set(['source', 'companyId', 'exportedAt', 'models'])

/** A browser dump or a JSON object keyed by Odoo model. Unknown models are ignored. */
export function recordsFromDump(text: string): { ok: true; groups: DumpGroup[] } | { ok: false; code: DumpFailure } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return { ok: false, code: 'odoo_file_unrecognized' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, code: 'odoo_file_unrecognized' }
  const record = parsed as Record<string, unknown>
  if ('companyId' in record && record.companyId !== ODOO_COMPANY_ID) return { ok: false, code: 'odoo_company_refused' }
  if ('source' in record && record.source !== ODOO_ORIGIN) return { ok: false, code: 'odoo_company_refused' }
  const bag = record.models
  const models = typeof bag === 'object' && bag !== null && !Array.isArray(bag) ? bag as Record<string, unknown> : record
  const groups: DumpGroup[] = []
  for (const [name, value] of Object.entries(models)) {
    if (WRAPPER.has(name) || !isOdooModel(name) || !Array.isArray(value)) continue
    const rows = value.slice(0, MAX_ROWS).flatMap((row) => (
      typeof row === 'object' && row !== null && !Array.isArray(row) ? [payloadFromOdoo(name, row as Record<string, unknown>)] : []
    ))
    groups.push({ model: name, rows })
  }
  if (groups.length === 0 || groups.every((group) => group.rows.length === 0)) return { ok: false, code: 'odoo_file_unrecognized' }
  return { ok: true, groups }
}
