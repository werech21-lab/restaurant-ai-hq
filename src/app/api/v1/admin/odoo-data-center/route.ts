import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { odooDataCenterHandler } from '@/modules/odoo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.adminOdooRead, odooDataCenterHandler)
