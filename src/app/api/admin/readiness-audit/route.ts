import { NextRequest, NextResponse } from 'next/server'
import {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import { logger } from '@/lib/logger'
import { isOdooLiveEnvConfigured, redactOdooSecrets } from '@/lib/odoo-live-connector'
import { collectReadinessAudit } from '@/lib/odoo/readiness-audit-collect'
import { createLiveOdooReadClient } from '@/lib/odoo/readiness-audit-live'
import {
  READINESS_BUDGET_MS,
  isReadinessAuditRole,
  readinessAuditToCsv,
  sanitizeReadinessReport,
  type ReadinessReport,
} from '@/lib/odoo/readiness-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CSV_NAME = 'aetherbi-readiness-audit.csv'

function wantsCsv(request: NextRequest): boolean {
  const format = request.nextUrl.searchParams.get('format')?.trim().toLowerCase()
  if (format === 'csv') return true
  if (format === 'json' || format === null || format === '') {
    return format !== 'json' && (request.headers.get('accept') ?? '').includes('text/csv')
  }
  return false
}

function invalidFormat(format: string): boolean {
  return format !== 'json' && format !== 'csv'
}

export async function GET(request: NextRequest) {
  const auth = await requireExecApiSession(request, { allowAuditor: true })
  if (!auth.ok) return auth.response
  if (!isReadinessAuditRole(auth.session.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'forbidden',
          message: 'This readiness audit is limited to admin and auditor sessions.',
        },
      },
      { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const format = request.nextUrl.searchParams.get('format')?.trim().toLowerCase() ?? ''
  if (format && invalidFormat(format)) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'invalid_format', message: 'format must be json or csv.' },
      },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  if (!isOdooLiveEnvConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'odoo_not_configured',
          message: 'Odoo credentials are not configured on the server.',
        },
      },
      { status: 503, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const report = await Promise.race([
      collectReadinessAudit(createLiveOdooReadClient(), {
        clock: Date.now,
        budgetMs: READINESS_BUDGET_MS,
        generatedAt: new Date(started).toISOString(),
      }),
      new Promise<ReadinessReport>((_, reject) => {
        timer = setTimeout(() => reject(new Error('budget')), READINESS_BUDGET_MS)
      }),
    ])
    return respond(request, report)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'readiness audit failed'
    logger.error('readiness audit failed', { errorMessage: redactOdooSecrets(message) })
    const timedOut = message === 'budget'
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: timedOut ? 'budget_exceeded' : 'odoo_read_failed',
          message: timedOut
            ? 'The read-only audit exceeded its 60 second budget before a report could be returned.'
            : 'The read-only Odoo audit failed.',
        },
      },
      { status: timedOut ? 504 : 502, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function respond(request: NextRequest, report: ReadinessReport): NextResponse {
  const safe = JSON.parse(redactOdooSecrets(JSON.stringify(sanitizeReadinessReport(report)))) as ReadinessReport
  if (wantsCsv(request)) {
    return new NextResponse(readinessAuditToCsv(safe), {
      status: 200,
      headers: {
        ...ENTERPRISE_API_SECURITY_HEADERS,
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${CSV_NAME}"`,
        'x-readiness-partial': safe.partial ? '1' : '0',
      },
    })
  }
  return NextResponse.json(
    safe,
    {
      status: 200,
      headers: {
        ...ENTERPRISE_API_SECURITY_HEADERS,
        'x-readiness-partial': safe.partial ? '1' : '0',
      },
    },
  )
}
