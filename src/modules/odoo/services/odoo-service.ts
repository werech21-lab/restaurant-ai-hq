import { createHash } from 'node:crypto'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { withTransaction } from '@/lib/db'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { createCustomer, listCustomers } from '@/modules/crm'
import { createEmployee } from '@/modules/hr'
import { createItem } from '@/modules/inventory'
import { parseDelimited } from '@/modules/odoo/domain/csv'
import { recordsFromDump } from '@/modules/odoo/domain/dump'
import {
  detectModel,
  displayName,
  externalId,
  kwdToFils,
  odooModels,
  planApply,
  recordsFromRows,
  textOf,
  type ApplyTarget,
  type OdooModel,
  type OdooPayload,
} from '@/modules/odoo/domain/odoo'
import { fetchOdooModels, fetchOdooSession, liveOdooTransport, liveWebTransport, type OdooTransport } from '@/modules/odoo/domain/rpc'
import { readXlsxRows } from '@/modules/odoo/domain/sheet'
import * as repository from '@/modules/odoo/repositories/odoo-repository'
import type { PullOdooInput } from '@/modules/odoo/schemas/odoo'

const MAX_FILE_ROWS = 500

export type SyncReport = {
  jobId: string
  pulled: number
  applied: number
  staged: number
  skipped: number
}

type Prepared = { model: OdooModel; externalId: string; displayName: string; payload: OdooPayload; status: 'staged' | 'applied' | 'skipped'; target: ApplyTarget | null }

function skuOf(payload: OdooPayload, external: string): string | null {
  const raw = (textOf(payload, 'default_code') || `ODOO${external}`).toUpperCase().replace(/[^A-Z0-9._-]/g, '').slice(0, 40)
  return raw.length > 0 ? raw : null
}

function prepare(model: OdooModel, payload: OdooPayload, fallback: string, granted: ReadonlySet<string>): Prepared {
  const external = externalId(payload, fallback)
  const plan = planApply(model, payload, granted)
  return {
    model,
    externalId: external,
    displayName: displayName(model, payload, external),
    payload,
    status: plan.status === 'applied' ? 'applied' : plan.status,
    target: plan.status === 'applied' ? plan.target : null,
  }
}

async function applyOne(auth: AuthContext, row: Prepared): Promise<void> {
  const key = `odoo-${row.model.replace('.', '-')}-${row.externalId}`.slice(0, 128)
  if (row.model === 'res.partner') {
    const name = textOf(row.payload, 'name').slice(0, 200)
    const email = textOf(row.payload, 'email')
    const phone = textOf(row.payload, 'phone')
    const existing = await listCustomers(auth, { q: name, limit: 25, sort: 'name', direction: 'asc' })
    if (existing.data.some((customer) => customer.name === name)) return
    await createCustomer(auth, {
      name,
      customerType: 'company',
      email: /^[^@\s]+@[^@\s]+$/.test(email) ? email.toLowerCase() : null,
      phone: /^[0-9+()\-\s]{3,32}$/.test(phone) ? phone : null,
      taxId: textOf(row.payload, 'vat').slice(0, 40) || null,
      address: textOf(row.payload, 'street').slice(0, 500) || null,
      creditLimitMinor: null,
      notes: null,
      status: 'active',
    })
    return
  }
  if (row.model === 'hr.employee') {
    await createEmployee(auth, key, {
      employeeCode: `O${row.externalId}`.replace(/[^\w.-]/g, '').slice(0, 20),
      fullName: textOf(row.payload, 'name').slice(0, 200),
      roleTitle: (textOf(row.payload, 'job_title') || 'موظف').slice(0, 80),
      department: (textOf(row.payload, 'department_id') || 'عام').slice(0, 80),
      branchId: null,
      basicSalaryMinor: 0,
      allowancesMinor: 0,
      residencyExpiry: null,
      status: row.payload.active === false ? 'inactive' : 'active',
    })
    return
  }
  const sku = skuOf(row.payload, row.externalId)
  const cost = kwdToFils(row.payload.standard_price ?? 0)
  const price = kwdToFils(row.payload.list_price ?? 0)
  if (!sku || cost === null || price === null) throw new AppError(422, 'validation_failed', 'The product row is incomplete.')
  await createItem(auth, key, {
    sku,
    name: textOf(row.payload, 'name').slice(0, 200),
    unit: 'piece',
    unitCostMinor: cost,
    sellingPriceMinor: price,
    reorderLevel: 0,
    isActive: row.payload.active !== false,
  })
}

async function settle(auth: AuthContext, rows: Prepared[]): Promise<Prepared[]> {
  const settled: Prepared[] = []
  for (const row of rows) {
    if (row.status !== 'applied') {
      settled.push(row)
      continue
    }
    try {
      await applyOne(auth, row)
      settled.push(row)
    } catch (error) {
      const replay = error instanceof AppError && (error.code === 'employee_exists' || error.code === 'conflict' || error.code === 'idempotency_key_reused' || error.status === 409)
      settled.push(replay ? row : { ...row, status: 'skipped', target: null })
    }
  }
  return settled
}

