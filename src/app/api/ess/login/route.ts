import { NextResponse, type NextRequest } from 'next/server'
import { authenticateEss } from '@/services/ess.service'
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
    const body = schema.parse(await request.json())
    const emp = await authenticateEss(body.code, body.pin)
    if (!emp) {
      return NextResponse.json({ error: { code: 'invalid_credentials', message: 'Invalid employee ID or PIN' } }, { status: 401 })
    }
    const token = await signEssToken(emp.id, emp.code)
    const response = NextResponse.json({
      data: { id: emp.id, code: emp.code, name: emp.name, jobTitle: emp.jobTitle },
    })
    response.cookies.set(ESS_COOKIE, token, essCookieOptions)
    return response
  } catch (error) {
    return toErrorResponse(error, request)
  }
}

export async function DELETE() {
  const response = NextResponse.json({ data: { ok: true } })
  response.cookies.set(ESS_COOKIE, '', { ...essCookieOptions, maxAge: 0 })
  return response
}
