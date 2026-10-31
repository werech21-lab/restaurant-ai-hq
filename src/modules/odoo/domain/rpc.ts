import { AppError } from '@/lib/api/errors'
import { ODOO_ORIGIN, odooFields, payloadFromOdoo, type OdooModel, type OdooPayload } from '@/modules/odoo/domain/odoo'

export type OdooTransport = (url: string, body: unknown, secret: string) => Promise<unknown>

const PAGE = 200

function resultOf(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || !('result' in payload)) {
    throw new AppError(422, 'odoo_unreachable', 'Odoo did not return a JSON-RPC result.')
  }
  if ('error' in payload && (payload as { error?: unknown }).error) {
    throw new AppError(422, 'odoo_rejected', 'Odoo refused the request.')
  }
  return (payload as { result: unknown }).result
}

async function readModel(transport: OdooTransport, url: string, database: string, uid: number, secret: string, model: OdooModel): Promise<OdooPayload[]> {
  let rows: unknown
  try {
    rows = resultOf(await transport(url, {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [database, uid, secret, model, 'search_read', [[]], { fields: [...odooFields[model]], limit: PAGE }],
      },
    }, secret))
  } catch (error) {
    if (error instanceof AppError && error.code === 'odoo_rejected') return []
    throw error
  }
  if (!Array.isArray(rows)) return []
  return rows.slice(0, PAGE).map((row) => (
    typeof row === 'object' && row !== null && !Array.isArray(row) ? payloadFromOdoo(model, row as Record<string, unknown>) : payloadFromOdoo(model, {})
  ))
}

export async function fetchOdooModels(
  transport: OdooTransport,
  database: string,
  login: string,
  secret: string,
  models: readonly OdooModel[],
): Promise<{ model: OdooModel; rows: OdooPayload[] }[]> {
  const url = `${ODOO_ORIGIN}/jsonrpc`
  const auth = resultOf(await transport(url, {
    jsonrpc: '2.0',
    method: 'call',
    params: { service: 'common', method: 'authenticate', args: [database, login, secret, {}] },
  }, secret))
  if (typeof auth !== 'number' || !Number.isInteger(auth) || auth <= 0) {
    throw new AppError(401, 'odoo_auth_failed', 'Odoo did not accept the database, user or key.')
  }
  const pulled: { model: OdooModel; rows: OdooPayload[] }[] = []
  for (const model of models) pulled.push({ model, rows: await readModel(transport, url, database, auth, secret, model) })
  return pulled
}

export async function liveOdooTransport(url: string, body: unknown, _secret: string): Promise<unknown> {
  if (url !== `${ODOO_ORIGIN}/jsonrpc`) throw new AppError(422, 'odoo_host_refused', 'Only the Venture Foods Odoo site can be pulled.')
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new AppError(422, 'odoo_unreachable', 'Odoo could not be reached.')
  }
  if (response.status !== 200) throw new AppError(422, 'odoo_unreachable', 'Odoo could not be reached.')
  return response.json() as Promise<unknown>
}
