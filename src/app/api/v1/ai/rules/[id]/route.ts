import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { updateRuleHandler } from '@/modules/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PUT = protectedRoute(permissions.aiRuleUpdate, updateRuleHandler)
