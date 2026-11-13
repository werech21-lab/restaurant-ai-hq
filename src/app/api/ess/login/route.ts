import { NextResponse, type NextRequest } from 'next/server'
import { authenticateEss } from '@/services/ess.service'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  extractClientIp,
  loginAccountFailureLimiter,
  loginIpAttemptLimiter,
} from '@/lib/auth/api-guard'
import { ESS_COOKIE, essCookieOptions, signEssToken } from '@/lib/ess-session'
import { toErrorResponse } from '@/lib/api/route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  code: z.string().min(1).max(20),
  pin: z.string().min(4).max(12),
})

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request)
    const ipDecision = loginIpAttemptLimiter.check(`ess-ip:${clientIp}`)
    if (!ipDecision.allowed) {
      return buildRateLimitedJsonResponse(ipDecision.retryAfterSeconds)
    }

    const body = schema.parse(await request.json())
    const accountKey = `ess-acct:${clientIp}:${body.code.trim().toLowerCase()}`
    const blocked = loginAccountFailureLimiter.peekBlocked(accountKey)
    if (blocked.blocked) {
      return buildRateLimitedJsonResponse(blocked.retryAfterSeconds)
    }

    const emp = await authenticateEss(body.code, body.pin)
    if (!emp) {
      const fail = loginAccountFailureLimiter.check(accountKey)
      if (!fail.allowed) {
        return buildRateLimitedJsonResponse(fail.retryAfterSeconds)
      }
      return NextResponse.json(
        { error: { code: 'invalid_credentials', message: 'Invalid employee ID or PIN' } },
        { status: 401, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    loginAccountFailureLimiter.reset(accountKey)
    const token = await signEssToken(emp.id, emp.code)
    const response = NextResponse.json(
      {
        data: { id: emp.id, code: emp.code, name: emp.name, jobTitle: emp.jobTitle },
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
    response.cookies.set(ESS_COOKIE, token, essCookieOptions)
    return response
  } catch (error) {
    return toErrorResponse(error, request)
  }
}

export async function DELETE() {
  const response = NextResponse.json(
    { data: { ok: true } },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
  response.cookies.set(ESS_COOKIE, '', { ...essCookieOptions, maxAge: 0 })
  return response
}
