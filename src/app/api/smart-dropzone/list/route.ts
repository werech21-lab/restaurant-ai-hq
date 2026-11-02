import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/erp-auth'
import { logger } from '@/lib/logger'
import { listSmartDropzoneDocuments } from '@/services/universal-ai-router.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated', message: 'Sign in required.' } }, { status: 401 })
  }

  const limitRaw = Number(request.nextUrl.searchParams.get('limit') || '200')
  const limit = Number.isFinite(limitRaw) ? limitRaw : 200

  try {
    const rows = await listSmartDropzoneDocuments(limit)
    return NextResponse.json({ data: { rows, count: rows.length } })
  } catch (error) {
    logger.error('smart_dropzone_list_failed', {
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: { code: 'list_failed', message: 'Could not load smart-dropzone ledger.' } },
      { status: 500 },
    )
  }
}
