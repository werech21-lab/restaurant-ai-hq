import { NextResponse } from 'next/server'
import type { RouteArgs } from '@/lib/api/route'
import { getOdooDataCenterReport } from '@/modules/odoo/services/data-center-service'

export async function odooDataCenterHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getOdooDataCenterReport(auth))
}
