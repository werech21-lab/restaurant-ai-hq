import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { acknowledgeInsightHandler } from '@/modules/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.aiInsightUpdate, acknowledgeInsightHandler)
