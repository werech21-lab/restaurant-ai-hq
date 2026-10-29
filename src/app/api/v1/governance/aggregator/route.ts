import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { aggregatorBoardHandler } from '@/modules/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.govAggregatorRead, aggregatorBoardHandler)
