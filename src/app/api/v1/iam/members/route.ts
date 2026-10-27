import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { listMembersHandler } from '@/lib/iam/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.iamMemberRead, listMembersHandler)
