import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createQuotationHandler, listQuotationsHandler } from '@/modules/crm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.crmQuotationRead, listQuotationsHandler)
export const POST = protectedRoute(permissions.crmQuotationCreate, createQuotationHandler)
