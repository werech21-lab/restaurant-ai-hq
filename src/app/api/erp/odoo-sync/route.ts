import type { NextRequest } from 'next/server'
import {
  handleOdooSyncGetRequest,
  handleOdooSyncPostRequest,
} from '@/app/api/odoo-sync/route'

export const revalidate = 900
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  return handleOdooSyncGetRequest(request)
}

export async function POST(request: NextRequest) {
  return handleOdooSyncPostRequest(request)
}
