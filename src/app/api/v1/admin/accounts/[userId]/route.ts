import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { updateAccountHandler } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = protectedRoute(permissions.iamMemberUpdate, updateAccountHandler)
