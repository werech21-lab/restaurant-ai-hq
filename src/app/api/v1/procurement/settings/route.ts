import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getSettingsHandler, updateSettingsHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementOrderRead, getSettingsHandler)
export const PATCH = protectedRoute(permissions.procurementSettingsManage, updateSettingsHandler)
