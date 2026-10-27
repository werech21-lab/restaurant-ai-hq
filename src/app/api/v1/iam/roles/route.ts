import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { createRoleHandler, listRolesHandler } from '@/lib/iam/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.iamRoleRead, listRolesHandler)
export const POST = protectedRoute(permissions.iamRoleManage, createRoleHandler)
