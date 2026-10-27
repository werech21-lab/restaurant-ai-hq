import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { changeMemberRoleHandler, removeMemberHandler } from '@/lib/iam/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = protectedRoute(permissions.iamMemberUpdate, changeMemberRoleHandler)
export const DELETE = protectedRoute(permissions.iamMemberRemove, removeMemberHandler)
