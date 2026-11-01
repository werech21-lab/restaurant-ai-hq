import { NextResponse, type NextRequest } from 'next/server'
import { decodeFileToken, readLocalHrFile } from '@/lib/hr-file-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const key = decodeFileToken(token)
  if (!key) return NextResponse.json({ error: { code: 'not_found', message: 'File not found' } }, { status: 404 })
  const file = readLocalHrFile(key)
  if (!file) return NextResponse.json({ error: { code: 'not_found', message: 'File not found' } }, { status: 404 })
  const lower = key.toLowerCase()
  const type = lower.endsWith('.pdf')
    ? 'application/pdf'
    : lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'image/jpeg'
        : 'application/octet-stream'
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `inline; filename="${key.split('/').pop() || 'file'}"`,
    },
  })
}
