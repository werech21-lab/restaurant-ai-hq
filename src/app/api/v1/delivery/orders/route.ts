import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createOrderHandler, listOrdersHandler } from '@/modules/delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.financeJournalRead, listOrdersHandler)
export const POST = protectedRoute(permissions.financeJournalPost, createOrderHandler)
