import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { rejectQuotationHandler } from '@/modules/crm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.crmQuotationAccept, rejectQuotationHandler)
