import { publicRoute } from '@/lib/api/route'
import { trialRequestHandler } from '@/modules/marketing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = publicRoute(trialRequestHandler)
