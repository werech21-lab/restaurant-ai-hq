import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getInvoiceHandler, updateInvoiceHandler } from '@/modules/finance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.financeInvoiceRead, getInvoiceHandler)
export const PATCH = protectedRoute(permissions.financeInvoiceUpdate, updateInvoiceHandler)
