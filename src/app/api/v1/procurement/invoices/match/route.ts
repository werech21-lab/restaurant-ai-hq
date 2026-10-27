import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { previewMatchHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.procurementInvoiceCreate, previewMatchHandler)