async function store(auth: AuthContext, source: 'jsonrpc' | 'file' | 'web', database: string | null, login: string | null, models: readonly string[], rows: Prepared[], key: string, requestHash: string): Promise<IdempotentResult<{ data: SyncReport }>> {
  const settled = await settle(auth, rows)
  const applied = settled.filter((row) => row.status === 'applied').length
  const staged = settled.filter((row) => row.status === 'staged').length
  const skipped = settled.filter((row) => row.status === 'skipped').length
  return withTransaction((tx) => runIdempotent(tx, { tenantId: auth.tenantId, scope: 'admin.odoo.sync', key, requestHash }, async () => {
    const jobId = await repository.insertJob(tx, auth.tenantId, auth.userId, { source, databaseName: database, loginName: login, models })
    for (const row of settled) {
      await repository.upsertStaging(tx, auth.tenantId, jobId, { ...row, applyStatus: row.status, targetTable: row.target })
    }
    await repository.finishJob(tx, auth.tenantId, jobId, settled.length, applied, null)
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'odoo_sync_job',
      entityId: jobId,
      action: 'create',
      before: null,
      after: { source, pulled: settled.length, applied, staged, skipped },
    })
    return { status: 201 as const, body: { data: { jobId, pulled: settled.length, applied, staged, skipped } } }
  }))
}

export async function pullOdoo(
  auth: AuthContext,
  key: string,
  input: PullOdooInput,
  transport: OdooTransport = liveOdooTransport,
  webTransport: OdooTransport = liveWebTransport,
): Promise<IdempotentResult<{ data: SyncReport }>> {
  const models = input.models ?? [...odooModels]
  if (input.sessionId) {
    const pulled = await fetchOdooSession(webTransport, input.sessionId, models)
    const rows = pulled.flatMap((group) => group.rows.map((payload, index) => prepare(group.model, payload, `${group.model}-${index + 1}`, auth.permissions)))
    return store(auth, 'web', null, null, models, rows, key, hashRequest({ companyId: 1, mode: 'web', models }))
  }
  if (!input.database || !input.login || !input.secret) throw new AppError(422, 'validation_failed', 'Provide the database, user and key.')
  const pulled = await fetchOdooModels(transport, input.database, input.login, input.secret, models)
  const rows = pulled.flatMap((group) => group.rows.map((payload, index) => prepare(group.model, payload, `${group.model}-${index + 1}`, auth.permissions)))
  return store(auth, 'jsonrpc', input.database, input.login, models, rows, key, hashRequest({ database: input.database, login: input.login, models }))
}

export async function importOdooFile(auth: AuthContext, key: string, fileName: string, bytes: Uint8Array): Promise<IdempotentResult<{ data: SyncReport }>> {
  if (bytes.byteLength === 0) throw new AppError(422, 'validation_failed', 'The file is empty.')
  const lower = fileName.toLowerCase()
  const checksum = createHash('sha256').update(bytes).digest('hex')
  if (lower.endsWith('.json')) {
    if (bytes.byteLength > 8_000_000) throw new AppError(422, 'validation_failed', 'The JSON file must be under 8 MB.')
    const read = recordsFromDump(new TextDecoder().decode(bytes))
    if (!read.ok) throw new AppError(422, read.code, 'The JSON file is not a Venture Foods Odoo dump for company 1.')
    const rows = read.groups.flatMap((group) => group.rows.map((payload, index) => prepare(group.model, payload, `${group.model}-${index + 1}`, auth.permissions)))
    return store(auth, 'file', null, null, read.groups.map((group) => group.model), rows, key, hashRequest({ fileName, checksum, models: read.groups.map((group) => group.model) }))
  }
  if (bytes.byteLength > 2_000_000) throw new AppError(422, 'validation_failed', 'The file must be under 2 MB.')
  const table = lower.endsWith('.xlsx')
    ? readXlsxRows(bytes)
    : parseDelimited(new TextDecoder().decode(bytes), lower.endsWith('.tsv') ? '\t' : ',')
  const [header, ...body] = table
  if (!header || body.length === 0) throw new AppError(422, 'validation_failed', 'The file has no rows.')
  const model = detectModel(header)
  if (!model) throw new AppError(422, 'odoo_file_unrecognized', 'The file headers do not match an Odoo export.')
  const records = recordsFromRows(header, body.slice(0, MAX_FILE_ROWS))
  const rows = records.map((payload, index) => prepare(model, payload, `${index + 1}`, auth.permissions))
  return store(auth, 'file', null, null, [model], rows, key, hashRequest({ fileName, checksum, model }))
}

export async function odooBoard(auth: AuthContext): Promise<{ jobs: repository.OdooJob[]; records: repository.StagingRow[] }> {
  return withTransaction(async (tx) => ({
    jobs: await repository.listJobs(tx, auth.tenantId),
    records: await repository.listRecords(tx, auth.tenantId),
  }))
}
