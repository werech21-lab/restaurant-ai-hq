import type { NextRequest } from 'next/server'
import { handleOdooSyncRequest } from '@/app/api/odoo-sync/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  return handleOdooSyncRequest(request)
}

export async function POST(request: NextRequest) {
  return handleOdooSyncRequest(request)
}
