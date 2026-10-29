import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createAccountHandler, listAccountsHandler } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.iamMemberRead, listAccountsHandler)
export const POST = protectedRoute(permissions.iamMemberInvite, createAccountHandler)
