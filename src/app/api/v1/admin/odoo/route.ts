import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { odooBoardHandler, pullOdooHandler } from '@/modules/odoo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.adminOdooRead, odooBoardHandler)
export const POST = protectedRoute(permissions.adminOdooSync, pullOdooHandler)
