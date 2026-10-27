import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getAccountHandler, updateAccountHandler } from '@/modules/finance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.financeAccountRead, getAccountHandler)
export const PATCH = protectedRoute(permissions.financeAccountManage, updateAccountHandler)
