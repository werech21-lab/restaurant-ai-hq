import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { listTelemetryHandler, recordTelemetryHandler } from '@/modules/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.govTelemetryRead, listTelemetryHandler)
export const POST = protectedRoute(permissions.govTelemetryRecord, recordTelemetryHandler)
