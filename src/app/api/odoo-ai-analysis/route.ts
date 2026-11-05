import { NextResponse } from 'next/server'

/**
 * Retired. This endpoint used to call an external language-model API. The
 * dashboard no longer uses it and it must not spend tokens, so it now answers
 * 410 Gone without any outbound request.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json({ error: 'GONE', message: 'This endpoint has been retired.' }, { status: 410 })
}
