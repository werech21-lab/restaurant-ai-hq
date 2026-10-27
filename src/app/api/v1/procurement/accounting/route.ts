import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getAccountingHandler, updateAccountingHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementInvoiceRead, getAccountingHandler)
export const PATCH = protectedRoute(permissions.procurementSettingsManage, updateAccountingHandler)
