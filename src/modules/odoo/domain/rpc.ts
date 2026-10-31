import { AppError } from '@/lib/api/errors'
import { ODOO_COMPANY_ID, ODOO_ORIGIN, odooFields, payloadFromOdoo, type OdooModel, type OdooPayload } from '@/modules/odoo/domain/odoo'

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
        args: [database, uid, secret, model, 'search_read', [[]], { fields: [...odooFields[model]], limit: PAGE, context: { allowed_company_ids: [ODOO_COMPANY_ID] } }],
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

const WEB_URL = `${ODOO_ORIGIN}/web/dataset/call_kw`
const SESSION_COOKIE = /^session_id=[A-Za-z0-9._-]{8,128}; cids=1$/

export function sessionCookie(sessionId: string): string {
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(sessionId)) {
    throw new AppError(422, 'validation_failed', 'The Odoo session id is not usable.')
  }
  return `session_id=${sessionId}; cids=1`
}

function failureOf(payload: unknown): 'ok' | 'auth' | 'rejected' {
  if (typeof payload !== 'object' || payload === null) return 'rejected'
  if ('error' in payload && (payload as { error?: unknown }).error) {
    const error = (payload as { error: unknown }).error
    const blob = JSON.stringify(error)
    if (/session expired|sessionexpired|odoo\.http\.sessionexpired/i.test(blob)) return 'auth'
    return 'rejected'
  }
  return 'result' in payload ? 'ok' : 'rejected'
}

export async function fetchOdooSession(
  transport: OdooTransport,
  sessionId: string,
  models: readonly OdooModel[],
): Promise<{ model: OdooModel; rows: OdooPayload[] }[]> {
  const cookie = sessionCookie(sessionId)
  const pulled: { model: OdooModel; rows: OdooPayload[] }[] = []
  let sawAuth = false
  let sawRows = false
  for (const model of models) {
    let payload: unknown
    try {
      payload = await transport(WEB_URL, {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method: 'search_read',
          args: [[]],
          kwargs: { fields: [...odooFields[model]], limit: PAGE, context: { allowed_company_ids: [ODOO_COMPANY_ID] } },
        },
      }, cookie)
    } catch (error) {
      if (error instanceof AppError && error.code === 'odoo_rejected') {
        pulled.push({ model, rows: [] })
        continue
      }
      throw error
    }
    const kind = failureOf(payload)
    if (kind === 'auth') {
      sawAuth = true
      continue
    }
    if (kind !== 'ok') {
      pulled.push({ model, rows: [] })
      continue
    }
    const result = (payload as { result: unknown }).result
    const rows = Array.isArray(result)
      ? result.slice(0, PAGE).map((row) => (
        typeof row === 'object' && row !== null && !Array.isArray(row) ? payloadFromOdoo(model, row as Record<string, unknown>) : payloadFromOdoo(model, {})
      ))
      : []
    if (rows.length > 0) sawRows = true
    pulled.push({ model, rows })
  }
  if (sawAuth && !sawRows) throw new AppError(401, 'odoo_auth_failed', 'The Odoo session was refused.')
  return pulled
}

export async function liveWebTransport(url: string, body: unknown, cookie: string): Promise<unknown> {
  if (url !== WEB_URL || !SESSION_COOKIE.test(cookie)) throw new AppError(422, 'odoo_host_refused', 'Only the Venture Foods Odoo site can be pulled.')
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/json', accept: 'application/json', cookie },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new AppError(422, 'odoo_unreachable', 'Odoo could not be reached.')
  }
  if (response.status !== 200) throw new AppError(422, 'odoo_unreachable', 'Odoo could not be reached.')
  return response.json() as Promise<unknown>
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
