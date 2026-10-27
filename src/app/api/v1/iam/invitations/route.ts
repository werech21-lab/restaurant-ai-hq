import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { createInvitationHandler, listInvitationsHandler } from '@/lib/iam/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.iamMemberRead, listInvitationsHandler)
export const POST = protectedRoute(permissions.iamMemberInvite, createInvitationHandler)
