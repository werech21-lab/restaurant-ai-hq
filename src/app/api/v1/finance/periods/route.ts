import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createPeriodHandler, listPeriodsHandler } from '@/modules/finance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.financeJournalRead, listPeriodsHandler)
export const POST = protectedRoute(permissions.financePeriodManage, createPeriodHandler)
