import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { postOpenRevenueHandler } from '@/modules/finance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.financeJournalPost, postOpenRevenueHandler)
