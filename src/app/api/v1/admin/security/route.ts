import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getSecurityHandler, updateSecurityHandler } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.iamMemberRead, getSecurityHandler)
export const PATCH = protectedRoute(permissions.iamRoleManage, updateSecurityHandler)
