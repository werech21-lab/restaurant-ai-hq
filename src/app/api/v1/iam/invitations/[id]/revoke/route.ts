import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { revokeInvitationHandler } from '@/lib/iam/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.iamMemberInvite, revokeInvitationHandler)
