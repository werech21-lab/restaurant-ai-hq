import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createExpenseHandler, listExpensesHandler } from '@/modules/hr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.hrExpenseRead, listExpensesHandler)
export const POST = protectedRoute(permissions.hrExpenseApprove, createExpenseHandler)
