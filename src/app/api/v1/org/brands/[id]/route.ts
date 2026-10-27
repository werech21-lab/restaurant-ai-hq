import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getBrandHandler, updateBrandHandler } from '@/modules/org'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.orgBrandRead, getBrandHandler)
export const PATCH = protectedRoute(permissions.orgBrandManage, updateBrandHandler)
