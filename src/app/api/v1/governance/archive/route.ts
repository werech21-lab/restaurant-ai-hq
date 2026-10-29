import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { routeArchive } from '@/lib/governance-routing'
import { listArchiveHandler } from '@/modules/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.govArchiveRead, listArchiveHandler)
export const POST = protectedRoute(permissions.govArchiveRoute, routeArchive)
