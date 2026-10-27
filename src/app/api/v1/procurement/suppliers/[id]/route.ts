import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getSupplierHandler, updateSupplierHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementSupplierRead, getSupplierHandler)
export const PATCH = protectedRoute(permissions.procurementSupplierManage, updateSupplierHandler)
