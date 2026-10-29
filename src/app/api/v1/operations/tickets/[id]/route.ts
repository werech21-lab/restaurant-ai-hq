import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { updateTicketHandler } from '@/modules/operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = protectedRoute(permissions.opsQualityManage, updateTicketHandler)
