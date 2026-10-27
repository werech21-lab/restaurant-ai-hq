import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getBranchHandler, updateBranchHandler } from '@/modules/org'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.orgBranchRead, getBranchHandler)
export const PATCH = protectedRoute(permissions.orgBranchManage, updateBranchHandler)
