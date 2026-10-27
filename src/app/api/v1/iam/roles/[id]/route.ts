import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { updateRoleHandler } from '@/lib/iam/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = protectedRoute(permissions.iamRoleManage, updateRoleHandler)
