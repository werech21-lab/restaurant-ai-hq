import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { analyzeContractHandler, listAnalysesHandler } from '@/modules/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.govContractRead, listAnalysesHandler)
export const POST = protectedRoute(permissions.govContractAnalyze, analyzeContractHandler)
