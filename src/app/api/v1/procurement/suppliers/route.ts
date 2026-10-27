import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createSupplierHandler, listSuppliersHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementSupplierRead, listSuppliersHandler)
export const POST = protectedRoute(permissions.procurementSupplierManage, createSupplierHandler)
