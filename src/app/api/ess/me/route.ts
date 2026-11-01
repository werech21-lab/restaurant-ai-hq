import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { ESS_COOKIE, verifyEssToken } from '@/lib/ess-session'
import { getEssProfile, submitEssLeave } from '@/services/ess.service'
import { toErrorResponse } from '@/lib/api/route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireEss() {
  const jar = await cookies()
  const token = jar.get(ESS_COOKIE)?.value
  if (!token) return null
  return verifyEssToken(token)
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireEss()
    if (!session) return NextResponse.json({ error: { code: 'unauthorized', message: 'ESS login required' } }, { status: 401 })
    const profile = await getEssProfile(session.employeeId)
    if (!profile) return NextResponse.json({ error: { code: 'unauthorized', message: 'ESS login required' } }, { status: 401 })
    return NextResponse.json({ data: profile })
  } catch (error) {
    return toErrorResponse(error, request)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireEss()
    if (!session) return NextResponse.json({ error: { code: 'unauthorized', message: 'ESS login required' } }, { status: 401 })
    const body = z
      .object({
        type: z.enum(['compensatory', 'legal', 'sick']),
        dateFrom: z.string().min(8),
        dateTo: z.string().min(8),
        note: z.string().max(500).optional(),
      })
      .parse(await request.json())
    const result = await submitEssLeave({ employeeId: session.employeeId, ...body })
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error, request)
  }
}
